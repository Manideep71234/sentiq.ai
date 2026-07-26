from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlmodel import Session, select
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from core.database import get_session
from core.models import User, SessionModel
from core.security import verify_password, get_password_hash, generate_session_id
from core.auth import get_current_user
from core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/register")
@limiter.limit("5/minute")
def register(request: Request, register_data: LoginRequest, db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.username == register_data.username)).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    new_user = User(
        username=register_data.username,
        password_hash=get_password_hash(register_data.password),
        is_admin=False
    )
    db.add(new_user)
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

@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "is_admin": user.is_admin}

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
        max_age=7 * 24 * 60 * 60
    )
    
    if f"auth_{challenge_id}" in webauthn_challenges:
        del webauthn_challenges[f"auth_{challenge_id}"]
        
    return {"message": "Logged in via Passkey!"}
