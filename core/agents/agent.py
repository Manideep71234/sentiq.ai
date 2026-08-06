import json
import time
import logging
import asyncio
from typing import AsyncGenerator, Dict, Any, List
from sqlmodel import Session, select
from core.database import engine
from core.providers import get_provider
from core.models import MemoryEntry, Skill, UserSettings
from .tools import BUILTIN_TOOLS, execute_tool
from .mcp_client import mcp_manager

logger = logging.getLogger(__name__)

def sync_load_agent_data(user_id: int):
    with Session(engine) as db:
        user_settings = db.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
        memories = db.exec(select(MemoryEntry).where(MemoryEntry.user_id == user_id)).all()
        skills = db.exec(select(Skill).where(Skill.user_id == user_id)).all()
        # Create safe dict copies so we don't return SQLAlchemy models across threads
        memories_content = [m.content for m in memories]
        skills_info = [{"name": s.name, "prompt": s.prompt} for s in skills]
        return user_settings, memories_content, skills_info

async def run_agent_loop(
    session_id: int,
    user_id: int,
    db: Session,
    messages: List[Dict[str, Any]],
    provider_name: str,
    model: str
) -> AsyncGenerator[Dict[str, Any], None]:
    
    t0 = time.time()
    user_settings, memories_content, skills_info = await asyncio.to_thread(sync_load_agent_data, user_id)
    t1 = time.time()
    logger.info(f"[(a) DB queries for memory/skills in thread] took {t1 - t0:.4f} seconds")

    provider = get_provider(provider_name, user_settings)
    
    # 1. Inject memories and skills into system prompt
    
    system_prompt = "You are Sentiq.AI, an advanced intelligent agent.\n"
    system_prompt += "You have a powerful `web_search` tool. Use it whenever a question requires current information, specific facts you are unsure about, or anything about specific real-world entities (people, places, institutions, companies). DO NOT GUESS or hallucinate tools.\n\n"
    if memories_content:
        system_prompt += "User's Long-term Memory:\n" + "\n".join([f"- {m}" for m in memories_content]) + "\n\n"
    if skills_info:
        system_prompt += "Available Skills:\n" + "\n".join([f"- {s['name']}: {s['prompt']}" for s in skills_info]) + "\n\n"
        
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    
    # 2. Get tools (builtin + MCP)
    mcp_tools = await mcp_manager.get_tools()
    all_tools = BUILTIN_TOOLS + mcp_tools
    
    MAX_ITERATIONS = 5
    for _ in range(MAX_ITERATIONS):
        tool_calls = []
        
        t2 = time.time()
        first_token = False
        async for chunk in provider.generate_stream(full_messages, model, all_tools):
            if not first_token:
                t3 = time.time()
                logger.info(f"[(b) Provider API / First-token] took {t3 - t2:.4f} seconds")
                first_token = True
                
            if "error" in chunk:
                err_msg = chunk["error"]
                if isinstance(err_msg, str) and ("tool call validation failed" in err_msg.lower() or "not in request.tools" in err_msg.lower()):
                    friendly_msg = "I attempted to use a web search tool that is not currently available. Please provide the information directly or ask me to proceed without it."
                    yield {"type": "content", "content": f"\n\n*(System: {friendly_msg})*\n\n"}
                    break
                else:
                    yield {"error": err_msg}
                break
                
            if chunk.get("type") == "content":
                yield {"type": "content", "content": chunk["delta"]}
            elif chunk.get("type") == "tool_calls":
                tool_calls = chunk["tool_calls"]
                
        if not tool_calls:
            break
            
        full_messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": tool_calls
        })
        
        for tc in tool_calls:
            tool_name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                args = {}
                
            if tool_name == "web_search":
                q = args.get('query', '')
                yield {"type": "tool_status", "status": f"Searching the web for: {q}..."}
            else:
                yield {"type": "tool_status", "status": f"Agent is calling {tool_name}..."}
            
            result = ""
            if tool_name.startswith("mcp_"):
                # Parse server_name and actual_tool_name
                # format: mcp_{server_name}_{tool_name}
                parts = tool_name[4:].split("_", 1)
                if len(parts) == 2:
                    server_name, actual_tool_name = parts
                    result = await mcp_manager.call_tool(server_name, actual_tool_name, args)
                else:
                    result = "Error: Invalid MCP tool name format."
            else:
                result = execute_tool(tool_name, args, user_id, db)
                
            full_messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "name": tool_name,
                "content": str(result)
            })
            
            yield {"type": "tool_status", "status": f"Finished calling {tool_name}."}
