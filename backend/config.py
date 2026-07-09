from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    APP_NAME: str = "PetroShield AI"
    DEBUG: bool = True
    SECRET_KEY: str = "petroshield-secret-key"
    DATABASE_URL: str = "sqlite:///./petroshield.db"
    DEMO_MODE: bool = True
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    WS_HOST: str = "localhost"
    WS_PORT: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
