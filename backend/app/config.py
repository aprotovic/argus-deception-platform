"""Application configuration loaded from environment variables."""

from pathlib import Path
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Core Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Security Secrets
    SECRET_KEY: str = "argus_default_dev_secret_key_change_in_production_32b_min"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Server-side secret for HMAC password fingerprinting (NEVER store plaintext passwords)
    ARGUS_PASSWORD_FINGERPRINT_SECRET: str = "argus_hmac_fingerprint_salt_secret_change_in_prod"

    # Ingestion Token for mutual Decoy-to-Backend authentication
    INTERNAL_INGESTION_TOKEN: str = "argus_internal_decoy_token_secret_replace_in_prod"

    # Database Settings
    DATABASE_URL: str = "postgresql+asyncpg://argus_user:argus_secure_password@localhost:5432/argus_telemetry"
    
    # Quarantine Storage Settings
    QUARANTINE_STORAGE_DIR: str = "./data/quarantine"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB limit
    MAX_QUARANTINE_QUOTA_BYTES: int = 500 * 1024 * 1024  # 500 MB total quota
    ALLOWED_UPLOAD_EXTENSIONS: str = ".log,.txt,.dmp,.bin,.tar,.gz,.zip,.png,.pdf,.conf,.sh,.exe,.dll,.py,.js,.php"

    # CORS Settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # Rate Limiting
    DECOY_RATE_LIMIT_REQUESTS: int = 60  # max requests per window
    DECOY_RATE_LIMIT_WINDOW_SECONDS: int = 60  # 1 minute window

    # Initial Admin Seed
    ADMIN_USERNAME: str = "argus_admin"
    ADMIN_EMAIL: str = "admin@argus-defense.local"
    ANALYST_PASSWORD: str = ""  # Set via ANALYST_PASSWORD env var
    ADMIN_PASSWORD: str = ""  # Set via ADMIN_PASSWORD env var

    # Decoy Split — Event Forwarding
    BACKEND_INGEST_URL: str = "http://argus-backend:8000"
    DECOY_SPOOL_DIR: str = "/tmp/argus_decoy_spool"
    DECOY_SPOOL_MAX_BYTES: int = 100 * 1024 * 1024  # 100 MB
    DEFAULT_DECOY_ID: str = "00000000-0000-0000-0000-000000000001"

    # MySQL Protocol Decoy
    MYSQL_DECOY_PORT: int = 3306
    MYSQL_DECOY_VERSION_STRING: str = "8.0.36-0ubuntu0.22.04.1"
    MYSQL_DECOY_BAIT_CREDENTIALS: str = "[]"   # JSON: [{"username":"root","password":"..."}]
    MYSQL_DECOY_HANDSHAKE_TIMEOUT: float = 10.0   # seconds: TCP connect → login packet
    MYSQL_DECOY_IDLE_TIMEOUT: float = 30.0        # seconds: per-command idle after login
    MYSQL_DECOY_MAX_CONNECTIONS: int = 100         # 201st is closed immediately
    MYSQL_DECOY_SPOOL_DIR: str = "/tmp/argus_mysql_decoy_spool"

    @property
    def quarantine_path(self) -> Path:
        p = Path(self.QUARANTINE_STORAGE_DIR).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
