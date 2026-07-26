import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, SessionModel, ChatSession, ChatMessage
from core.agents.agent import run_agent_loop
from core.auth import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])

# REST Endpoints
@router.post("/sessions")
def create_session(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    chat_session = ChatSession(user_id=user.id, title="New Chat")
    db.add(chat_session)
    db.commit()
    db.refresh(chat_session)
    return chat_session

@router.get("/sessions")
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    sessions = db.exec(select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.updated_at.desc())).all()
    return sessions

@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    session_obj = db.exec(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.exec(select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())).all()
    return messages

# WebSocket Endpoint
async def get_ws_user(websocket: WebSocket) -> User | None:
    session_id = websocket.cookies.get("session_id")
    if not session_id:
        return None
    with Session(engine) as db:
        session_db = db.exec(select(SessionModel).where(SessionModel.session_id == session_id)).first()
        if not session_db or session_db.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            return None
        user = db.exec(select(User).where(User.id == session_db.user_id)).first()
        # Return a detached instance or just pass the ID around. Let's make a safe detached copy.
        if user:
            # We don't want to use detached SQLAlchemy objects if we query relationships, but for simple ID it's fine.
            return User(id=user.id, username=user.username, is_admin=user.is_admin)
    return None

@router.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: int):
    from core.database import engine
    await websocket.accept()
    
    user = await get_ws_user(websocket)
    if not user:
        await websocket.send_json({"error": "Authentication required"})
        await websocket.close()
        return

    # Verify session belongs to user
    with Session(engine) as db:
        chat_session = db.exec(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)).first()
        if not chat_session:
            await websocket.send_json({"error": "Chat session not found"})
            await websocket.close()
            return

    while True:
        try:
            data = await websocket.receive_text()
        except WebSocketDisconnect:
            break
            
        try:
            payload = json.loads(data)
            
            user_message = payload.get("message")
            provider_name = payload.get("provider", "openai")
            model = payload.get("model", "gpt-3.5-turbo")
            
            if not user_message:
                continue

            with Session(engine) as db:
                # Save user message
                msg = ChatMessage(session_id=session_id, role="user", content=user_message)
                db.add(msg)
                db.commit()

                # Load history
                history = db.exec(select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())).all()
                messages = []
                for h in history:
                    m = {"role": h.role, "content": h.content}
                    if h.tool_calls:
                        m["tool_calls"] = json.loads(h.tool_calls)
                    messages.append(m)

            # Run agent loop (pass db context or let agent loop handle it)
            # wait, `run_agent_loop` takes `db`. Let's pass a fresh short-lived session inside run_agent_loop?
            # Or we can wrap run_agent_loop in a session. Let's wrap it in a session context for safety, since the generator yields.
            full_assistant_message = ""
            with Session(engine) as db:
                async for chunk in run_agent_loop(session_id, user.id, db, messages, provider_name, model):
                    if chunk["type"] == "content":
                        full_assistant_message += chunk.get("content", "")
                    await websocket.send_json(chunk)

                # Save assistant message
                if full_assistant_message:
                    ast_msg = ChatMessage(session_id=session_id, role="assistant", content=full_assistant_message)
                    db.add(ast_msg)
                    
                chat_session = db.exec(select(ChatSession).where(ChatSession.id == session_id)).first()
                if chat_session:
                    chat_session.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                db.commit()
            
            await websocket.send_json({"type": "done"})

        except Exception as e:
            await websocket.send_json({"error": str(e)})
