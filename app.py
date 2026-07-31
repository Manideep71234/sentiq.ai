import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel, Session, select
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from core.database import engine
from core.models import User
from core.security import generate_random_password, get_password_hash
from core.limiter import limiter

from routes.auth import router as auth_router
from routes.system import router as system_router
from routes.ui import router as ui_router
from routes.chat import router as chat_router
from routes.research import router as research_router
from routes.documents import router as documents_router
from routes.email import router as email_router
from routes.calendar import router as calendar_router
from routes.notes import router as notes_router
from routes.tasks import router as tasks_router
from routes.scheduled_tasks import router as scheduled_tasks_router
from routes.settings import router as settings_router

from core.scheduler import start_scheduler, sync_db_tasks

logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database directory exists if using sqlite
    from core.config import settings
    if settings.DATABASE_URL.startswith("sqlite:///"):
        # Extract the path from sqlite:///path/to/db.sqlite
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
            
    # Initialize Database
    SQLModel.metadata.create_all(engine)
    
    # Start scheduler
    start_scheduler()
    sync_db_tasks()
    
    # Check for admin user and create if not exists
    with Session(engine) as session:
        admin_user = session.exec(select(User).where(User.username == "admin")).first()
        if not admin_user:
            password = generate_random_password()
            hashed = get_password_hash(password)
            
            new_admin = User(
                username="admin",
                password_hash=hashed,
                is_admin=True
            )
            session.add(new_admin)
            session.commit()
            
            logger.warning("="*50)
            logger.warning("FIRST RUN ADMIN PASSWORD GENERATED:")
            logger.warning(f"Username: admin")
            logger.warning(f"Password: {password}")
            logger.warning("PLEASE SAVE THIS PASSWORD SECURELY.")
            logger.warning("="*50)
            
    yield

app = FastAPI(lifespan=lifespan, title="Sentiq.AI")
app.state.limiter = limiter

# Exception handler for Rate Limits
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    from fastapi.responses import JSONResponse
    from fastapi import status
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Rate limit exceeded"}
    )

import os
from starlette.middleware.sessions import SessionMiddleware

from core.config import settings

app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)
app.add_middleware(SlowAPIMiddleware)

if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
    app.mount("/static", StaticFiles(directory="static"), name="static_fallback")
else:
    app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(ui_router)
app.include_router(auth_router)
app.include_router(system_router)
app.include_router(chat_router)
app.include_router(research_router)
app.include_router(documents_router)
app.include_router(email_router)
app.include_router(calendar_router)
app.include_router(notes_router)
app.include_router(tasks_router)
app.include_router(scheduled_tasks_router)
app.include_router(settings_router)
