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
    gemini_api_key: Optional[str] = None

class APIKeysResponse(BaseModel):
    has_groq: bool
    has_openrouter: bool
    has_gemini: bool
    groq_masked: Optional[str] = None
    openrouter_masked: Optional[str] = None
    gemini_masked: Optional[str] = None

def mask_key(key: str) -> str:
    if not key: return None
    key = key.strip()
    if len(key) <= 8: return "****"
    return f"{key[:4]}{'*' * 15}{key[-4:]}"

@router.get("/api-keys", response_model=APIKeysResponse)
def get_api_keys(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    settings = db.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if not settings:
        return APIKeysResponse(has_groq=False, has_openrouter=False, has_gemini=False)
    
    from core.security import decrypt_string
    groq_plain = decrypt_string(settings.groq_api_key) if settings.groq_api_key else None
    or_plain = decrypt_string(settings.openrouter_api_key) if settings.openrouter_api_key else None
    gemini_plain = decrypt_string(settings.gemini_api_key) if settings.gemini_api_key else None
    
    return APIKeysResponse(
        has_groq=bool(settings.groq_api_key),
        has_openrouter=bool(settings.openrouter_api_key),
        has_gemini=bool(settings.gemini_api_key),
        groq_masked=mask_key(groq_plain),
        openrouter_masked=mask_key(or_plain),
        gemini_masked=mask_key(gemini_plain)
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

    # Validate Gemini Key if provided
    if keys.gemini_api_key:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={keys.gemini_api_key.strip()}"
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid Gemini API Key")

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
            
    if keys.gemini_api_key is not None:
        if keys.gemini_api_key == "":
            settings.gemini_api_key = None
        else:
            settings.gemini_api_key = encrypt_string(keys.gemini_api_key.strip())
            
    settings.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    
    from core.audit import log_event
    if keys.groq_api_key is not None:
        if keys.groq_api_key == "":
            log_event(db, user.id, "api_key_removed", {"provider": "groq"})
        else:
            log_event(db, user.id, "api_key_added", {"provider": "groq"})
            
    if keys.openrouter_api_key is not None:
        if keys.openrouter_api_key == "":
            log_event(db, user.id, "api_key_removed", {"provider": "openrouter"})
        else:
            log_event(db, user.id, "api_key_added", {"provider": "openrouter"})
            
    if keys.gemini_api_key is not None:
        if keys.gemini_api_key == "":
            log_event(db, user.id, "api_key_removed", {"provider": "gemini"})
        else:
            log_event(db, user.id, "api_key_added", {"provider": "gemini"})
    
    return {"message": "API keys saved and validated successfully."}

@router.get("/export-data")
def export_user_data(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    import json
    import io
    import zipfile
    from fastapi.responses import StreamingResponse
    from core.models import ChatSession, ChatMessage, Document, MemoryEntry, ScheduledTask
    
    data = {}
    data["profile"] = {"username": user.username, "email": user.email, "full_name": user.full_name}
    
    sessions = db.exec(select(ChatSession).where(ChatSession.user_id == user.id)).all()
    chats = []
    for s in sessions:
        messages = db.exec(select(ChatMessage).where(ChatMessage.session_id == s.id)).all()
        chats.append({
            "id": s.id, "title": s.title, "created_at": s.created_at.isoformat(),
            "messages": [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in messages]
        })
    data["chats"] = chats
    
    docs = db.exec(select(Document).where(Document.user_id == user.id)).all()
    data["documents"] = [{"id": d.id, "title": d.title, "content": d.content, "type": d.doc_type} for d in docs]
    
    notes = db.exec(select(MemoryEntry).where(MemoryEntry.user_id == user.id)).all()
    data["notes"] = [{"id": n.id, "content": n.content, "created_at": n.created_at.isoformat()} for n in notes]
    
    json_str = json.dumps(data, indent=2)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        zip_file.writestr("sentiq_export.json", json_str)
        
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=sentiq_export_{user.username}.zip"}
    )

@router.delete("/account")
def delete_account(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    from sqlalchemy import text
    from fastapi.responses import JSONResponse
    from core.models import ChatSession

    uid = {"uid": user.id}
    db.exec(text("DELETE FROM sessionmodel WHERE user_id = :uid"), uid)
    db.exec(text("DELETE FROM usersettings WHERE user_id = :uid"), uid)
    
    sessions = db.exec(select(ChatSession).where(ChatSession.user_id == user.id)).all()
    for s in sessions:
        db.exec(text("DELETE FROM chatmessage WHERE session_id = :sid"), {"sid": s.id})
        
    db.exec(text("DELETE FROM chatsession WHERE user_id = :uid"), uid)
    db.exec(text("DELETE FROM document WHERE user_id = :uid"), uid)
    db.exec(text("DELETE FROM documentversion WHERE document_id IN (SELECT id FROM document WHERE user_id = :uid)"), uid)
    db.exec(text("DELETE FROM memoryentry WHERE user_id = :uid"), uid)
    db.exec(text("DELETE FROM scheduledtask WHERE user_id = :uid"), uid)
    db.exec(text("DELETE FROM taskresult WHERE scheduled_task_id IN (SELECT id FROM scheduledtask WHERE user_id = :uid)"), uid)
    db.exec(text("DELETE FROM skill WHERE user_id = :uid"), uid)
    db.exec(text("DELETE FROM emailaccount WHERE user_id = :uid"), uid)
    
    db.exec(text("DELETE FROM user WHERE id = :uid"), uid)
    db.commit()
    
    response = JSONResponse(content={"message": "Account deleted successfully"})
    response.delete_cookie("session_id")
    return response
