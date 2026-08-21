import secrets
import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def generate_session_id():
    return secrets.token_urlsafe(32)

def generate_random_password(length=16):
    return secrets.token_urlsafe(length)

import os
from cryptography.fernet import Fernet
from core.config import settings

import hashlib
import base64

def get_encryption_key():
    key = settings.ENCRYPTION_KEY
    if not key:
        key = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="
    
    try:
        # Check if it's a valid Fernet key
        decoded = base64.urlsafe_b64decode(key.encode())
        if len(decoded) == 32:
            return key.encode()
    except Exception:
        pass
        
    # If not a valid Fernet key, derive one deterministically
    digest = hashlib.sha256(key.encode()).digest()
    return base64.urlsafe_b64encode(digest)

def encrypt_string(plaintext: str) -> str:
    if not plaintext:
        return plaintext
    f = Fernet(get_encryption_key())
    try:
        f.decrypt(plaintext.encode())
        return plaintext # Already encrypted
    except Exception:
        return f.encrypt(plaintext.encode()).decode()

def decrypt_string(ciphertext: str) -> str:
    if not ciphertext:
        return ciphertext
    f = Fernet(get_encryption_key())
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        return ciphertext # Plaintext
