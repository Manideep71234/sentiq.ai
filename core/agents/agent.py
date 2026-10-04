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
    
    # 1. Get tools (builtin + MCP)
    mcp_tools = await mcp_manager.get_tools()
    
    # Filter tools for smaller models that struggle with complex JSON tool schemas
    is_small_model = "8b" in model.lower() or "mini" in model.lower()
    
    if is_small_model:
        all_tools = []  # Small models hallucinate tools, restrict them entirely for now or keep minimal
    else:
        all_tools = BUILTIN_TOOLS + mcp_tools

    # 2. Build system prompt
    
    system_prompt = "You are Rumii.AI, an advanced intelligent agent.\n"
    system_prompt += "CRITICAL INSTRUCTIONS:\n"
    
    if all_tools:
        system_prompt += "1. For casual greetings (e.g., 'hi', 'hello'), conversational chatter, or simple questions, respond directly WITHOUT calling any tools. You do not need a tool to say hello.\n"
        system_prompt += "2. DO NOT use tools (e.g., read_file, web_search) unless specifically required to fulfill the prompt. If the user just says 'hi', reply with a greeting and STOP. DO NOT call any tool.\n"
        system_prompt += "3. DO NOT hallucinate tools or files. Only use tools if the user explicitly asks for external information or actions.\n"
    
    system_prompt += "FORMATTING RULES:\n"
    system_prompt += "1. Respond directly to the user in a helpful, friendly, and conversational manner.\n"
    system_prompt += "2. Do NOT output any JSON, XML, or structured tool calling formats in your text. Just provide plain text responses.\n"
    system_prompt += "3. DO NOT narrate your tool usage to the user. If you are searching the web, do it silently. DO NOT output text like 'Let me search the web for you' or 'I will use the web_search tool now'. Only output the final synthesized answer to the user.\n"
    system_prompt += "4. MAPS: If the user asks to see a map or location, output exactly this tag: [MAP: location query]. Example: [MAP: Paris, France]. The UI will render an interactive map.\n"
    system_prompt += "5. IMAGES: If the user asks to generate or show an image, use standard markdown image syntax pointing to Pollinations AI: ![description](https://image.pollinations.ai/prompt/URL_ENCODED_PROMPT). Example: ![A futuristic city](https://image.pollinations.ai/prompt/A%20futuristic%20city)\n\n"
        
    if memories_content:
        system_prompt += "User's Long-term Memory:\n" + "\n".join([f"- {m}" for m in memories_content]) + "\n\n"
    if skills_info:
        system_prompt += "Available Skills:\n" + "\n".join([f"- {s['name']}: {s['prompt']}" for s in skills_info]) + "\n\n"
        
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    
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
