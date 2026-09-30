from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os

class Settings(BaseSettings):
    APP_NAME: str = "TexVantage AI"
    APP_ENV: str = os.getenv("APP_ENV", "development") # "development", "production", "test"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")
    API_PREFIX: str = "/api"
    
    # JWT Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "dev_jwt_secret_change_in_production_super_secure_key_12345")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # Database - SQL Server compatible models; SQLite for fast dev zero-setup
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./texvantage_dev.db")
    # Existing SQL Server schemas are managed outside this application.  SQLite is
    # the only supported auto-create target used by the isolated test/dev fallback.
    DATABASE_CONNECT_TIMEOUT_SECONDS: int = int(os.getenv("DATABASE_CONNECT_TIMEOUT_SECONDS", "10"))
    SEED_DEMO_DATA: bool = os.getenv("SEED_DEMO_DATA", "false").lower() in ("true", "1", "yes")
    
    # AI Provider configuration
    # Valid values: None (auto-select by environment), "gemini", "mock"
    AI_PROVIDER: Optional[str] = os.getenv("AI_PROVIDER", None)
    
    # Gemini AI (Backend only)
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # Demo accounts allowed for client presentation
    ENABLE_DEMO_SWITCHER: bool = os.getenv("ENABLE_DEMO_SWITCHER", "true" if os.getenv("APP_ENV", "development") == "development" else "false").lower() in ("true", "1", "yes")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
