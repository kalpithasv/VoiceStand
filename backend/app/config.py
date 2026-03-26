import os
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # MySQL compatible (TiDB Cloud Zero returns MySQL 8-compatible URLs)
    database_url: str = os.environ.get("DATABASE_URL", "sqlite:///./dev.db")

    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-change-me")
    jwt_algorithm: str = os.environ.get("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(
        os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7))
    )

    post_ttl_hours: int = int(os.environ.get("POST_TTL_HOURS", "5"))
    locality_decimals: int = int(os.environ.get("LOCALITY_DECIMALS", "2"))

    upload_dir: str = os.environ.get("UPLOAD_DIR", "./uploads")

    cors_origins: List[str] = [
        o.strip()
        for o in os.environ.get("CORS_ORIGINS", "http://localhost:19006,http://localhost:3000").split(
            ","
        )
        if o.strip()
    ]


settings = Settings()

