import asyncio
from typing import Dict, Any, List, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from contextlib import AsyncExitStack

class MCPClientManager:
    def __init__(self):
        self.server_configs = {
            "workspace-fs": StdioServerParameters(
                command="python",
                args=["mcp_servers/fs_server.py"]
            )
        }
        self._cached_tools: Optional[List[Dict[str, Any]]] = None
        self.sessions: Dict[str, ClientSession] = {}
        self.exit_stack = AsyncExitStack()

    async def _get_or_create_session(self, server_name: str) -> ClientSession:
        if server_name in self.sessions:
            return self.sessions[server_name]
            
        params = self.server_configs.get(server_name)
        if not params:
            raise ValueError(f"Unknown MCP server {server_name}")
            
        print(f"Starting MCP server: {server_name}")
        stdio_transport = await self.exit_stack.enter_async_context(stdio_client(params))
        read, write = stdio_transport
        session = await self.exit_stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        self.sessions[server_name] = session
        return session

    async def get_tools(self) -> List[Dict[str, Any]]:
        if self._cached_tools is not None:
            return self._cached_tools

        tools = []
        for server_name in self.server_configs.keys():
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
