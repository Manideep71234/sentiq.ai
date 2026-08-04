import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, ResearchReport
from core.agents.research import run_research_loop
from routes.chat import get_ws_user
from core.auth import get_current_user

router = APIRouter(prefix="/research", tags=["research"])

@router.get("/history")
def get_research_history(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    reports = db.exec(select(ResearchReport).where(ResearchReport.user_id == user.id).order_by(ResearchReport.created_at.desc())).all()
    return reports

@router.websocket("/ws")
async def websocket_research(websocket: WebSocket):
    from core.database import engine
    await websocket.accept()
    
    import os
    from fastapi import status
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,https://sentiq-ai.vercel.app").split(",")
    origin = websocket.headers.get("origin")
    if origin:
        is_allowed = any(origin.strip() == o.strip() for o in allowed_origins) or origin.endswith(".vercel.app") or origin.startswith("http://localhost:")
        if not is_allowed:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    
    user = await get_ws_user(websocket)
    if not user:
        await websocket.send_json({"error": "Authentication required"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            query = payload.get("query")
            provider_name = payload.get("provider", "openai")
            model = payload.get("model", "gpt-3.5-turbo")
            
            if not query:
                continue

            with Session(engine) as db:
                async for chunk in run_research_loop(query, user.id, db, provider_name, model):
                    await websocket.send_json(chunk)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"WebSocket Error: {e}", exc_info=True)
        try:
            await websocket.send_json({"error": "Something went wrong, please try again."})
        except:
            pass
