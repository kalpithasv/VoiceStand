from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
    agnes_model: str = "openai/gpt-4o-mini"
    agnes_base_url: str = "https://api.agnesai.io/v1"
    agnes_chat_completions_url: str = ""
    anthropic_api_key: str = ""

    cors_origins: str = "http://localhost:19006,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

