from .openai_compat import OpenAICompatProvider
from core.config import settings

def get_provider(provider_name: str):
    if provider_name.lower() == "groq":
        # Groq uses the same endpoint structure as OpenAI
        return OpenAICompatProvider("https://api.groq.com/openai/v1", settings.GROQ_API_KEY)
    elif provider_name.lower() == "ollama":
        # Ollama's openai compatible endpoint
        return OpenAICompatProvider(f"{settings.OLLAMA_BASE_URL}/v1", "ollama")
    elif provider_name.lower() == "openrouter":
        return OpenAICompatProvider("https://openrouter.ai/api/v1", settings.OPENROUTER_API_KEY)
    else:
        raise ValueError(f"Unknown provider: {provider_name}")
