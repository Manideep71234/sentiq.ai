from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import edge_tts
import uuid
import os
from core.database import get_session
from core.models import User
from core.auth import get_current_user

router = APIRouter(prefix="/studio", tags=["studio"])

class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"

@router.post("/tts")
async def generate_tts(req: TTSRequest, user: User = Depends(get_current_user)):
    try:
        filename = f"{uuid.uuid4()}.mp3"
        filepath = os.path.join("data", "audio", filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        communicate = edge_tts.Communicate(req.text, req.voice)
        await communicate.save(filepath)
        
        return {"url": f"/studio/audio/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/audio/{filename}")
async def get_audio(filename: str, user: User = Depends(get_current_user)):
    filepath = os.path.join("data", "audio", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(filepath, media_type="audio/mpeg")
