from typing import Optional
from .openai_compat import OpenAICompatProvider
from core.config import settings
from core.models import UserSettings

def get_provider(provider_name: str, user_settings: Optional[UserSettings] = None):
    if provider_name.lower() == "groq":
        api_key = user_settings.groq_api_key if user_settings and user_settings.groq_api_key else settings.GROQ_API_KEY
        return OpenAICompatProvider("https://api.groq.com/openai/v1", api_key)
    elif provider_name.lower() == "ollama":
        return OpenAICompatProvider(f"{settings.OLLAMA_BASE_URL}/v1", "ollama")
    elif provider_name.lower() == "openrouter":
        api_key = user_settings.openrouter_api_key if user_settings and user_settings.openrouter_api_key else settings.OPENROUTER_API_KEY
        return OpenAICompatProvider("https://openrouter.ai/api/v1", api_key)
    else:
        raise ValueError(f"Unknown provider: {provider_name}")
