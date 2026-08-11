import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "replace_this_with_a_secure_key_in_production")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "12345678901234567890123456789012") # Must be 32 bytes
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///sentiq.db")
    
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    MAX_TOKENS_PER_REQUEST: int = int(os.getenv("MAX_TOKENS_PER_REQUEST", "4096"))
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

if not settings.SECRET_KEY or settings.SECRET_KEY == "":
    settings.SECRET_KEY = "replace_this_with_a_secure_key_in_production"
if not settings.ENCRYPTION_KEY or settings.ENCRYPTION_KEY == "":
    # Fernet requires a 32-byte url-safe base64-encoded key
    settings.ENCRYPTION_KEY = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="
