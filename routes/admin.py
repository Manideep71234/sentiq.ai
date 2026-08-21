import time
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, desc
from typing import List, Optional
from pydantic import BaseModel

from core.database import get_session
from core.models import (
    User, AuditLog, SessionModel, PasskeyCredential, ChatSession, ChatMessage,
    Skill, MemoryEntry, ResearchReport, UserSettings, Document, DocumentVersion,
    EmailAccount, EmailThreadCache, CalendarAccount, Note, Task, ScheduledTask, TaskResult,
    InviteCode
)
from core.auth import get_admin_user
from core.audit import log_event

router = APIRouter(prefix="/admin", tags=["admin"])

START_TIME = time.time()

class SystemStatusResponse(BaseModel):
    uptime_seconds: float
    db_ok: bool
    groq_ok: bool
    openrouter_ok: bool

@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(admin: User = Depends(get_admin_user), db: Session = Depends(get_session)):
    db_ok = True
    try:
        db.exec(select(User).limit(1)).first()
    except Exception:
        db_ok = False
        
    groq_ok = False
    openrouter_ok = False
    
    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            # We don't need auth to ping these endpoints, we just want to see if the domains are reachable
            r = await client.get("https://api.groq.com/openai/v1/models")
            groq_ok = r.status_code in (200, 401)
        except Exception:
            pass
            
        try:
            r = await client.get("https://openrouter.ai/api/v1/auth/key")
            openrouter_ok = r.status_code in (200, 401)
        except Exception:
            pass
            
    return SystemStatusResponse(
        uptime_seconds=time.time() - START_TIME,
        db_ok=db_ok,
        groq_ok=groq_ok,
        openrouter_ok=openrouter_ok
    )

@router.get("/audit-logs")
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    event_type: Optional[str] = None,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_session)
):
    query = select(AuditLog)
    if event_type:
        query = query.where(AuditLog.event_type == event_type)
        
    query = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
    logs = db.exec(query).all()
    
    total = db.exec(select(AuditLog)).all()
    
    results = []
    for log in logs:
        user_name = "System/Unknown"
        if log.user_id:
            u = db.exec(select(User).where(User.id == log.user_id)).first()
            if u:
                user_name = u.username
                
        results.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": user_name,
            "event_type": log.event_type,
            "metadata_json": log.metadata_json,
            "created_at": log.created_at
        })
        
    return {"logs": results, "total": len(total)}

@router.get("/users")
def get_users(admin: User = Depends(get_admin_user), db: Session = Depends(get_session)):
    users = db.exec(select(User).order_by(desc(User.created_at))).all()
    return [{
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "auth_provider": u.auth_provider,
        "is_admin": u.is_admin,
        "is_active": u.is_active,
        "created_at": u.created_at,
        "last_login": u.last_login,
        "full_name": u.full_name
    } for u in users]

class UserStatusUpdate(BaseModel):
    is_active: bool

@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: int, 
    status_update: UserStatusUpdate,
    admin: User = Depends(get_admin_user), 
    db: Session = Depends(get_session)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")
        
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = status_update.is_active
    db.add(user)
    
    if not status_update.is_active:
        sessions = db.exec(select(SessionModel).where(SessionModel.user_id == user_id)).all()
        for s in sessions:
            db.delete(s)
            
    db.commit()
    log_event(db, admin.id, "account_disabled" if not status_update.is_active else "account_enabled", {"target_user_id": user_id})
    return {"message": "User status updated"}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_session)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    from core.auth import cascade_delete_user
    cascade_delete_user(db, user)
    
    log_event(db, admin.id, "account_deleted", {"target_username": user.username})
    
    return {"message": "User and all associated data permanently deleted"}

import uuid

@router.get("/invites")
def get_invites(admin: User = Depends(get_admin_user), db: Session = Depends(get_session)):
    invites = db.exec(select(InviteCode).order_by(desc(InviteCode.created_at))).all()
    results = []
    for inv in invites:
        results.append({
            "id": inv.id,
            "code": inv.code,
            "is_used": inv.is_used,
            "created_at": inv.created_at,
            "used_by": inv.used_by
        })
    return results

@router.post("/invites")
def create_invite(admin: User = Depends(get_admin_user), db: Session = Depends(get_session)):
    code_str = str(uuid.uuid4())[:8].upper()
    invite = InviteCode(code=code_str, created_by=admin.id)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    log_event(db, admin.id, "invite_created", {"code": code_str})
    return {"id": invite.id, "code": invite.code}
