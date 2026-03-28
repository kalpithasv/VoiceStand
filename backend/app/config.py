from typing import List
import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Look for .env in backend dir (where config.py is) or current dir
    _env_file = None
    if os.path.exists("backend/.env"):
        _env_file = "backend/.env"
    elif os.path.exists(".env"):
        _env_file = ".env"
    
    model_config = SettingsConfigDict(
        env_file=_env_file if _env_file else ".env",
        extra="ignore"
    )

    # MySQL compatible (TiDB Cloud Zero returns MySQL 8-compatible URLs)
    database_url: str = "sqlite:///./dev.db"

    jwt_secret: str = "dev-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    post_ttl_hours: int = 5
    locality_decimals: int = 2

    upload_dir: str = "./uploads"
    # Validation model provider for image/text matching.
    # Supported: "agnes", "anthropic"
    validation_provider: str = "agnes"
    agnes_api_key: str = ""
    # ZenMux expects model IDs in "<provider>/<model_name>" format.
    agnes_model: str = "sapiens-ai/agnes-1.5-pro"
    agnes_base_url: str = "https://zenmux.ai/api/v1"
    agnes_chat_completions_url: str = ""
    anthropic_api_key: str = ""

    cors_origins: str = "http://localhost:19006,http://localhost:3000"

    # OpenClaw Integrations
    bright_data_api_key: str = ""
    mem9_api_key: str = ""
    mem9_endpoint: str = "https://api.mem9.io/v1"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

