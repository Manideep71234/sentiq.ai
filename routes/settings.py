from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
import httpx
from datetime import datetime, timezone

from core.database import get_session
from core.models import User, UserSettings
from core.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

class APIKeysUpdate(BaseModel):
    groq_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None

class APIKeysResponse(BaseModel):
    has_groq: bool
    has_openrouter: bool
    groq_masked: Optional[str] = None
    openrouter_masked: Optional[str] = None

def mask_key(key: str) -> str:
    if not key: return None
    key = key.strip()
    if len(key) <= 8: return "****"
    return f"{key[:4]}{'*' * 15}{key[-4:]}"

@router.get("/api-keys", response_model=APIKeysResponse)
def get_api_keys(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    settings = db.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if not settings:
        return APIKeysResponse(has_groq=False, has_openrouter=False)
    
    from core.security import decrypt_string
    groq_plain = decrypt_string(settings.groq_api_key) if settings.groq_api_key else None
    or_plain = decrypt_string(settings.openrouter_api_key) if settings.openrouter_api_key else None
    
    return APIKeysResponse(
        has_groq=bool(settings.groq_api_key),
        has_openrouter=bool(settings.openrouter_api_key),
        groq_masked=mask_key(groq_plain),
        openrouter_masked=mask_key(or_plain)
    )

@router.post("/api-keys")
async def update_api_keys(keys: APIKeysUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    # Validate Groq Key if provided
    if keys.groq_api_key:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {keys.groq_api_key.strip()}"}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid Groq API Key")

    # Validate OpenRouter Key if provided
    if keys.openrouter_api_key:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/auth/key",
                headers={"Authorization": f"Bearer {keys.openrouter_api_key.strip()}"}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid OpenRouter API Key")

    # Save to database
    settings = db.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
    
    from core.security import encrypt_string
    if keys.groq_api_key is not None:
        if keys.groq_api_key == "":
            settings.groq_api_key = None
        else:
            settings.groq_api_key = encrypt_string(keys.groq_api_key.strip())
            
    if keys.openrouter_api_key is not None:
        if keys.openrouter_api_key == "":
            settings.openrouter_api_key = None
        else:
            settings.openrouter_api_key = encrypt_string(keys.openrouter_api_key.strip())
            
    settings.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    
    return {"message": "API keys saved and validated successfully."}
