from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlmodel import Session, select
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from core.database import get_session
from core.models import User, SessionModel
from core.security import verify_password, get_password_hash, generate_session_id
from core.auth import get_current_user
from core.limiter import limiter
from itsdangerous import URLSafeTimedSerializer
from core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_reset_serializer = URLSafeTimedSerializer(settings.SECRET_KEY)

from typing import Optional
from core.models import User, SessionModel, InviteCode

class LoginRequest(BaseModel):
    username: str
    password: str
    invite_code: Optional[str] = None

@router.post("/register")
@limiter.limit("5/minute")
def register(request: Request, register_data: LoginRequest, db: Session = Depends(get_session)):
    # Check if this is the first user
    user_count = db.exec(select(User)).all()
    is_first_user = len(user_count) == 0

    if not is_first_user:
        if not register_data.invite_code:
            raise HTTPException(status_code=400, detail="Invite code required for registration")
        
        invite = db.exec(select(InviteCode).where(InviteCode.code == register_data.invite_code)).first()
        if not invite or invite.is_used:
            raise HTTPException(status_code=400, detail="Invalid or already used invite code")

    user = db.exec(select(User).where(User.username == register_data.username)).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    new_user = User(
        username=register_data.username,
        password_hash=get_password_hash(register_data.password),
        is_admin=is_first_user
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if not is_first_user and register_data.invite_code:
        invite.is_used = True
        invite.used_by = new_user.id
        db.add(invite)
        db.commit()
    
    return {"message": "User created successfully. You can now log in."}

@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, response: Response, login_data: LoginRequest, db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.username == login_data.username)).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    session_id = generate_session_id()
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)
    
    session_db = SessionModel(
        session_id=session_id,
        user_id=user.id,
        expires_at=expires_at
    )
    db.add(session_db)
    db.commit()
    
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=os.environ.get("COOKIE_SECURE", "true").lower() == "true",
        max_age=7 * 24 * 60 * 60
    )
    return {"message": "Logged in successfully"}

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_session)):
    session_id = request.cookies.get("session_id")
    if session_id:
        session_db = db.exec(select(SessionModel).where(SessionModel.session_id == session_id)).first()
        if session_db:
            db.delete(session_db)
            db.commit()
    response.delete_cookie("session_id")
    return {"message": "Logged out successfully"}

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password")
def change_password(
    request: Request,
    response: Response,
    pwd_data: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    if not verify_password(pwd_data.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect old password"
        )
        
    user.password_hash = get_password_hash(pwd_data.new_password)
    db.add(user)
    
    # Revoke all sessions for this user
    sessions = db.exec(select(SessionModel).where(SessionModel.user_id == user.id)).all()
    for s in sessions:
        db.delete(s)
        
    db.commit()
    response.delete_cookie("session_id")
    
    return {"message": "Password changed successfully. All sessions revoked. Please log in again."}

class ForgotPasswordRequest(BaseModel):
    identifier: str

@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_session)):
    import logging
    logger = logging.getLogger("sentiq.auth")
    
    # Check username or email
    user = db.exec(select(User).where((User.username == data.identifier) | (User.email == data.identifier))).first()
    if not user:
        # Prevent user enumeration by returning success anyway
        return {"message": "If that account exists, a reset link has been sent."}
    
    token = pwd_reset_serializer.dumps({"user_id": user.id}, salt="password-reset-salt")
    
    # Terminal-logging fallback (since SMTP is disabled)
    logger.warning("="*50)
    logger.warning(f"PASSWORD RESET REQUESTED FOR {user.username}")
    logger.warning(f"RESET LINK: {settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}")
    logger.warning("="*50)
    
    return {"message": "If that account exists, a reset link has been sent."}

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
@limiter.limit("3/minute")
def reset_password(request: Request, data: ResetPasswordRequest, db: Session = Depends(get_session)):
    from itsdangerous import BadSignature, SignatureExpired
    try:
        payload = pwd_reset_serializer.loads(data.token, salt="password-reset-salt", max_age=3600)
    except SignatureExpired:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token expired")
    except BadSignature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
        
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload")
        
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    user.password_hash = get_password_hash(data.new_password)
    db.add(user)
    
    # Revoke all sessions for this user
    sessions = db.exec(select(SessionModel).where(SessionModel.user_id == user.id)).all()
    for s in sessions:
        db.delete(s)
        
    db.commit()
    return {"message": "Password has been reset successfully. You can now log in."}

class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    profile_pic: str | None = None

@router.put("/profile")
def update_profile(
    profile_data: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    if profile_data.full_name is not None:
        user.full_name = profile_data.full_name.strip()
    if profile_data.profile_pic is not None:
        user.profile_pic = profile_data.profile_pic
    db.add(user)
    db.commit()
    return {"message": "Profile updated successfully"}

@router.get("/usage")
def get_usage(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    from core.models import UsageLog
    logs = db.exec(select(UsageLog).where(UsageLog.user_id == user.id)).all()
    
    total_cost = sum(log.cost for log in logs)
    total_prompt = sum(log.prompt_tokens for log in logs)
    total_completion = sum(log.completion_tokens for log in logs)
    
    return {
        "total_cost": total_cost,
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_tokens": total_prompt + total_completion
    }

@router.get("/me")
def get_me(request: Request, user: User = Depends(get_current_user)):
    return {
        "id": user.id, 
        "username": user.username, 
        "is_admin": user.is_admin,
        "profile_pic": user.profile_pic,
        "full_name": user.full_name,
        "auth_provider": user.auth_provider,
        "ws_token": request.cookies.get("session_id")
    }

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
)
import json
import uuid

# In-memory store for challenges
webauthn_challenges = {}

RP_ID = "localhost"
RP_NAME = "Sentiq.AI"
ORIGIN = "http://127.0.0.1:8000"

@router.get("/webauthn/register/options")
def webauthn_register_options(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_name=user.username,
        user_id=str(user.id).encode("utf-8"),
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    
    # Store challenge
    webauthn_challenges[f"reg_{user.id}"] = options.challenge
    return json.loads(options_to_json(options))

@router.post("/webauthn/register/verify")
async def webauthn_register_verify(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    response_data = await request.json()
    from core.models import PasskeyCredential
    expected_challenge = webauthn_challenges.get(f"reg_{user.id}")
    if not expected_challenge:
        raise HTTPException(status_code=400, detail="No challenge found")

    try:
        verification = verify_registration_response(
            credential=response_data,
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verification failed: {e}")
    
    # Remove challenge
    del webauthn_challenges[f"reg_{user.id}"]
    
    credential = PasskeyCredential(
        credential_id=verification.credential_id.hex(),
        public_key=verification.credential_public_key,
        sign_count=verification.sign_count,
        user_id=user.id
    )
    db.add(credential)
    db.commit()
    
    return {"message": "Passkey registered successfully!"}

@router.get("/webauthn/login/options")
def webauthn_login_options():
    options = generate_authentication_options(
        rp_id=RP_ID,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    
    challenge_id = str(uuid.uuid4())
    webauthn_challenges[f"auth_{challenge_id}"] = options.challenge
    
    out = json.loads(options_to_json(options))
    out["challenge_id"] = challenge_id
    return out

@router.post("/webauthn/login/verify")
async def webauthn_login_verify(request: Request, response: Response, db: Session = Depends(get_session)):
    payload = await request.json()
    from core.models import PasskeyCredential
    challenge_id = payload.get("challenge_id")
    response_data = payload.get("data")
    
    expected_challenge = webauthn_challenges.get(f"auth_{challenge_id}")
    if not expected_challenge:
        raise HTTPException(status_code=400, detail="No challenge found")
        
    credential_id_hex = response_data.get("id")
    credential_db = db.exec(select(PasskeyCredential).where(PasskeyCredential.credential_id == credential_id_hex)).first()
    if not credential_db:
        raise HTTPException(status_code=400, detail="Credential not registered")

    try:
        verification = verify_authentication_response(
            credential=response_data,
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=credential_db.public_key,
            credential_current_sign_count=credential_db.sign_count,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verification failed: {e}")
        
    # Update sign count
    credential_db.sign_count = verification.new_sign_count
    db.add(credential_db)
    
    user = db.exec(select(User).where(User.id == credential_db.user_id)).first()
    
    session_id = generate_session_id()
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)
    
    session_db = SessionModel(
        session_id=session_id,
        user_id=user.id,
        expires_at=expires_at
    )
    db.add(session_db)
    db.commit()
    
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=os.environ.get("COOKIE_SECURE", "true").lower() == "true",
        max_age=7 * 24 * 60 * 60
    )
    
    if f"auth_{challenge_id}" in webauthn_challenges:
        del webauthn_challenges[f"auth_{challenge_id}"]
        
    return {"message": "Logged in via Passkey!"}

import os
import httpx
from fastapi.responses import RedirectResponse
import json

from dotenv import load_dotenv
load_dotenv(override=True)

GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'https://sentiq-ai.vercel.app/auth/google/callback')

@router.get('/google/login')
def google_login():
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail='Google Client ID not configured')
    
    scopes = [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar',
        'https://mail.google.com/'
    ]
    
    auth_url = (
        f'https://accounts.google.com/o/oauth2/v2/auth'
        f'?client_id={GOOGLE_CLIENT_ID}'
        f'&redirect_uri={GOOGLE_REDIRECT_URI}'
        f'&response_type=code'
        f'&scope={"%20".join(scopes)}'
        f'&access_type=offline'
        f'&prompt=consent'
    )
    return RedirectResponse(auth_url)

@router.get('/google/callback')
async def google_callback(code: str, response: Response, db: Session = Depends(get_session)):
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

    if not code:
        raise HTTPException(status_code=400, detail='Authorization code not found')
        
    token_url = 'https://oauth2.googleapis.com/token'
    data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code'
    }
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(token_url, data=data)
        token_json = token_response.json()
        
        if 'error' in token_json:
            raise HTTPException(status_code=400, detail=f"Google Auth Error: {token_json.get('error_description', token_json.get('error'))}")
            
        access_token = token_json.get('access_token')
        refresh_token = token_json.get('refresh_token')
        expires_in = token_json.get('expires_in', 3599)
        
        # Get user info
        user_info_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_info_response = await client.get(user_info_url, headers=headers)
        user_info = user_info_response.json()
        
    email = user_info.get('email')
    if not email:
        raise HTTPException(status_code=400, detail='Email not provided by Google')
        
    target_email = os.environ.get('ADMIN_LINK_EMAIL')
    
    # Check if user with this email exists
    user = db.exec(select(User).where(User.email == email)).first()
    if not user:
        # Check if the username matches the email (legacy or combined)
        user = db.exec(select(User).where(User.username == email)).first()
        
    if not user and target_email and email == target_email:
        # Check if admin exists to link
        user = db.exec(select(User).where(User.username == 'admin')).first()
        if user:
            user.email = email
            user.auth_provider = 'google'
            db.add(user)
            
    full_name = user_info.get('name')
    profile_pic = user_info.get('picture')
    
    if not user:
        # Create new user
        user = User(
            username=email.split('@')[0] + '_google',
            email=email,
            auth_provider='google',
            password_hash=get_password_hash(access_token[:10]), # Dummy hash for google users
            full_name=full_name,
            profile_pic=profile_pic
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    # Update email and profile in user model if not set or outdated
    updated = False
    if user.email != email:
        user.email = email
        user.auth_provider = 'google'
        updated = True
    if full_name and user.full_name != full_name:
        user.full_name = full_name
        updated = True
    if profile_pic and user.profile_pic != profile_pic:
        user.profile_pic = profile_pic
        updated = True
        
    if updated:
        db.add(user)
        db.commit()
    # Save Calendar Tokens
    from core.models import CalendarAccount
    from core.security import encrypt_string
    calendar_account = db.exec(select(CalendarAccount).where(CalendarAccount.user_id == user.id)).first()
    if not calendar_account:
        calendar_account = CalendarAccount(user_id=user.id, caldav_url="", username="", encrypted_password="")
        db.add(calendar_account)
    
    calendar_account.access_token = encrypt_string(access_token)
    if refresh_token:
        calendar_account.refresh_token = encrypt_string(refresh_token)
    calendar_account.token_expires_at = int(datetime.now(timezone.utc).timestamp()) + expires_in
    
    # Save Email Tokens
    from core.models import EmailAccount
    email_account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user.id)).first()
    if not email_account:
        email_account = EmailAccount(
            user_id=user.id,
            imap_host='imap.gmail.com',
            smtp_host='smtp.gmail.com',
            username=email,
            encrypted_password=""
        )
        db.add(email_account)
        
    email_account.access_token = encrypt_string(access_token)
    if refresh_token:
        email_account.refresh_token = encrypt_string(refresh_token)
    email_account.token_expires_at = int(datetime.now(timezone.utc).timestamp()) + expires_in
    email_account.username = email
    
    db.commit()
    
    # Create Session
    session_id = generate_session_id()
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)
    session_db = SessionModel(
        session_id=session_id,
        user_id=user.id,
        expires_at=expires_at
    )
    db.add(session_db)
    db.commit()
    
    # Set Cookie and Redirect to App
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173/')
    response = RedirectResponse(url=frontend_url)
    
    cookie_expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    response.set_cookie(
        key='session_id',
        value=session_id,
        httponly=True,
        samesite='lax',
        secure=os.environ.get("COOKIE_SECURE", "true").lower() == "true",
        expires=cookie_expires_at
    )
    
    return response


from typing import Optional

class AccountUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None

@router.put("/me/account")
def update_account(data: AccountUpdate, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    if data.username and data.username != user.username:
        existing = db.exec(select(User).where(User.username == data.username)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username is already taken")
        user.username = data.username
        
    if data.email and data.email != user.email:
        existing = db.exec(select(User).where(User.email == data.email)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email is already in use")
        user.email = data.email
        
    db.add(user)
    db.commit()
    return {"message": "Account updated successfully"}

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

@router.put("/me/password")
def update_password(data: PasswordUpdate, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    user.password_hash = get_password_hash(data.new_password)
    db.add(user)
    db.commit()
    
    from core.audit import log_event
    log_event(db, user.id, "password_changed", {})
    return {"message": "Password updated successfully"}

@router.delete("/me")
def delete_my_account(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    from core.auth import cascade_delete_user
    from fastapi.responses import JSONResponse
    import os
    session_id = request.cookies.get("session_id")
    
    cascade_delete_user(db, user)
    
    response = JSONResponse(content={"message": "Account deleted successfully"})
    if session_id:
        response.delete_cookie(
            key="session_id",
            httponly=True,
            samesite="lax",
            secure=os.environ.get("COOKIE_SECURE", "true").lower() == "true"
        )
    return response
