"""
DISCLAIMER: 
Any shell execution tools or system-level command tools added to this file MUST BE strictly isolated and sandboxed. 
Sentiq.AI is deployed in a live environment, and exposing unrestricted shell access to the LLM agent introduces severe security risks.
If shell tools are ever implemented, they must run inside a secure, ephemeral container or restricted sandbox, and NEVER directly on the host system.
"""
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

def web_search(query: str, max_results: int = 3) -> str:
    from core.limiter import search_limiter
    if not search_limiter.check_limit("global"):
        return "Error: Rate limit exceeded for web search. Please wait before searching again."
    try:
        results = DDGS().text(query, max_results=max_results)
        if not results:
            return "No results found."
        
        urls = [r.get('href') for r in results if r.get('href')]
        
        import concurrent.futures
        fetched_contents = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(urls)) as executor:
            future_to_url = {executor.submit(read_url, url): url for url in urls}
            for future in concurrent.futures.as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    text = future.result()
                    if len(text) > 3000:
                        text = text[:3000] + "\n...[Content Truncated]..."
                    fetched_contents[url] = text
                except Exception as exc:
                    fetched_contents[url] = f"Error fetching: {exc}"
        
        formatted = []
        for r in results:
            url = r.get('href')
            content = fetched_contents.get(url, "No content")
            formatted.append(f"Title: {r.get('title')}\nURL: {url}\n--- UNTRUSTED WEB CONTENT START ---\n{content}\n--- UNTRUSTED WEB CONTENT END ---\n")
            
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

def agent_search_documents(user_id: int, db: Session, query: str) -> str:
    from core.models import Document
    from sqlmodel import select
    docs = db.exec(
        select(Document).where(
            Document.user_id == user_id,
            (Document.title.icontains(query) | Document.content.icontains(query))
        ).limit(5)
    ).all()
    if not docs:
        return "No documents found matching that query."
    
    res = [f"Found {len(docs)} documents:"]
    for d in docs:
        snippet = d.content[:150].replace('\n', ' ') + '...' if d.content else ""
        res.append(f"- ID: {d.id} | Title: {d.title} | Type: {d.doc_type} | Snippet: {snippet}")
    return "\n".join(res)

def agent_read_document(user_id: int, db: Session, doc_id: int) -> str:
    from core.models import Document
    from sqlmodel import select
    doc = db.exec(select(Document).where(Document.id == doc_id, Document.user_id == user_id)).first()
    if not doc:
        return f"Error: Document with ID {doc_id} not found or you don't have access."
    return f"Title: {doc.title}\n\nContent:\n{doc.content}"

def agent_search_memory(user_id: int, db: Session, query: str) -> str:
    from core.models import MemoryEntry
    from sqlmodel import select
    memories = db.exec(
        select(MemoryEntry).where(
            MemoryEntry.user_id == user_id,
            MemoryEntry.content.icontains(query)
        ).limit(10)
    ).all()
    if not memories:
        return "No specific memories found matching that query."
    
    return "Found these memories:\n" + "\n".join([f"- {m.content}" for m in memories])

def agent_fetch_recent_emails(user_id: int, db: Session, limit: int = 10) -> str:
    from core.models import EmailAccount
    from sqlmodel import select
    from core.security import decrypt_string
    from core.integrations.email_client import fetch_inbox
    
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user_id)).first()
    if not account:
        return "Error: User has not connected an Email account yet. Instruct them to connect it in the Email tab."
        
    try:
        password = decrypt_string(account.encrypted_password) if account.encrypted_password else None
        threads = fetch_inbox(
            host=account.imap_host,
            port=account.imap_port,
            username=account.username,
            password=password,
            access_token=account.access_token,
            limit=limit
        )
        if not threads:
            return "Inbox is empty or no recent emails found."
            
        res = [f"Found {len(threads)} recent email threads:"]
        for t in threads:
            res.append(f"- Thread ID: {t['thread_id']}\n  From: {t['sender']}\n  Subject: {t['subject']}\n  Date: {t['date']}\n  Snippet: {t['snippet']}\n")
        return "\n".join(res)
    except Exception as e:
        return f"Error fetching emails: {str(e)}"

def agent_search_emails(user_id: int, db: Session, query: str) -> str:
    from core.models import EmailAccount
    from sqlmodel import select
    from core.security import decrypt_string
    from core.integrations.email_client import search_inbox
    
    account = db.exec(select(EmailAccount).where(EmailAccount.user_id == user_id)).first()
    if not account:
        return "Error: User has not connected an Email account yet. Instruct them to connect it in the Email tab."
        
    try:
        password = decrypt_string(account.encrypted_password) if account.encrypted_password else None
        messages = search_inbox(
            host=account.imap_host,
            port=account.imap_port,
            username=account.username,
            password=password,
            query=query,
            access_token=account.access_token,
            limit=10
        )
        if not messages:
            return "No emails found matching that query."
            
        res = [f"Found {len(messages)} matching emails:"]
        for m in messages:
            res.append(f"- From: {m['sender']}\n  Subject: {m['subject']}\n  Date: {m['date']}\n  Snippet: {m['snippet']}\n")
        return "\n".join(res)
    except Exception as e:
        return f"Error searching emails: {str(e)}"

def agent_get_recent_actions(user_id: int, db: Session, limit: int = 15) -> str:
    from core.models import UsageLog, ChatMessage
    from sqlmodel import select
    
    logs = db.exec(
        select(UsageLog).where(UsageLog.user_id == user_id).order_by(UsageLog.created_at.desc()).limit(limit)
    ).all()
    
    if not logs:
        return "No recent AI actions found."
        
    res = [f"Found {len(logs)} recent AI interactions:"]
    for idx, log in enumerate(logs):
        res.append(f"{idx+1}. Model: {log.model_name}, Prompt Tokens: {log.prompt_tokens}, Date: {log.created_at}")
        
    return "\n".join(res)

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
                    "max_results": {"type": "integer", "description": "Maximum number of results to return (default 3)"}
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
    },
    {
        "type": "function",
        "function": {
            "name": "search_documents",
            "description": "Search the user's Sentiq.AI documents by title or content keyword.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Keyword to search for in documents"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_memory",
            "description": "Search the user's long-term memory for specific keywords if the system prompt doesn't contain enough detail.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Keyword to search for in memory"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_document",
            "description": "Read the full content of a specific Sentiq.AI document.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_id": {"type": "integer", "description": "The ID of the document to read"}
                },
                "required": ["doc_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_recent_emails",
            "description": "Fetch the user's most recent email threads from their connected inbox.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Maximum number of recent emails to fetch (default 10, max 20)"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_emails",
            "description": "Search the user's email inbox for specific keywords or topics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Keyword or topic to search for in emails"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_actions",
            "description": "Get a log of the AI's recent actions and interactions with the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of logs to fetch (default 15)"}
                },
                "required": []
            }
        }
    }
]
import time
search_rate_limits = {}

def execute_tool(name: str, arguments: dict, user_id: int, db: Session) -> str:
    if name == "read_file":
        return read_file(arguments.get("path", ""))
    elif name == "write_file":
        return write_file(arguments.get("path", ""), arguments.get("content", ""))
    elif name == "save_memory":
        return save_memory(user_id, db, arguments.get("content", ""))
    elif name == "search_memory":
        return agent_search_memory(user_id, db, arguments.get("query", ""))
    elif name == "search_documents":
        return agent_search_documents(user_id, db, arguments.get("query", ""))
    elif name == "read_document":
        return agent_read_document(user_id, db, arguments.get("doc_id", 0))
    elif name == "fetch_recent_emails":
        return agent_fetch_recent_emails(user_id, db, arguments.get("limit", 10))
    elif name == "search_emails":
        return agent_search_emails(user_id, db, arguments.get("query", ""))
    elif name == "get_recent_actions":
        return agent_get_recent_actions(user_id, db, arguments.get("limit", 15))
    elif name == "web_search":
        now = time.time()
        user_searches = search_rate_limits.get(user_id, [])
        user_searches = [t for t in user_searches if now - t < 60]
        if len(user_searches) >= 5:
            return "Error: Web search rate limit exceeded (max 5 per minute). Please try again later."
        user_searches.append(now)
        search_rate_limits[user_id] = user_searches
        return web_search(arguments.get("query", ""), arguments.get("max_results", 3))
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
