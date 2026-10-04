import time
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, desc
from typing import List, Optional
from pydantic import BaseModel

from core.database import get_session
from core.models import (
    User, AuditLog, SessionModel, PasskeyCredential, ChatSession, ChatMessage,
    Skill, MemoryEntry, ResearchReport, UserSettings, Document, DocumentVersion,
    EmailAccount, EmailThreadCache, CalendarAccount, Note, Task, ScheduledTask, TaskResult,
    InviteCode
)
from core.auth import get_admin_user
from core.audit import log_event

router = APIRouter(prefix="/admin", tags=["admin"])

START_TIME = time.time()

class SystemStatusResponse(BaseModel):
    uptime_seconds: float
    db_ok: bool
    groq_ok: bool
    openrouter_ok: bool

@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(admin: User = Depends(get_admin_user), db: Session = Depends(get_session)):
    db_ok = True
    try:
        db.exec(select(User).limit(1)).first()
    except Exception:
        db_ok = False
        
    groq_ok = False
    openrouter_ok = False
    
    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            # We don't need auth to ping these endpoints, we just want to see if the domains are reachable
            r = await client.get("https://api.groq.com/openai/v1/models")
            groq_ok = r.status_code in (200, 401)
        except Exception:
            pass
            
        try:
            r = await client.get("https://openrouter.ai/api/v1/auth/key")
            openrouter_ok = r.status_code in (200, 401)
        except Exception:
            pass
            
    return SystemStatusResponse(
        uptime_seconds=time.time() - START_TIME,
        db_ok=db_ok,
        groq_ok=groq_ok,
        openrouter_ok=openrouter_ok
    )

@router.get("/audit-logs")
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    event_type: Optional[str] = None,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_session)
):
    query = select(AuditLog)
    if event_type:
        query = query.where(AuditLog.event_type == event_type)
        
    query = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
    logs = db.exec(query).all()
    
    total = db.exec(select(AuditLog)).all()
    
    results = []
    for log in logs:
        user_name = "System/Unknown"
        if log.user_id:
            u = db.exec(select(User).where(User.id == log.user_id)).first()
            if u:
                user_name = u.username
                
        results.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": user_name,
            "event_type": log.event_type,
            "metadata_json": log.metadata_json,
            "created_at": log.created_at
        })
        
    return {"logs": results, "total": len(total)}

@router.get("/users")
def get_users(admin: User = Depends(get_admin_user), db: Session = Depends(get_session)):
    users = db.exec(select(User).order_by(desc(User.created_at))).all()
    return [{
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "auth_provider": u.auth_provider,
        "is_admin": u.is_admin,
        "is_active": u.is_active,
        "created_at": u.created_at,
        "last_login": u.last_login,
        "full_name": u.full_name
    } for u in users]

class UserStatusUpdate(BaseModel):
    is_active: bool

@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: int, 
    status_update: UserStatusUpdate,
    admin: User = Depends(get_admin_user), 
    db: Session = Depends(get_session)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")
        
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = status_update.is_active
    db.add(user)
    
    if not status_update.is_active:
        sessions = db.exec(select(SessionModel).where(SessionModel.user_id == user_id)).all()
        for s in sessions:
            db.delete(s)
            
    db.commit()
    log_event(db, admin.id, "account_disabled" if not status_update.is_active else "account_enabled", {"target_user_id": user_id})
    return {"message": "User status updated"}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_session)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    from core.auth import cascade_delete_user
    cascade_delete_user(db, user)
    
    log_event(db, admin.id, "account_deleted", {"target_username": user.username})
    
    return {"message": "User and all associated data permanently deleted"}

import uuid

@router.get("/invites")
def get_invites(admin: User = Depends(get_admin_user), db: Session = Depends(get_session)):
    invites = db.exec(select(InviteCode).order_by(desc(InviteCode.created_at))).all()
    results = []
    for inv in invites:
        results.append({
            "id": inv.id,
            "code": inv.code,
            "is_used": inv.is_used,
            "created_at": inv.created_at,
            "used_by": inv.used_by
        })
    return results

@router.post("/invites")
def create_invite(admin: User = Depends(get_admin_user), db: Session = Depends(get_session)):
    code_str = str(uuid.uuid4())[:8].upper()
    invite = InviteCode(code=code_str, created_by=admin.id)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    log_event(db, admin.id, "invite_created", {"code": code_str})
    return {"id": invite.id, "code": invite.code}

import json
from core.models import MCPServerConfig
from core.security import encrypt_string, decrypt_string

class MCPServerCreate(BaseModel):
    name: str
    command: str
    args: List[str]
    env_vars: dict
    enabled: bool = True

class MCPServerResponse(BaseModel):
    id: int
    name: str
    command: str
    args: List[str]
    env_vars: dict
    enabled: bool

@router.get("/mcp-servers", response_model=List[MCPServerResponse])
def get_mcp_servers(db: Session = Depends(get_session), admin: User = Depends(get_admin_user)):
    servers = db.exec(select(MCPServerConfig)).all()
    resp = []
    for s in servers:
        env = {}
        if s.env_vars_encrypted:
            try:
                env = json.loads(decrypt_string(s.env_vars_encrypted))
            except:
                pass
        resp.append({
            "id": s.id,
            "name": s.name,
            "command": s.command,
            "args": json.loads(s.args_json),
            "env_vars": env,
            "enabled": s.enabled
        })
    return resp

@router.post("/mcp-servers", response_model=MCPServerResponse)
def create_mcp_server(data: MCPServerCreate, db: Session = Depends(get_session), admin: User = Depends(get_admin_user)):
    if not data.command:
        raise HTTPException(400, "Command required")
        
    encrypted_env = encrypt_string(json.dumps(data.env_vars)) if data.env_vars else None
    s = MCPServerConfig(
        name=data.name,
        command=data.command,
        args_json=json.dumps(data.args),
        env_vars_encrypted=encrypted_env,
        enabled=data.enabled
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {
        "id": s.id,
        "name": s.name,
        "command": s.command,
        "args": data.args,
        "env_vars": data.env_vars,
        "enabled": s.enabled
    }

@router.put("/mcp-servers/{server_id}", response_model=MCPServerResponse)
def update_mcp_server(server_id: int, data: MCPServerCreate, db: Session = Depends(get_session), admin: User = Depends(get_admin_user)):
    s = db.get(MCPServerConfig, server_id)
    if not s:
        raise HTTPException(404, "Server not found")
        
    s.name = data.name
    s.command = data.command
    s.args_json = json.dumps(data.args)
    s.env_vars_encrypted = encrypt_string(json.dumps(data.env_vars)) if data.env_vars else None
    s.enabled = data.enabled
    
    db.add(s)
    db.commit()
    return {
        "id": s.id,
        "name": s.name,
        "command": s.command,
        "args": data.args,
        "env_vars": data.env_vars,
        "enabled": s.enabled
    }

@router.delete("/mcp-servers/{server_id}")
def delete_mcp_server(server_id: int, db: Session = Depends(get_session), admin: User = Depends(get_admin_user)):
    s = db.get(MCPServerConfig, server_id)
    if not s:
        raise HTTPException(404, "Server not found")
    db.delete(s)
    db.commit()
    return {"status": "ok"}

@router.post("/mcp-servers/test")
async def test_mcp_server(data: MCPServerCreate, admin: User = Depends(get_admin_user)):
    from mcp import StdioServerParameters
    from mcp.client.stdio import stdio_client
    from mcp import ClientSession
    from contextlib import AsyncExitStack
    import os
    
    if data.command.startswith("http://") or data.command.startswith("https://"):
        from mcp.client.sse import sse_client
        # For SSE, command is the URL. Pass only user-provided env_vars as headers (prevent leaking os.environ)
        is_sse = True
        url = data.command
        headers = data.env_vars
    else:
        from mcp.client.stdio import stdio_client
        is_sse = False
        
        # For local processes, merge with os.environ so PATH etc is preserved
        merged_env = os.environ.copy()
        merged_env.update(data.env_vars)
        
        params = StdioServerParameters(
            command=data.command,
            args=data.args,
            env=merged_env
        )
    
    tools = []
    try:
        async with AsyncExitStack() as stack:
            if is_sse:
                transport = await stack.enter_async_context(sse_client(url, headers=headers))
            else:
                transport = await stack.enter_async_context(stdio_client(params))
                
            read, write = transport
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            server_tools = await session.list_tools()
            for t in server_tools.tools:
                tools.append({
                    "name": t.name,
                    "description": getattr(t, "description", "No description provided.")
                })
        return {"status": "ok", "tools": tools}
    except Exception as e:
        error_msg = str(e)
        if "unhandled errors in a TaskGroup" in error_msg or "ConnectionRefused" in error_msg:
            error_msg = "Could not connect to the remote server. Verify the URL is correct and the server is running."
        elif "FileNotFound" in error_msg or "No such file" in error_msg:
            error_msg = f"Invalid command: '{data.command}' could not be found. If it's a URL, select 'Remote'."
        raise HTTPException(status_code=400, detail=f"Failed to connect to MCP server: {error_msg}")
