from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from core.auth import get_current_user_optional
from core.models import User

router = APIRouter(tags=["ui"])
templates = Jinja2Templates(directory="static")

from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
import os

@router.get("/", response_class=HTMLResponse)
def index(request: Request, user: User | None = Depends(get_current_user_optional)):
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    if os.path.exists("frontend/dist/index.html"):
        return FileResponse("frontend/dist/index.html")
    
    return HTMLResponse("""
    <html><body>
    <h2>Frontend Not Built</h2>
    <p>The React frontend has not been built yet. The old vanilla UI has been permanently removed.</p>
    <p>Please run <code>npm run build</code> in the <code>frontend</code> directory, or use the dev server on port 5173.</p>
    </body></html>
    """)

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request, user: User | None = Depends(get_current_user_optional)):
    if user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse(request, "login.html")
