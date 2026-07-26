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
    
    return user

def get_current_user_optional(request: Request, db: Session = Depends(get_session)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
        
    session_db = db.exec(select(SessionModel).where(SessionModel.session_id == session_id)).first()
    if not session_db or session_db.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        return None
        
    user = db.exec(select(User).where(User.id == session_db.user_id)).first()
    return user
