from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
from core.models import Document, DocumentVersion

def create_snapshot_if_needed(session: Session, document: Document, force: bool = False):
    """
    Creates a new DocumentVersion snapshot if forced, or if the last snapshot 
    was created more than 5 minutes ago.
    """
    if not document.id:
        return
        
    last_version = session.exec(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document.id)
        .order_by(DocumentVersion.created_at.desc())
    ).first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    should_snapshot = force
    
    if not last_version:
        should_snapshot = True
    elif not force:
        # Check if more than 5 minutes have passed
        time_diff = now - last_version.created_at
        if time_diff > timedelta(minutes=5):
            should_snapshot = True
            
        # Also, don't snapshot if the content hasn't actually changed since the last snapshot
        if last_version.content == document.content:
            should_snapshot = False
            
    if should_snapshot:
        new_version = DocumentVersion(
            document_id=document.id,
            content=document.content,
            created_at=now
        )
        session.add(new_version)
        session.commit()
