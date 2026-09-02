from typing import List, Optional, Union
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Core Application
    PROJECT_NAME: str = "StartupAI Manager"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    # Security & JWT
    SECRET_KEY: str = "startupai-manager-dev-secret-key-change-in-production-2026-argon2"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def validate_production_secret_key(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production":
            if "change-in-production" in v or len(v) < 32:
                raise ValueError("CRITICAL SECURITY ERROR: Default or weak SECRET_KEY is prohibited in production.")
        return v

    # Database
    DATABASE_URL: str = "sqlite:///./startup_ai.db"

    # Optional Redis
    REDIS_URL: Optional[str] = None

    # AI Configuration
    AI_PROVIDER_DEFAULT: str = "mock"
    GEMINI_API_KEY: Optional[str] = ""
    OPENAI_API_KEY: Optional[str] = ""
    ANTHROPIC_API_KEY: Optional[str] = ""
    MAX_TOKENS_PER_REQUEST: int = 4000
    MAX_AGENT_ITERATIONS: int = 10
    AI_REQUEST_TIMEOUT_SECONDS: int = 30
    WORKSPACE_MONTHLY_AI_BUDGET: float = 100.0

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100


settings = Settings()
