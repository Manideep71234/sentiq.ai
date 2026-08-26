import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, Document, DocumentVersion, SessionModel, UserSettings
from core.auth import get_current_user
from core.documents.versioning import create_snapshot_if_needed
from core.providers import get_provider
from pydantic import BaseModel
import asyncio

class GenerateDocumentRequest(BaseModel):
    prompt: str
    provider: str = "openrouter"
    model: str = "openrouter/free"

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/")
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    docs = db.exec(
        select(Document)
        .where(Document.user_id == user.id)
        .order_by(Document.updated_at.desc())
    ).all()
    return docs

@router.post("/")
def create_document(doc_data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    new_doc = Document(
        user_id=user.id,
        title=doc_data.get("title", "Untitled Document"),
        doc_type=doc_data.get("doc_type", "markdown"),
        content=doc_data.get("content", "")
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    # Create initial snapshot
    create_snapshot_if_needed(db, new_doc, force=True)
    return new_doc

@router.post("/generate")
async def generate_document(req: GenerateDocumentRequest, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    user_settings = db.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    provider = get_provider(req.provider, user_settings)
    if not provider:
        raise HTTPException(status_code=400, detail="Invalid provider")
        
    system_prompt = "You are a professional document writer. Generate a document based on the user's prompt. Format the response entirely in clean HTML. Use semantic tags like <h1>, <h2>, <p>, <ul>, <li>, <table>, etc. Do not include markdown codeblocks like ```html, just return the raw HTML string."
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.prompt}
    ]
    
    full_content = ""
    try:
        async for chunk in provider.generate_stream(messages, model=req.model):
            if chunk.get("type") == "content":
                full_content += chunk.get("delta", "")
            elif "error" in chunk:
                if not full_content:
                    raise Exception(chunk.get("error"))
                break
                
        # Clean up any markdown blocks if the model ignored instructions
        content = full_content.strip()
        if content.startswith("```html"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        new_doc = Document(
            user_id=user.id,
            title="Generated Document",
            doc_type="html",
            content=content
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
        create_snapshot_if_needed(db, new_doc, force=True)
        
        return new_doc
    except Exception as e:
        import logging
        logging.error(f"Error generating document: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@router.get("/{doc_id}")
def get_document(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    doc = db.exec(select(Document).where(Document.id == doc_id, Document.user_id == user.id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.put("/{doc_id}")
def update_document(doc_id: int, doc_data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    doc = db.exec(select(Document).where(Document.id == doc_id, Document.user_id == user.id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if "title" in doc_data:
        doc.title = doc_data["title"]
    if "content" in doc_data:
        doc.content = doc_data["content"]
        
    doc.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(doc)
    
    # Auto snapshot if 5 mins passed or forced
    create_snapshot_if_needed(db, doc, force=doc_data.get("force_snapshot", False))
    return doc

@router.delete("/{doc_id}")
def delete_document(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    doc = db.exec(select(Document).where(Document.id == doc_id, Document.user_id == user.id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Delete associated versions first
    versions = db.exec(select(DocumentVersion).where(DocumentVersion.document_id == doc.id)).all()
    for v in versions:
        db.delete(v)
        
    db.delete(doc)
    db.commit()
    return {"status": "success"}

@router.get("/{doc_id}/versions")
def list_versions(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    # Verify ownership via join logic
    doc = db.exec(select(Document).where(Document.id == doc_id, Document.user_id == user.id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    versions = db.exec(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == doc.id)
        .order_by(DocumentVersion.created_at.desc())
    ).all()
    return versions

@router.post("/{doc_id}/versions/{version_id}/restore")
def restore_version(doc_id: int, version_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    doc = db.exec(select(Document).where(Document.id == doc_id, Document.user_id == user.id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    version = db.exec(select(DocumentVersion).where(DocumentVersion.id == version_id, DocumentVersion.document_id == doc.id)).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    # Snapshot current state before restoring
    create_snapshot_if_needed(db, doc, force=True)
    
    # Restore content
    doc.content = version.content
    doc.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(doc)
    
    # Create snapshot of newly restored state
    create_snapshot_if_needed(db, doc, force=True)
    return doc

# WebSocket Endpoint for AI Edits
async def get_ws_user(websocket: WebSocket, db: Session) -> User | None:
    session_id = websocket.cookies.get("session_id")
    if not session_id:
        return None
    session_db = db.exec(select(SessionModel).where(SessionModel.session_id == session_id)).first()
    if not session_db or session_db.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        return None
    user = db.exec(select(User).where(User.id == session_db.user_id)).first()
    return user

@router.websocket("/ws/{doc_id}")
async def websocket_ai_edit(websocket: WebSocket, doc_id: int):
    await websocket.accept()
    
    import os
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,https://sentiq-ai.vercel.app").split(",")
    origin = websocket.headers.get("origin")
    if origin:
        is_allowed = any(origin.strip() == o.strip() for o in allowed_origins) or origin.endswith(".vercel.app") or origin.startswith("http://localhost:")
        if not is_allowed:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
    from core.database import engine
    
    with Session(engine) as db:
        user = await get_ws_user(websocket, db)
        if not user:
            await websocket.send_json({"error": "Authentication required"})
            await websocket.close()
            return
            
        user_settings = db.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    
        doc = db.exec(select(Document).where(Document.id == doc_id, Document.user_id == user.id)).first()
        if not doc:
            await websocket.send_json({"error": "Document not found"})
            await websocket.close()
            return

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            selected_text = payload.get("selected_text")
            surrounding_context = payload.get("surrounding_context", "")
            instruction = payload.get("instruction", "Rewrite this.")
            provider_name = payload.get("provider", "openrouter")
            model = payload.get("model", "openrouter/free")
            
            if not selected_text:
                continue

            # Create AI Prompt
            prompt = f"""You are an expert AI editor assisting a user.
Instruction: {instruction}

Here is the surrounding context (for reference only, DO NOT output this):
... {surrounding_context} ...

Here is the exact selected text that you must replace/edit according to the instruction:
```
{selected_text}
```

Output ONLY the final replacement text. Do not output markdown code blocks unless the text itself should be inside a code block. Do not output conversational filler. Just the replacement text.
"""

            messages = [{"role": "user", "content": prompt}]
            provider = get_provider(provider_name, user_settings)
            
            try:
                async for chunk in provider.generate_stream(messages, model):
                    if chunk.get("type") == "content":
                        delta = chunk.get("delta", "")
                        if delta:
                            await websocket.send_json({"type": "content", "content": delta})
                    elif "error" in chunk:
                        await websocket.send_json({"error": chunk.get("error")})
                        break
                            
                await websocket.send_json({"type": "done"})
            except (WebSocketDisconnect, RuntimeError):
                pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"WebSocket Error: {e}", exc_info=True)
        try:
            await websocket.send_json({"error": "Something went wrong, please try again."})
        except:
            pass
