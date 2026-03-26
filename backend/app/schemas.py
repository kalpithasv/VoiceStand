import datetime as dt
from typing import Literal

from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    coins: int
    wrong_streak: int
    wrong_total: int
    suspended_until: dt.datetime | None
    dismissed: bool
    locality_code: str | None


class LocationUpdate(BaseModel):
    lat: float
    lon: float


class VoteRequest(BaseModel):
    vote: Literal["up", "down"]


class CommentCreate(BaseModel):
    text: str
    is_negative: bool = False


class PostCreateResponse(BaseModel):
    post_id: int


class ValidationResult(BaseModel):
    matches: bool
    confidence: float
    reasoning: str
    flags: list[str]


class PostCreateResponseWithValidation(BaseModel):
    post_id: int
    validation: ValidationResult | None = None


class PostOut(BaseModel):
    id: int
    reporter_id: int
    reporter_email: EmailStr
    text: str
    image_path: str | None
    lat: float
    lon: float
    locality_code: str
    created_at: dt.datetime
    expires_at: dt.datetime
    upvotes_count: int
    downvotes_count: int
    hidden: bool
    moderation_status: str
    negative_comments_count: int

    validation_matches: bool | None = None
    validation_confidence: float | None = None
    validation_reasoning: str | None = None
    validation_flags: list[str] | None = None


class CommentOut(BaseModel):
    id: int
    user_id: int
    text: str
    is_negative: bool
    created_at: dt.datetime

