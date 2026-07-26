import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "replace_me_with_a_secure_random_string_in_production")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///sentiq.db")
    
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
