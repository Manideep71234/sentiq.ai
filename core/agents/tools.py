import os
import json
import httpx
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS
from pathlib import Path
from sqlmodel import Session
from core.models import MemoryEntry

WORKSPACE_DIR = Path("/app/workspace").resolve() # inside docker it's /app/workspace

def is_safe_path(basedir: Path, path: str, follow_symlinks: bool = True) -> bool:
    try:
        if follow_symlinks:
            matchpath = os.path.realpath(basedir.joinpath(path))
        else:
            matchpath = os.path.abspath(basedir.joinpath(path))
    except Exception:
        return False
    return basedir.resolve().as_posix() in Path(matchpath).resolve().as_posix()

def read_file(path: str) -> str:
    if not is_safe_path(WORKSPACE_DIR, path):
        return f"Error: Path {path} is outside of workspace."
    try:
        with open(WORKSPACE_DIR / path, "r") as f:
            return f.read()
    except Exception as e:
        return str(e)

def write_file(path: str, content: str) -> str:
    if not is_safe_path(WORKSPACE_DIR, path):
        return f"Error: Path {path} is outside of workspace."
    try:
        file_path = WORKSPACE_DIR / path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w") as f:
            f.write(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return str(e)

def save_memory(user_id: int, db: Session, content: str) -> str:
    try:
        mem = MemoryEntry(user_id=user_id, content=content)
        db.add(mem)
        db.commit()
        return f"Successfully saved to memory: {content}"
    except Exception as e:
        return f"Error saving memory: {str(e)}"

def web_search(query: str, max_results: int = 5) -> str:
    try:
        results = DDGS().text(query, max_results=max_results)
        if not results:
            return "No results found."
        formatted = []
        for r in results:
            formatted.append(f"Title: {r.get('title')}\nURL: {r.get('href')}\nSnippet: {r.get('body')}\n")
        return "\n".join(formatted)
    except Exception as e:
        return f"Error performing web search: {str(e)}"

def read_url(url: str) -> str:
    try:
        # Use a modern browser user agent
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        with httpx.Client(headers=headers, follow_redirects=True, timeout=10.0) as client:
            response = client.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Remove scripts, styles, and empty elements
            for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
                element.decompose()
                
            text = soup.get_text(separator="\n", strip=True)
            # Truncate to avoid exploding context window (e.g. 10000 chars)
            if len(text) > 10000:
                text = text[:10000] + "\n...[Content Truncated]..."
            return text
    except Exception as e:
        return f"Error reading URL: {str(e)}"

def agent_create_calendar_event(user_id: int, db: Session, start_date_iso: str, end_date_iso: str, summary: str, description: str = "") -> str:
    from core.models import CalendarAccount
    from sqlmodel import select
    from core.security import decrypt_string
    from core.integrations.caldav_client import create_event
    from datetime import datetime

    account = db.exec(select(CalendarAccount).where(CalendarAccount.user_id == user_id)).first()
    if not account:
        return "Error: User has not connected a Calendar account yet. Instruct them to connect it in the Calendar tab."

    try:
        password = decrypt_string(account.encrypted_password)
        start = datetime.fromisoformat(start_date_iso.replace('Z', '+00:00'))
        end = datetime.fromisoformat(end_date_iso.replace('Z', '+00:00'))
        create_event(account.caldav_url, account.username, password, start, end, summary, description)
        return f"Successfully created calendar event: {summary}"
    except Exception as e:
        return f"Error creating calendar event: {str(e)}"

BUILTIN_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file from the workspace",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path to file in workspace"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write a file to the workspace",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path to file in workspace"},
                    "content": {"type": "string", "description": "File content"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Save a fact, preference, or detail to the user's long-term memory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "The fact or detail to remember"}
                },
                "required": ["content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for information using DuckDuckGo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"},
                    "max_results": {"type": "integer", "description": "Maximum number of results to return (default 5)"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_url",
            "description": "Fetch and extract text content from a specific URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The full URL to read"}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_calendar_event",
            "description": "Create a new event in the user's CalDAV calendar.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date_iso": {"type": "string", "description": "Start date in ISO format (e.g. 2026-07-20T15:00:00Z)"},
                    "end_date_iso": {"type": "string", "description": "End date in ISO format (e.g. 2026-07-20T16:00:00Z)"},
                    "summary": {"type": "string", "description": "Title of the event"},
                    "description": {"type": "string", "description": "Optional description of the event"}
                },
                "required": ["start_date_iso", "end_date_iso", "summary"]
            }
        }
    }
]

def execute_tool(name: str, arguments: dict, user_id: int, db: Session) -> str:
    if name == "read_file":
        return read_file(arguments.get("path", ""))
    elif name == "write_file":
        return write_file(arguments.get("path", ""), arguments.get("content", ""))
    elif name == "save_memory":
        return save_memory(user_id, db, arguments.get("content", ""))
    elif name == "web_search":
        return web_search(arguments.get("query", ""), arguments.get("max_results", 5))
    elif name == "read_url":
        return read_url(arguments.get("url", ""))
    elif name == "create_calendar_event":
        return agent_create_calendar_event(
            user_id, 
            db, 
            arguments.get("start_date_iso", ""), 
            arguments.get("end_date_iso", ""), 
            arguments.get("summary", ""), 
            arguments.get("description", "")
        )
    else:
        return f"Unknown tool {name}"
