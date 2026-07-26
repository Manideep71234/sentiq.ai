import json
from typing import AsyncGenerator, Dict, Any, List
from sqlmodel import Session, select
from core.providers import get_provider
from core.models import MemoryEntry, Skill, ResearchReport
from .tools import BUILTIN_TOOLS, execute_tool
from .mcp_client import mcp_manager

async def run_research_loop(
    query: str,
    user_id: int,
    db: Session,
    provider_name: str,
    model: str
) -> AsyncGenerator[Dict[str, Any], None]:
    
    provider = get_provider(provider_name)
    
    # 1. System Prompt for Deep Research
    system_prompt = (
        "You are Sentiq.AI Deep Research Agent.\n"
        "Your goal is to quickly and thoroughly research the user's query using the web_search and read_url tools.\n"
        "CRITICAL RULES:\n"
        "1. DO NOT copy-paste long excerpts from websites. You must think independently, synthesize information in your own words, and provide actionable insights.\n"
        "2. Be concise and fast. Only read a URL if absolutely necessary. Rely on search summaries if they provide enough context.\n"
        "3. Your final output must be a well-structured, easy-to-read Markdown report.\n"
        "4. Do NOT ask the user for follow-ups, just deliver the final synthesized report directly."
    )
    
    full_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Please research the following topic and write a comprehensive report: {query}"}
    ]
    
    # We only give it tools relevant to research, plus maybe memory if needed.
    # For now, let's give it all tools just like chat, but it will primarily use web_search and read_url.
    mcp_tools = await mcp_manager.get_tools()
    all_tools = BUILTIN_TOOLS + mcp_tools
    
    MAX_ITERATIONS = 15
    full_assistant_message = ""
    sources = []
    
    for _ in range(MAX_ITERATIONS):
        tool_calls = []
        
        async for chunk in provider.generate_stream(full_messages, model, all_tools):
            if chunk["type"] == "content":
                # For research, we might stream the content back to show intermediate thoughts
                # Or just keep it silent and only stream status. We'll stream it as 'content' so the UI can show the final report.
                full_assistant_message += chunk["delta"]
                yield {"type": "content", "content": chunk["delta"]}
            elif chunk["type"] == "tool_calls":
                tool_calls = chunk["tool_calls"]
                
        if not tool_calls:
            # Reached a final textual answer without tools
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
                
            # Stream status to the user
            if tool_name == "web_search":
                q = args.get('query', '')
                yield {"type": "tool_status", "status": f"Searching web for: {q}"}
                sources.append({"type": "search", "query": q})
            elif tool_name == "read_url":
                u = args.get('url', '')
                yield {"type": "tool_status", "status": f"Reading article: {u}"}
                sources.append({"type": "url", "url": u})
            else:
                yield {"type": "tool_status", "status": f"Agent is calling {tool_name}..."}
            
            result = ""
            try:
                if tool_name.startswith("mcp_"):
                    parts = tool_name[4:].split("_", 1)
                    if len(parts) == 2:
                        server_name, actual_tool_name = parts
                        result = await mcp_manager.call_tool(server_name, actual_tool_name, args)
                    else:
                        result = "Error: Invalid MCP tool name format."
                else:
                    result = execute_tool(tool_name, args, user_id, db)
            except Exception as e:
                result = f"Error executing tool {tool_name}: {str(e)}"
                yield {"type": "tool_status", "status": f"Tool error: {str(e)}"}
                
            full_messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "name": tool_name,
                "content": str(result)
            })
            
    # After the loop finishes, save to DB
    if full_assistant_message:
        report = ResearchReport(
            user_id=user_id,
            query=query,
            report_markdown=full_assistant_message,
            sources_json=json.dumps(sources)
        )
        db.add(report)
        db.commit()
    
    yield {"type": "done"}
