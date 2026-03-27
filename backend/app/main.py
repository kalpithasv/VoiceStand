import datetime as dt
import json
import os
import uuid
from typing import Generator

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session

from .auth import create_access_token, decode_token, hash_password, is_user_suspended, verify_password
from .config import settings
from .db import SessionLocal, init_db, engine
from .models import Comment, Post, PostVote, User
from .schemas import (
    CommentCreate,
    CommentOut,
    LocationUpdate,
    LoginRequest,
    PostCreateResponse,
    PostCreateResponseWithValidation,
    PostOut,
    SignupRequest,
    TokenResponse,
    UserOut,
    VoteRequest,
    ValidationResult,
)
from .validation import validate_post_content


app = FastAPI(title="Voicestand API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def compute_locality_code(lat: float, lon: float) -> str:
    # Coarse bucket (~1km) for hackathon demo.
    return f"{round(lat, settings.locality_decimals)}_{round(lon, settings.locality_decimals)}"


def _to_utc_aware(ts: dt.datetime) -> dt.datetime:
    """
    SQLite commonly returns naive datetimes even if SQLAlchemy models are declared with timezone=True.
    Normalize to timezone-aware UTC so comparisons don't crash.
    """
    if ts.tzinfo is None:
        return ts.replace(tzinfo=dt.timezone.utc)
    return ts.astimezone(dt.timezone.utc)


def require_active_user(user: User) -> None:
    if user.dismissed:
        raise HTTPException(status_code=403, detail="Account dismissed")
    if is_user_suspended(user):
        raise HTTPException(status_code=403, detail="Account suspended")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(sub)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _finalize_reporter_for_wrong(db: Session, reporter: User, now: dt.datetime) -> None:
    # Wrong post penalties.
    reporter.coins = max(0, reporter.coins - 50)
    reporter.wrong_streak = reporter.wrong_streak + 1
    reporter.wrong_total = reporter.wrong_total + 1

    if reporter.wrong_streak >= 5:
        reporter.suspended_until = now + dt.timedelta(days=7)
    if reporter.wrong_total >= 10:
        reporter.dismissed = True


def _finalize_reporter_for_legit(db: Session, reporter: User) -> None:
    # Reset streak on any legit post.
    reporter.wrong_streak = 0


def finalize_expired_posts(db: Session) -> None:
    # Runs on every feed/detail request so we don't need an external scheduler.
    now = dt.datetime.now(dt.timezone.utc)
    pending_posts = db.query(Post).filter(Post.moderation_status == "pending").all()
    if not pending_posts:
        return

    for post in pending_posts:
        if _to_utc_aware(post.expires_at) > now:
            continue
        reporter = db.query(User).filter(User.id == post.reporter_id).first()
        if reporter is None:
            continue

        # Decision at expiry.
        if post.upvotes_count >= post.downvotes_count:
            post.moderation_status = "legit"
            post.hidden = False
            _finalize_reporter_for_legit(db, reporter)
        else:
            post.moderation_status = "wrong"
            post.hidden = True
            _finalize_reporter_for_wrong(db, reporter, now)

    db.commit()


def apply_hide_rule_on_vote(post: Post) -> None:
    # Don't hide during voting. Posts stay visible for 5 hours.
    # Only hide based on final moderation_status (legit/wrong).
    if post.moderation_status != "pending":
        post.hidden = post.moderation_status == "wrong"
        return
    # Keep post visible during 5-hour window regardless of votes


def map_post_out(post: Post, reporter_email: str) -> PostOut:
    flags: list[str] | None = None
    if post.validation_flags_json:
        try:
            parsed = json.loads(post.validation_flags_json)
            if isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
                flags = parsed
        except Exception:
            flags = None

    return PostOut(
        id=post.id,
        reporter_id=post.reporter_id,
        reporter_email=reporter_email,
        text=post.text,
        image_path=post.image_path,
        lat=post.lat,
        lon=post.lon,
        locality_code=post.locality_code,
        created_at=post.created_at,
        expires_at=post.expires_at,
        upvotes_count=post.upvotes_count,
        downvotes_count=post.downvotes_count,
        hidden=post.hidden,
        moderation_status=post.moderation_status,
        negative_comments_count=post.negative_comments_count,
        validation_matches=post.validation_matches,
        validation_confidence=post.validation_confidence,
        validation_reasoning=post.validation_reasoning,
        validation_flags=flags,
    )


UPLOAD_DIR = settings.upload_dir


@app.on_event("startup")
def on_startup() -> None:
    init_db()

    # Minimal SQLite migration for newly added validation columns.
    # (SQLAlchemy `create_all` won't add columns to an existing table.)
    if settings.database_url.startswith("sqlite"):
        with engine.begin() as conn:
            existing = conn.execute(text("PRAGMA table_info(posts)")).fetchall()
            existing_cols = {row[1] for row in existing}  # row[1] == column name

            def ensure_col(col_name: str, ddl_fragment: str) -> None:
                if col_name in existing_cols:
                    return
                conn.execute(text(f"ALTER TABLE posts ADD COLUMN {ddl_fragment}"))

            ensure_col("validation_matches", "validation_matches INTEGER")
            ensure_col("validation_confidence", "validation_confidence REAL")
            ensure_col("validation_reasoning", "validation_reasoning TEXT")
            ensure_col("validation_flags_json", "validation_flags_json TEXT")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Serve uploaded files.
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.post("/auth/signup", response_model=TokenResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")
    user = User(email=req.email, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@app.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@app.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        coins=current_user.coins,
        wrong_streak=current_user.wrong_streak,
        wrong_total=current_user.wrong_total,
        suspended_until=current_user.suspended_until,
        dismissed=current_user.dismissed,
        locality_code=current_user.locality_code,
    )


@app.post("/me/location", response_model=UserOut)
def update_location(
    update: LocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    current_user.current_lat = update.lat
    current_user.current_lon = update.lon
    current_user.locality_code = compute_locality_code(update.lat, update.lon)
    current_user.location_updated_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(current_user)
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        coins=current_user.coins,
        wrong_streak=current_user.wrong_streak,
        wrong_total=current_user.wrong_total,
        suspended_until=current_user.suspended_until,
        dismissed=current_user.dismissed,
        locality_code=current_user.locality_code,
    )


@app.get("/feed", response_model=list[PostOut])
def feed(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PostOut]:
    finalize_expired_posts(db)

    if not current_user.locality_code:
        return []

    posts = (
        db.query(Post)
        .filter(
            and_(
                Post.locality_code == current_user.locality_code,
                Post.hidden == False,  # noqa: E712
            )
        )
        .order_by(Post.created_at.desc())
        .limit(100)
        .all()
    )

    out: list[PostOut] = []
    for p in posts:
        reporter = db.query(User).filter(User.id == p.reporter_id).first()
        reporter_email = reporter.email if reporter else "unknown@example.com"
        out.append(map_post_out(p, reporter_email))
    return out


@app.post("/posts", response_model=PostCreateResponseWithValidation)
def create_post(
    text: str = Form(...),
    image: UploadFile | None = File(None),
    lat: float | None = Form(None),
    lon: float | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostCreateResponseWithValidation:
    require_active_user(current_user)

    # Basic coins gate (hackathon friendly).
    if current_user.coins < 50:
        raise HTTPException(status_code=403, detail="Not enough coins to post")

    if lat is None or lon is None:
        if current_user.current_lat is None or current_user.current_lon is None:
            raise HTTPException(status_code=400, detail="Location required")
        lat = current_user.current_lat
        lon = current_user.current_lon

    locality_code = compute_locality_code(lat, lon)

    image_path = None
    if image is not None:
        ext = os.path.splitext(image.filename or "")[1].lower() or ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(image.file.read())
        image_path = f"/uploads/{filename}"

    now = dt.datetime.now(dt.timezone.utc)
    post = Post(
        reporter_id=current_user.id,
        text=text,
        image_path=image_path,
        lat=lat,
        lon=lon,
        locality_code=locality_code,
        created_at=now,
        expires_at=now + dt.timedelta(hours=settings.post_ttl_hours),
    )

    # Ensure we store latest user location on new posts.
    current_user.current_lat = lat
    current_user.current_lon = lon
    current_user.locality_code = locality_code
    current_user.location_updated_at = now

    # Validate post content if image is provided.
    # If it doesn't match, BLOCK the post from being created.
    validation_result: ValidationResult | None = None
    if image_path:
        validation_data = validate_post_content(image_path, text)
        validation_result = ValidationResult(**validation_data)

        # Store validation result regardless of match
        post.validation_matches = validation_result.matches
        post.validation_confidence = validation_result.confidence
        post.validation_reasoning = validation_result.reasoning
        post.validation_flags_json = json.dumps(validation_result.flags)

        # If validation fails, hide the post from feed but still save it
        if not validation_result.matches:
            post.hidden = True
            post.moderation_status = "wrong"  # Mark as validation failure
    else:
        # No image provided, still mark validation fields
        post.validation_matches = None
        post.validation_confidence = None
        post.validation_reasoning = "No image provided"
        post.validation_flags_json = json.dumps(["no_image"])

    db.add(post)
    db.commit()
    db.refresh(post)

    # If post was flagged (validation failed), update user reputation
    if post.validation_matches is False:
        current_user.wrong_total += 1
        current_user.wrong_streak += 1
        # Suspend if 5 consecutive wrong posts
        if current_user.wrong_streak >= 5:
            suspend_until = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=7)
            current_user.suspended_until = suspend_until
        # Dismiss if 10 total wrong posts
        if current_user.wrong_total >= 10:
            current_user.dismissed = True
        db.commit()

    return PostCreateResponseWithValidation(post_id=post.id, validation=validation_result)


@app.get("/posts/{post_id}", response_model=dict)
def post_detail(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    finalize_expired_posts(db)

    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Hidden posts are only visible to reporter.
    if post.hidden and post.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Post hidden")

    reporter = db.query(User).filter(User.id == post.reporter_id).first()
    reporter_email = reporter.email if reporter else "unknown@example.com"

    comments = (
        db.query(Comment).filter(Comment.post_id == post.id).order_by(Comment.created_at.asc()).all()
    )

    return {
        "post": map_post_out(post, reporter_email),
        "comments": [
            CommentOut(
                id=c.id,
                user_id=c.user_id,
                text=c.text,
                is_negative=c.is_negative,
                created_at=c.created_at,
            ).model_dump()
            for c in comments
        ],
    }


@app.post("/posts/{post_id}/vote", response_model=PostOut)
def vote_on_post(
    post_id: int,
    req: VoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostOut:
    require_active_user(current_user)

    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Once hidden or finalized, votes no longer affect moderation.
    if post.hidden or post.moderation_status != "pending":
        raise HTTPException(status_code=403, detail="Voting closed for this post")

    now = dt.datetime.now(dt.timezone.utc)
    if _to_utc_aware(post.expires_at) <= now:
        raise HTTPException(status_code=403, detail="Voting closed for this post")

    new_value = 1 if req.vote == "up" else -1
    existing = db.query(PostVote).filter(
        and_(PostVote.post_id == post.id, PostVote.user_id == current_user.id)
    ).first()

    if existing and existing.value == new_value:
        # Idempotent: no change.
        reporter = db.query(User).filter(User.id == post.reporter_id).first()
        return map_post_out(post, reporter.email if reporter else "unknown@example.com")

    if existing:
        # Switch vote.
        if existing.value == 1:
            post.upvotes_count = max(0, post.upvotes_count - 1)
        else:
            post.downvotes_count = max(0, post.downvotes_count - 1)
        existing.value = new_value
    else:
        existing = PostVote(post_id=post.id, user_id=current_user.id, value=new_value)
        db.add(existing)

    if new_value == 1:
        post.upvotes_count += 1
    else:
        post.downvotes_count += 1

    apply_hide_rule_on_vote(post)
    db.commit()

    reporter = db.query(User).filter(User.id == post.reporter_id).first()
    return map_post_out(post, reporter.email if reporter else "unknown@example.com")


@app.post("/posts/{post_id}/comments", response_model=PostOut)
def comment_on_post(
    post_id: int,
    req: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostOut:
    require_active_user(current_user)

    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.hidden or post.moderation_status != "pending":
        raise HTTPException(status_code=403, detail="Commenting closed for this post")
    if _to_utc_aware(post.expires_at) <= dt.datetime.now(dt.timezone.utc):
        raise HTTPException(status_code=403, detail="Commenting closed for this post")

    c = Comment(post_id=post.id, user_id=current_user.id, text=req.text, is_negative=req.is_negative)
    db.add(c)
    if req.is_negative:
        post.negative_comments_count += 1
    db.commit()

    reporter = db.query(User).filter(User.id == post.reporter_id).first()
    return map_post_out(post, reporter.email if reporter else "unknown@example.com")


@app.get("/debug/posts/{post_id}")
def debug_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Debug endpoint to check post status and timings"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    now = dt.datetime.now(dt.timezone.utc)
    expires_at_aware = _to_utc_aware(post.expires_at)
    time_remaining = expires_at_aware - now
    
    return {
        "post_id": post.id,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "expires_at": post.expires_at.isoformat() if post.expires_at else None,
        "current_time": now.isoformat(),
        "time_remaining_seconds": time_remaining.total_seconds(),
        "has_expired": time_remaining.total_seconds() <= 0,
        "upvotes": post.upvotes_count,
        "downvotes": post.downvotes_count,
        "hidden": post.hidden,
        "moderation_status": post.moderation_status,
        "validation_matches": post.validation_matches,
    }


@app.get("/me/posts", response_model=list[PostOut])
def my_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PostOut]:
    finalize_expired_posts(db)
    posts = (
        db.query(Post)
        .filter(Post.reporter_id == current_user.id)
        .order_by(Post.created_at.desc())
        .limit(100)
        .all()
    )
    out: list[PostOut] = []
    for p in posts:
        out.append(map_post_out(p, current_user.email))
    return out


# Debug endpoint (remove in production)
@app.get("/debug/posts/{post_id}")
def debug_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        return {"error": "Not found"}
    
    now = dt.datetime.now(dt.timezone.utc)
    expires_at_aware = _to_utc_aware(post.expires_at)
    is_expired = expires_at_aware <= now
    
    return {
        "id": post.id,
        "text": post.text[:50],
        "hidden": post.hidden,
        "moderation_status": post.moderation_status,
        "upvotes": post.upvotes_count,
        "downvotes": post.downvotes_count,
        "created_at": post.created_at,
        "expires_at": post.expires_at,
        "expires_at_aware": expires_at_aware,
        "now_utc": now,
        "is_expired": is_expired,
        "time_remaining_seconds": (expires_at_aware - now).total_seconds(),
    }
