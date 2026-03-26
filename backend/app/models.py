from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Float,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

    coins = Column(Integer, default=1000, nullable=False)
    wrong_streak = Column(Integer, default=0, nullable=False)
    wrong_total = Column(Integer, default=0, nullable=False)

    suspended_until = Column(DateTime(timezone=True), nullable=True)
    dismissed = Column(Boolean, default=False, nullable=False)

    current_lat = Column(Float, nullable=True)
    current_lon = Column(Float, nullable=True)
    locality_code = Column(String(64), index=True, nullable=True)
    location_updated_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc)
    )

    posts = relationship("Post", back_populates="reporter")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reporter_id = Column(ForeignKey("users.id"), index=True, nullable=False)

    text = Column(Text, nullable=False)
    image_path = Column(String(512), nullable=True)

    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    locality_code = Column(String(64), index=True, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: dt.datetime.now(dt.timezone.utc),
        index=True,
        nullable=False,
    )
    expires_at = Column(DateTime(timezone=True), index=True, nullable=False)

    upvotes_count = Column(Integer, default=0, nullable=False)
    downvotes_count = Column(Integer, default=0, nullable=False)

    # Whether hidden from community feed.
    hidden = Column(Boolean, default=False, nullable=False, index=True)

    # "pending" until expiry, then "legit" or "wrong".
    moderation_status = Column(String(16), default="pending", nullable=False, index=True)

    negative_comments_count = Column(Integer, default=0, nullable=False)

    # Claude validation results (image <-> description).
    # Stored as text/JSON so we can render explanations later in Profile.
    validation_matches = Column(Boolean, nullable=True)
    validation_confidence = Column(Float, nullable=True)
    validation_reasoning = Column(Text, nullable=True)
    # JSON stringified list[str]
    validation_flags_json = Column(Text, nullable=True)

    reporter = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post")


class PostVote(Base):
    __tablename__ = "post_votes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(ForeignKey("posts.id"), index=True, nullable=False)
    user_id = Column(ForeignKey("users.id"), index=True, nullable=False)

    # +1 for upvote, -1 for downvote
    value = Column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_user_vote"),)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(ForeignKey("posts.id"), index=True, nullable=False)
    user_id = Column(ForeignKey("users.id"), index=True, nullable=False)

    text = Column(Text, nullable=False)
    is_negative = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc), index=True
    )

    post = relationship("Post", back_populates="comments")

