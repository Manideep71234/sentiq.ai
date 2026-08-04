import secrets
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def generate_session_id():
    return secrets.token_urlsafe(32)

def generate_random_password(length=16):
    return secrets.token_urlsafe(length)

import os
from cryptography.fernet import Fernet
from core.config import settings

def get_encryption_key():
    key = settings.ENCRYPTION_KEY
    if not key:
        raise ValueError("ENCRYPTION_KEY not set in environment")
    return key.encode()

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
