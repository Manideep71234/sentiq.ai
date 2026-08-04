import json
import time
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlmodel import Session, select
from core.database import get_session, engine
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

def sync_save_user_msg_and_load_history(session_id: int, user_message: str):
    with Session(engine) as db:
        msg = ChatMessage(session_id=session_id, role="user", content=user_message)
        db.add(msg)
        db.commit()

        history = db.exec(select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())).all()
        messages = []
        for h in history:
            m = {"role": h.role, "content": h.content}
            if h.tool_calls:
                m["tool_calls"] = json.loads(h.tool_calls)
            messages.append(m)
        return messages

def sync_save_assistant_message(session_id: int, full_assistant_message: str):
    with Session(engine) as db:
        if full_assistant_message:
            ast_msg = ChatMessage(session_id=session_id, role="assistant", content=full_assistant_message)
            db.add(ast_msg)
            
        chat_session = db.exec(select(ChatSession).where(ChatSession.id == session_id)).first()
        if chat_session:
            chat_session.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()

# WebSocket Endpoint
async def get_ws_user(websocket: WebSocket) -> User | None:
    session_id = websocket.cookies.get("session_id")
    if not session_id:
        session_id = websocket.query_params.get("token")
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
    print(f"DEBUG: New websocket connection for session {session_id}")
    await websocket.accept()
    print(f"DEBUG: Accepted websocket connection for session {session_id}")
    
    import os
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,https://sentiq-ai.vercel.app").split(",")
    origin = websocket.headers.get("origin")
    if origin:
        is_allowed = any(origin.strip() == o.strip() for o in allowed_origins) or origin.endswith(".vercel.app") or origin.startswith("http://localhost:")
        if not is_allowed:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
    from core.database import engine
    
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
            t_recv = time.time()
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

            # Offload to prevent freezing the event loop
            messages = await asyncio.to_thread(sync_save_user_msg_and_load_history, session_id, user_message)

            t_db_done = time.time()
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[(c) WebSocket message handling & History DB load] took {t_db_done - t_recv:.4f} seconds")

            full_assistant_message = ""
            with Session(engine) as db:
                try:
                    async for chunk in run_agent_loop(session_id, user.id, db, messages, provider_name, model):
                        if chunk.get("type") == "content":
                            full_assistant_message += chunk.get("content", "")
                        await websocket.send_json(chunk)
                except (WebSocketDisconnect, RuntimeError):
                    # Client disconnected or aborted stream
                    pass

            # Offload saving to prevent freezing event loop
            await asyncio.to_thread(sync_save_assistant_message, session_id, full_assistant_message)
            
            await websocket.send_json({"type": "done", "content": full_assistant_message})

        except Exception as e:
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"WebSocket Error: {e}", exc_info=True)
            try:
                await websocket.send_json({"error": "Something went wrong, please try again."})
            except:
                pass
