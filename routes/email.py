from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, EmailAccount, EmailThreadCache
from core.auth import get_current_user
from core.security import encrypt_string, decrypt_string
from core.integrations.email_client import fetch_inbox, send_email
from core.providers import get_provider
from datetime import datetime, timezone

router = APIRouter(prefix="/email", tags=["email"])

import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config

config = Config('.env')
oauth = OAuth(config)

oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile https://mail.google.com/'
    }
)

@router.get("/auth/google/login")
async def google_login(request: Request):
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        raise HTTPException(status_code=400, detail="Google Client ID not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.")
        
    redirect_uri = request.url_for('google_callback')
    # If developing locally on a port, sometimes request.url_for gives http://localhost:8000/
    # Ensure it's absolute. It should be by default.
    return await oauth.google.authorize_redirect(request, str(redirect_uri))

@router.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_session)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")
        
    userinfo = token.get('userinfo')
    if not userinfo:
        raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        
    email_address = userinfo.get('email')
    
    # We must identify the current user using the standard mechanism.
    # However, OAuth callback usually doesn't send Authorization headers.
    # We need to rely on the session cookie.
    session_id = request.cookies.get("session_id")
    if not session_id:
        # Fallback redirect to login
        return RedirectResponse(url="/?error=session_expired")
        
    from core.models import SessionModel, User
    session_db = db.exec(select(SessionModel).where(SessionModel.session_id == session_id)).first()
    if not session_db:
        return RedirectResponse(url="/?error=session_invalid")
        
    user_id = session_db.user_id
    
    # Save to EmailAccount
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user_id)).first()
    if not account:
        account = EmailAccount(
            user_id=user_id,
            imap_host="imap.gmail.com",
            imap_port=993,
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            username=email_address
        )
        db.add(account)
        
    account.username = email_address
    account.access_token = token.get("access_token")
    account.refresh_token = token.get("refresh_token")
    account.token_expires_at = token.get("expires_at")
    
    # Ensure we are pointing to Google
    account.imap_host = "imap.gmail.com"
    account.smtp_host = "smtp.gmail.com"
    
    db.commit()
    
    return RedirectResponse(url="/?tab=email&status=connected")

@router.get("/account")
def get_account(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user.id)).first()
    if account:
        return {
            "id": account.id,
            "imap_host": account.imap_host,
            "imap_port": account.imap_port,
            "smtp_host": account.smtp_host,
            "smtp_port": account.smtp_port,
            "username": account.username,
            "has_oauth": bool(account.access_token)
        }
    return None

@router.post("/account")
def save_account(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user.id)).first()
    
    if not account:
        account = EmailAccount(user_id=user.id, **{k: v for k, v in data.items() if k != 'password'})
        db.add(account)
    else:
        account.imap_host = data.get("imap_host", account.imap_host)
        account.imap_port = data.get("imap_port", account.imap_port)
        account.smtp_host = data.get("smtp_host", account.smtp_host)
        account.smtp_port = data.get("smtp_port", account.smtp_port)
        account.username = data.get("username", account.username)
        # Clear OAuth tokens if they switch back to password
        account.access_token = None
        account.refresh_token = None
        account.token_expires_at = None
        
    if "password" in data and data["password"]:
        account.encrypted_password = encrypt_string(data["password"])
        
    db.commit()
    return {"status": "success"}

@router.get("/inbox")
def get_inbox(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user.id)).first()
    if not account:
        raise HTTPException(status_code=400, detail="Email account not configured")
        
    try:
        password = decrypt_string(account.encrypted_password) if account.encrypted_password else None
        threads = fetch_inbox(account.imap_host, account.imap_port, account.username, password, account.access_token)
        
        # Hydrate with cache
        for t in threads:
            cache = db.exec(select(EmailThreadCache).where(
                EmailThreadCache.email_account_id == account.id,
                EmailThreadCache.thread_id == t["thread_id"]
            )).first()
            if cache:
                t["summary"] = cache.summary
                t["triage_tag"] = cache.triage_tag
                
        return threads
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send")
def send_reply(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user.id)).first()
    if not account:
        raise HTTPException(status_code=400, detail="Email account not configured")
        
    try:
        password = decrypt_string(account.encrypted_password) if account.encrypted_password else None
        send_email(
            account.smtp_host, 
            account.smtp_port, 
            account.username, 
            password, 
            data["to_addr"], 
            data["subject"], 
            data["body"], 
            data.get("in_reply_to"),
            account.access_token
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _generate_llm_response(prompt: str, user: User) -> str:
    # Use standard provider logic
    provider = get_provider("openrouter")
    messages = [{"role": "user", "content": prompt}]
    result = ""
    async for chunk in provider.stream(messages, "openrouter/free"):
        if chunk.choices and len(chunk.choices) > 0:
            result += chunk.choices[0].delta.content or ""
    return result

@router.post("/thread/{thread_id}/ai-summary")
async def generate_summary(thread_id: str, data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user.id)).first()
    if not account:
        raise HTTPException(status_code=400, detail="No account")
        
    thread_content = data.get("thread_content", "")
    prompt = f"Summarize the following email thread in 1-2 short sentences:\n\n{thread_content}"
    
    summary = await _generate_llm_response(prompt, user)
    
    cache = db.exec(select(EmailThreadCache).where(EmailThreadCache.email_account_id == account.id, EmailThreadCache.thread_id == thread_id)).first()
    if not cache:
        cache = EmailThreadCache(email_account_id=account.id, thread_id=thread_id)
        db.add(cache)
        
    cache.summary = summary
    cache.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    
    return {"summary": summary}

@router.post("/thread/{thread_id}/triage")
async def generate_triage(thread_id: str, data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user.id)).first()
    if not account:
        raise HTTPException(status_code=400, detail="No account")
        
    thread_content = data.get("thread_content", "")
    prompt = f"Categorize the following email thread into EXACTLY ONE of these tags: 'Needs Reply', 'FYI', or 'Low Priority'. Output nothing else but the exact tag string.\n\n{thread_content}"
    
    tag = (await _generate_llm_response(prompt, user)).strip()
    # clean tag just in case
    valid_tags = ["Needs Reply", "FYI", "Low Priority"]
    final_tag = "Low Priority"
    for v in valid_tags:
        if v.lower() in tag.lower():
            final_tag = v
            break
    
    cache = db.exec(select(EmailThreadCache).where(EmailThreadCache.email_account_id == account.id, EmailThreadCache.thread_id == thread_id)).first()
    if not cache:
        cache = EmailThreadCache(email_account_id=account.id, thread_id=thread_id)
        db.add(cache)
        
    cache.triage_tag = final_tag
    cache.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    
    return {"triage_tag": final_tag}

@router.post("/thread/{thread_id}/draft")
async def generate_draft(thread_id: str, data: dict, user: User = Depends(get_current_user)):
    thread_content = data.get("thread_content", "")
    user_instruction = data.get("instruction", "Write a polite reply.")
    
    prompt = f"Write an email reply for the following thread. The user's instruction is: '{user_instruction}'. Do not output any preamble or formatting, just the raw email text ready to send.\n\nThread:\n{thread_content}"
    
    draft = await _generate_llm_response(prompt, user)
    return {"draft": draft}
