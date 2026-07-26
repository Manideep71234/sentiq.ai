import asyncio
from typing import Dict, Any, List, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class MCPClientManager:
    def __init__(self):
        self.server_configs = {
            "workspace-fs": StdioServerParameters(
                command="python",
                args=["mcp_servers/fs_server.py"]
            )
        }
        self._cached_tools: Optional[List[Dict[str, Any]]] = None

    async def get_tools(self) -> List[Dict[str, Any]]:
        if self._cached_tools is not None:
            return self._cached_tools

        tools = []
        for server_name, params in self.server_configs.items():
            print(f"Connecting to MCP server: {server_name}")
            try:
                async with stdio_client(params) as (read, write):
                    print("Connected to stdio_client")
                    async with ClientSession(read, write) as session:
                        print("Initializing session")
                        await session.initialize()
                        print("Session initialized. Listing tools...")
                        server_tools = await session.list_tools()
                        print(f"Received tools: {server_tools}")
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
        params = self.server_configs.get(server_name)
        if not params:
            return f"Error: Unknown MCP server {server_name}"
            
        try:
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments=arguments)
                    return result.content[0].text if result.content else "Success"
        except Exception as e:
            return f"MCP Tool execution failed: {e}"

mcp_manager = MCPClientManager()
