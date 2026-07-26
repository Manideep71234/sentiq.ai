import json
from typing import AsyncGenerator, Dict, Any, List
from sqlmodel import Session, select
from core.providers import get_provider
from core.models import MemoryEntry, Skill
from .tools import BUILTIN_TOOLS, execute_tool
from .mcp_client import mcp_manager

async def run_agent_loop(
    session_id: int,
    user_id: int,
    db: Session,
    messages: List[Dict[str, Any]],
    provider_name: str,
    model: str
) -> AsyncGenerator[Dict[str, Any], None]:
    
    provider = get_provider(provider_name)
    
    # 1. Inject memories and skills into system prompt
    memories = db.exec(select(MemoryEntry).where(MemoryEntry.user_id == user_id)).all()
    skills = db.exec(select(Skill).where(Skill.user_id == user_id)).all()
    
    system_prompt = "You are Sentiq.AI, an advanced intelligent agent.\n"
    if memories:
        system_prompt += "User's Long-term Memory:\n" + "\n".join([f"- {m.content}" for m in memories]) + "\n\n"
    if skills:
        system_prompt += "Available Skills:\n" + "\n".join([f"- {s.name}: {s.prompt}" for s in skills]) + "\n\n"
        
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    
    # 2. Get tools (builtin + MCP)
    mcp_tools = await mcp_manager.get_tools()
    all_tools = BUILTIN_TOOLS + mcp_tools
    
    MAX_ITERATIONS = 5
    for _ in range(MAX_ITERATIONS):
        tool_calls = []
        
        async for chunk in provider.generate_stream(full_messages, model, all_tools):
            if chunk["type"] == "content":
                yield {"type": "content", "content": chunk["delta"]}
            elif chunk["type"] == "tool_calls":
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
