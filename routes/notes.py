from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, Note
from core.auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/notes", tags=["notes"])

@router.get("/")
def get_notes(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    return db.exec(select(Note).where(Note.user_id == user.id).order_by(Note.updated_at.desc())).all()

@router.post("/")
def create_note(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    note = Note(
        user_id=user.id,
        title=data.get("title", "Untitled Note"),
        body=data.get("body", ""),
        tags=data.get("tags")
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

@router.put("/{note_id}")
def update_note(note_id: int, data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    note = db.exec(select(Note).where(Note.id == note_id, Note.user_id == user.id)).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    if "title" in data: note.title = data["title"]
    if "body" in data: note.body = data["body"]
    if "tags" in data: note.tags = data["tags"]
    
    note.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(note)
    return note

@router.delete("/{note_id}")
def delete_note(note_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    note = db.exec(select(Note).where(Note.id == note_id, Note.user_id == user.id)).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    db.delete(note)
    db.commit()
    return {"status": "success"}
