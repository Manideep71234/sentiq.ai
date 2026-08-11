from fastapi import Request, Depends, HTTPException, status
from sqlmodel import Session, select
from datetime import datetime, timezone
from .database import get_session
from .models import SessionModel, User

def get_current_user(request: Request, db: Session = Depends(get_session)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    session_db = db.exec(select(SessionModel).where(SessionModel.session_id == session_id)).first()
    if not session_db or session_db.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid"
        )
    
    user = db.exec(select(User).where(User.id == session_db.user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    return user

def get_current_user_optional(request: Request, db: Session = Depends(get_session)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
        
    session_db = db.exec(select(SessionModel).where(SessionModel.session_id == session_id)).first()
    if not session_db or session_db.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        return None
        
    user = db.exec(select(User).where(User.id == session_db.user_id)).first()
    if user and not user.is_active:
        return None
    return user

def get_admin_user(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user

def cascade_delete_user(db: Session, user: User):
    from core.models import (
        AuditLog, SessionModel, PasskeyCredential, ChatSession, ChatMessage,
        Skill, MemoryEntry, ResearchReport, UserSettings, Document, DocumentVersion,
        EmailAccount, EmailThreadCache, CalendarAccount, Note, Task, ScheduledTask, TaskResult
    )
    user_id = user.id
    
    chat_sessions = db.exec(select(ChatSession).where(ChatSession.user_id == user_id)).all()
    for cs in chat_sessions:
        messages = db.exec(select(ChatMessage).where(ChatMessage.session_id == cs.id)).all()
        for m in messages:
            db.delete(m)
        db.delete(cs)
        
    docs = db.exec(select(Document).where(Document.user_id == user_id)).all()
    for d in docs:
        versions = db.exec(select(DocumentVersion).where(DocumentVersion.document_id == d.id)).all()
        for v in versions:
            db.delete(v)
        db.delete(d)
        
    emails = db.exec(select(EmailAccount).where(EmailAccount.user_id == user_id)).all()
    for e in emails:
        caches = db.exec(select(EmailThreadCache).where(EmailThreadCache.email_account_id == e.id)).all()
        for c in caches:
            db.delete(c)
        db.delete(e)
        
    scheduled_tasks = db.exec(select(ScheduledTask).where(ScheduledTask.user_id == user_id)).all()
    for st in scheduled_tasks:
        results = db.exec(select(TaskResult).where(TaskResult.scheduled_task_id == st.id)).all()
        for r in results:
            db.delete(r)
        db.delete(st)
        
    flat_tables = [
        (SessionModel, SessionModel.user_id),
        (PasskeyCredential, PasskeyCredential.user_id),
        (Skill, Skill.user_id),
        (MemoryEntry, MemoryEntry.user_id),
        (ResearchReport, ResearchReport.user_id),
        (UserSettings, UserSettings.user_id),
        (CalendarAccount, CalendarAccount.user_id),
        (Note, Note.user_id),
        (Task, Task.user_id),
        (AuditLog, AuditLog.user_id)
    ]
    
    for model, condition in flat_tables:
        records = db.exec(select(model).where(condition == user_id)).all()
        for r in records:
            db.delete(r)
            
    db.delete(user)
    db.commit()
