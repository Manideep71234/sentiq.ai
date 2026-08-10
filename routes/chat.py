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

from pydantic import BaseModel
class ChatSessionUpdate(BaseModel):
    title: str

@router.put("/sessions/{session_id}")
def update_session(session_id: int, update_data: ChatSessionUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    session_obj = db.exec(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_obj.title = update_data.title
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)
    return session_obj

@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    session_obj = db.exec(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Cascade delete is usually handled by the DB relationship, but we can explicitly delete messages too if needed.
    # We will let SQLModel/SQLAlchemy handle it or just delete the session.
    db.delete(session_obj)
    db.commit()
    return {"message": "Session deleted successfully"}

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

async def auto_generate_title(session_id: int, user_id: int, user_message: str, provider_name: str, model: str, websocket: WebSocket):
    from core.providers import get_provider
    from core.models import UserSettings
    with Session(engine) as db:
        user_settings = db.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
    
    provider = get_provider(provider_name, user_settings)
    prompt = [
        {"role": "system", "content": "You are a helpful assistant. Provide a very brief, 3 to 4 word summary title for the following message. ONLY output the title, no quotes, no extra text."},
        {"role": "user", "content": user_message}
    ]
    
    title = ""
    try:
        async for chunk in provider.generate_stream(prompt, model, []):
            if chunk.get("type") == "content":
                title += chunk.get("delta", "")
                
        title = title.strip().strip('"').strip("'")
        if title:
            with Session(engine) as db:
                session_obj = db.exec(select(ChatSession).where(ChatSession.id == session_id)).first()
                if session_obj:
                    session_obj.title = title
                    db.commit()
            try:
                await websocket.send_json({"type": "title_update", "title": title})
            except:
                pass
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Title generation failed: {e}")

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

            # Auto-generate title if it's the first message, AFTER response is done to prevent concurrent 429s on strict APIs like Groq
            if len(messages) == 1:
                asyncio.create_task(auto_generate_title(session_id, user.id, user_message, provider_name, model, websocket))

        except Exception as e:
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"WebSocket Error: {e}", exc_info=True)
            
            error_details = str(e)
            if "429" in error_details:
                friendly_error = "Rate limit reached. Please wait a moment and try again."
            elif "402" in error_details:
                friendly_error = "Response too long for current settings or insufficient credits. Try a shorter request."
            elif "context length" in error_details.lower() or "too long" in error_details.lower():
                friendly_error = "The conversation has become too long for the model's context window. Please start a new chat."
            else:
                # Keep it safe but informative
                friendly_error = f"Something went wrong: {error_details}"
                if len(friendly_error) > 200:
                    friendly_error = friendly_error[:200] + "..."
                    
            try:
                await websocket.send_json({"error": friendly_error})
            except:
                pass
