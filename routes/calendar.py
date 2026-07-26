from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, CalendarAccount
from core.auth import get_current_user
from core.security import encrypt_string, decrypt_string
from core.integrations.caldav_client import fetch_events, create_event
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/calendar", tags=["calendar"])

@router.get("/account")
def get_account(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(CalendarAccount).where(CalendarAccount.user_id == user.id)).first()
    if account:
        return {
            "id": account.id,
            "caldav_url": account.caldav_url,
            "username": account.username
        }
    return None

@router.post("/account")
def save_account(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(CalendarAccount).where(CalendarAccount.user_id == user.id)).first()
    
    if not account:
        account = CalendarAccount(user_id=user.id, **{k: v for k, v in data.items() if k != 'password'})
        db.add(account)
    else:
        account.caldav_url = data.get("caldav_url", account.caldav_url)
        account.username = data.get("username", account.username)
        
    if "password" in data and data["password"]:
        account.encrypted_password = encrypt_string(data["password"])
        
    db.commit()
    return {"status": "success"}

@router.get("/events")
def get_events(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(CalendarAccount).where(CalendarAccount.user_id == user.id)).first()
    if not account:
        raise HTTPException(status_code=400, detail="Calendar account not configured")
        
    try:
        password = decrypt_string(account.encrypted_password)
        # Fetch events for a +/- 30 day window to avoid overloading
        now = datetime.now()
        start = now - timedelta(days=30)
        end = now + timedelta(days=30)
        events = fetch_events(account.caldav_url, account.username, password, start_date=start, end_date=end)
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/events")
def add_event(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(CalendarAccount).where(CalendarAccount.user_id == user.id)).first()
    if not account:
        raise HTTPException(status_code=400, detail="Calendar account not configured")
        
    try:
        password = decrypt_string(account.encrypted_password)
        
        # Expecting ISO strings from the frontend
        start = datetime.fromisoformat(data["start"].replace('Z', '+00:00'))
        end = datetime.fromisoformat(data["end"].replace('Z', '+00:00'))
        
        create_event(account.caldav_url, account.username, password, start, end, data["summary"], data.get("description", ""))
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
