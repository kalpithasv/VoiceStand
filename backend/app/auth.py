import datetime as dt
from typing import Any

from jose import jwt
import bcrypt

from .config import settings
from .models import User


def hash_password(password: str) -> str:
    # bcrypt expects bytes + salt; storing as utf-8 string for DB portability.
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(subject: str | int, extra: dict[str, Any] | None = None) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    expire = now + dt.timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {"sub": str(subject), "iat": int(now.timestamp()), "exp": expire}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def is_user_suspended(user: User) -> bool:
    if user.dismissed:
        return True
    if user.suspended_until is None:
        return False
    return user.suspended_until > dt.datetime.now(dt.timezone.utc)

