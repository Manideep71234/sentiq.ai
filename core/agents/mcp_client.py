import asyncio
from typing import Dict, Any, List, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from contextlib import AsyncExitStack

import json
from sqlmodel import Session, select
from core.database import engine
from core.models import MCPServerConfig
from core.security import decrypt_string
import os

class MCPClientManager:
    def __init__(self):
        self._cached_tools: Optional[List[Dict[str, Any]]] = None
        self.sessions: Dict[str, ClientSession] = {}
        self.exit_stack = AsyncExitStack()

    def _get_server_configs(self):
        configs = {}
        with Session(engine) as session:
            servers = session.exec(select(MCPServerConfig).where(MCPServerConfig.enabled == True)).all()
            for s in servers:
                env_vars = {}
                if s.env_vars_encrypted:
                    try:
                        env_vars = json.loads(decrypt_string(s.env_vars_encrypted))
                    except Exception:
                        pass
                
                # Merge with os.environ so PATH etc is preserved
                merged_env = os.environ.copy()
                merged_env.update(env_vars)
                
                if s.command.startswith("http://") or s.command.startswith("https://"):
                    configs[s.name] = {
                        "transport": "sse",
                        "url": s.command,
                        "env": merged_env
                    }
                else:
                    configs[s.name] = {
                        "transport": "stdio",
                        "params": StdioServerParameters(
                            command=s.command,
                            args=json.loads(s.args_json),
                            env=merged_env
                        )
                    }
        return configs

    async def _get_or_create_session(self, server_name: str) -> ClientSession:
        if server_name in self.sessions:
            return self.sessions[server_name]
            
        configs = self._get_server_configs()
        config = configs.get(server_name)
        if not config:
            raise ValueError(f"Unknown MCP server {server_name}")
            
        print(f"Starting MCP server: {server_name}")
        
        if config["transport"] == "sse":
            from mcp.client.sse import sse_client
            transport = await self.exit_stack.enter_async_context(sse_client(config["url"], headers=config["env"]))
        else:
            transport = await self.exit_stack.enter_async_context(stdio_client(config["params"]))
            
        read, write = transport
        session = await self.exit_stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        self.sessions[server_name] = session
        return session

    async def get_tools(self) -> List[Dict[str, Any]]:
        if self._cached_tools is not None:
            return self._cached_tools

        tools = []
        configs = self._get_server_configs()
        for server_name in configs.keys():
            try:
                session = await self._get_or_create_session(server_name)
                server_tools = await session.list_tools()
                for t in server_tools.tools:
                    tools.append({
                        "type": "function",
                        "function": {
                            "name": f"mcp_{server_name}_{t.name}",
                            "description": t.description,
                            "parameters": t.inputSchema
                        }
                    })
            except Exception as e:
                print(f"Error loading tools from {server_name}: {e}")
        
        self._cached_tools = tools
        return tools

    async def call_tool(self, server_name: str, tool_name: str, arguments: dict) -> str:
        try:
            session = await self._get_or_create_session(server_name)
            result = await session.call_tool(tool_name, arguments=arguments)
            return result.content[0].text if result.content else "Success"
        except Exception as e:
            return f"MCP Tool execution failed: {e}"

mcp_manager = MCPClientManager()
