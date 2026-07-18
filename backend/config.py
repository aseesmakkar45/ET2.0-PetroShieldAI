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
    AISSTREAM_API_KEY: str = "e4786c9a683aa6cb7d494388cb21a2c96923d092"
    EIA_API_KEY: str = ""
    NEWSAPI_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEYS: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Setup key rotation pool
import itertools
_api_keys = []
if settings.GEMINI_API_KEYS:
    _api_keys = [k.strip() for k in settings.GEMINI_API_KEYS.split(",") if k.strip()]
if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY not in _api_keys:
    _api_keys.insert(0, settings.GEMINI_API_KEY)

_key_cycle = itertools.cycle(_api_keys) if _api_keys else None

def get_gemini_api_key() -> str:
    """Returns the next Gemini API key in the rotation pool."""
    if _key_cycle:
        return next(_key_cycle)
    return settings.GEMINI_API_KEY
