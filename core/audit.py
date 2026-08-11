import os
import json
import httpx
import logging
from sqlmodel import Session
from datetime import datetime, timezone
from core.models import AuditLog

logger = logging.getLogger(__name__)

def log_event(db: Session, user_id: int | None, event_type: str, metadata: dict | None = None):
    try:
        log = AuditLog(
            user_id=user_id,
            event_type=event_type,
            metadata_json=json.dumps(metadata) if metadata else None,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log audit event: {e}")
        db.rollback()

async def notify_admin(message: str):
    webhook_url = os.environ.get("ADMIN_WEBHOOK_URL")
    if not webhook_url:
        return
    
    try:
        async with httpx.AsyncClient() as client:
            # Assuming simple Discord or Slack compatible webhook for now
            await client.post(webhook_url, json={"content": message})
    except Exception as e:
        logger.error(f"Failed to send admin webhook: {e}")
