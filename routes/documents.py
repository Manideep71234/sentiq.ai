import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, Document, DocumentVersion, SessionModel
from core.auth import get_current_user
from core.documents.versioning import create_snapshot_if_needed
from core.providers import get_provider

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
async def websocket_ai_edit(websocket: WebSocket, doc_id: int, db: Session = Depends(get_session)):
    await websocket.accept()
    
    user = await get_ws_user(websocket, db)
    if not user:
        await websocket.send_json({"error": "Authentication required"})
        await websocket.close()
        return

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
            provider = get_provider(provider_name)
            
            async for chunk in provider.stream(messages, model):
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        await websocket.send_json({"type": "content", "content": delta})
                        
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"error": str(e)})
