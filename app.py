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
from routes.admin import router as admin_router
from routes.studio import router as studio_router

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
    
    # Manual Schema Migration for SQLite removed in favor of proper migrations.
    
    # Start scheduler
    start_scheduler()
    sync_db_tasks()
    
    # Check for admin user and create if not exists
    try:
        with Session(engine) as session:
            admin_email = os.environ.get("ADMIN_EMAIL")
            admin_password = os.environ.get("ADMIN_PASSWORD")
            
            if not admin_email or not admin_password:
                logger.warning("ADMIN_EMAIL or ADMIN_PASSWORD not set in environment, skipping admin auto-seed.")
            else:
                existing_admin = session.exec(select(User).where((User.username == admin_email) | (User.email == admin_email))).first()
                if not existing_admin:
                    hashed = get_password_hash(admin_password)
                    
                    new_admin = User(
                        username=admin_email,
                        email=admin_email,
                        password_hash=hashed,
                        is_admin=True,
                        is_active=True
                    )
                    session.add(new_admin)
                    session.commit()
                    
                    logger.info(f"Successfully auto-seeded admin account: {admin_email}")
    except Exception as e:
        logger.error(f"WARNING: Failed to auto-seed admin account (database may be unreachable or schema out of sync): {e}")
            
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

os.makedirs("data/uploads", exist_ok=True)
app.mount("/data/uploads", StaticFiles(directory="data/uploads"), name="uploads")

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
app.include_router(admin_router)
app.include_router(studio_router)

from routes.search import router as search_router
app.include_router(search_router)
