from typing import Optional
from .openai_compat import OpenAICompatProvider
from .gemini import GeminiProvider
from core.config import settings
from core.models import UserSettings

def get_provider(provider_name: str, user_settings: Optional[UserSettings] = None):
    from core.security import decrypt_string
    
    def resolve_key(user_key_encrypted, env_key):
        key = None
        if user_key_encrypted:
            decrypted = decrypt_string(user_key_encrypted)
            if decrypted and decrypted.strip():
                key = decrypted.strip()
        if not key and env_key and env_key.strip():
            key = env_key.strip()
        return key

    if provider_name.lower() == "groq":
        api_key = resolve_key(user_settings.groq_api_key if user_settings else None, settings.GROQ_API_KEY)
        if not api_key:
            raise ValueError("Groq API key is missing. Please configure it in Settings.")
        return OpenAICompatProvider("https://api.groq.com/openai/v1", api_key)
        
    elif provider_name.lower() == "ollama":
        return OpenAICompatProvider(f"{settings.OLLAMA_BASE_URL}/v1", "ollama")
        
    elif provider_name.lower() == "lmstudio":
        # Using local LM Studio default endpoint if env not set
        lmstudio_url = getattr(settings, "LMSTUDIO_BASE_URL", "http://localhost:1234/v1")
        return OpenAICompatProvider(lmstudio_url, "lmstudio")
        
    elif provider_name.lower() == "openrouter":
        api_key = resolve_key(user_settings.openrouter_api_key if user_settings else None, settings.OPENROUTER_API_KEY)
        if not api_key:
            raise ValueError("OpenRouter API key is missing. Please configure it in Settings.")
        return OpenAICompatProvider("https://openrouter.ai/api/v1", api_key)
        
    elif provider_name.lower() == "gemini":
        if not settings.GEMINI_API_KEY:
            raise ValueError("Gemini API key is missing from environment.")
        return GeminiProvider(settings.GEMINI_API_KEY)
        
    else:
        raise ValueError(f"Unknown provider: {provider_name}")
