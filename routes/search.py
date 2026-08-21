from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, or_
from core.database import get_session
from core.models import User, ChatSession, ChatMessage, Document, Note
from core.auth import get_current_user

router = APIRouter(prefix="/search", tags=["search"])

@router.get("/")
def global_search(
    q: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    search_term = f"%{q}%"
    results = []

    # Search Chats
    chat_sessions = db.exec(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .where(ChatSession.title.ilike(search_term))
        .limit(10)
    ).all()
    for cs in chat_sessions:
        results.append({
            "type": "chat",
            "id": cs.id,
            "title": cs.title,
            "snippet": f"Chat session matching '{q}'"
        })

    # Search Messages (to link back to chat)
    chat_messages = db.exec(
        select(ChatMessage)
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .where(ChatSession.user_id == user.id)
        .where(ChatMessage.content.ilike(search_term))
        .limit(10)
    ).all()
    
    for msg in chat_messages:
        # Avoid duplicating sessions if already added
        if not any(r["type"] == "chat" and r["id"] == msg.session_id for r in results):
            snippet = msg.content
            # Truncate snippet around match
            idx = snippet.lower().find(q.lower())
            if idx != -1:
                start = max(0, idx - 20)
                end = min(len(snippet), idx + 40)
                snippet = "..." + snippet[start:end].replace('\n', ' ') + "..."
            results.append({
                "type": "chat",
                "id": msg.session_id,
                "title": f"Message match",
                "snippet": snippet
            })

    # Search Documents
    documents = db.exec(
        select(Document)
        .where(Document.user_id == user.id)
        .where(or_(Document.title.ilike(search_term), Document.content.ilike(search_term)))
        .limit(10)
    ).all()
    for doc in documents:
        results.append({
            "type": "document",
            "id": doc.id,
            "title": doc.title,
            "snippet": f"Document matching '{q}'"
        })

    # Search Notes
    notes = db.exec(
        select(Note)
        .where(Note.user_id == user.id)
        .where(or_(Note.title.ilike(search_term), Note.content.ilike(search_term)))
        .limit(10)
    ).all()
    for note in notes:
        results.append({
            "type": "note",
            "id": note.id,
            "title": note.title,
            "snippet": f"Note matching '{q}'"
        })

    return results
