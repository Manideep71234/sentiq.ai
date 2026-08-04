import os
import sys

# Ensure project root is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from core.database import engine
from core.models import CalendarAccount, EmailAccount, UserSettings
from core.security import encrypt_string, decrypt_string

def migrate():
    with Session(engine) as db:
        print("Migrating Calendar Accounts...")
        cals = db.exec(select(CalendarAccount)).all()
        for cal in cals:
            if cal.access_token:
                try:
                    # check if already encrypted
                    decrypt_string(cal.access_token)
                except Exception:
                    # not encrypted
                    cal.access_token = encrypt_string(cal.access_token)
            if cal.refresh_token:
                try:
                    decrypt_string(cal.refresh_token)
                except Exception:
                    cal.refresh_token = encrypt_string(cal.refresh_token)
            db.add(cal)
        
        print("Migrating Email Accounts...")
        emails = db.exec(select(EmailAccount)).all()
        for email in emails:
            if email.access_token:
                try:
                    decrypt_string(email.access_token)
                except Exception:
                    email.access_token = encrypt_string(email.access_token)
            if email.refresh_token:
                try:
                    decrypt_string(email.refresh_token)
                except Exception:
                    email.refresh_token = encrypt_string(email.refresh_token)
            db.add(email)

        print("Migrating User Settings API Keys...")
        settings_all = db.exec(select(UserSettings)).all()
        for s in settings_all:
            if s.groq_api_key:
                try:
                    decrypt_string(s.groq_api_key)
                except Exception:
                    s.groq_api_key = encrypt_string(s.groq_api_key)
            if s.openrouter_api_key:
                try:
                    decrypt_string(s.openrouter_api_key)
                except Exception:
                    s.openrouter_api_key = encrypt_string(s.openrouter_api_key)
            db.add(s)

        db.commit()
        print("Migration completed successfully.")

if __name__ == "__main__":
    if not os.getenv("ENCRYPTION_KEY"):
        print("Error: ENCRYPTION_KEY environment variable is not set.")
        sys.exit(1)
    migrate()
