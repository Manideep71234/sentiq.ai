import json
import httpx
from typing import AsyncGenerator, Dict, List, Any, Optional
from .base import BaseProvider
from core.config import settings

# Global client for connection pooling
_client = None

def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=60.0, limits=httpx.Limits(max_keepalive_connections=50))
    return _client

class OpenAICompatProvider(BaseProvider):
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key.strip()
        
    async def generate_stream(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": messages,
            "stream": True
        }
        if tools:
            payload["tools"] = tools
            
        client = get_client()
        async with client.stream(
            "POST", 
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=payload
        ) as response:
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                import logging
                await response.aread()
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logging.error(error_msg)
                raise Exception(error_msg) from e
                
            tool_calls_buffer = {}
            
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                
                try:
                    data = json.loads(data_str)
                    delta = data["choices"][0]["delta"]
                    
                    if "content" in delta and delta["content"]:
                        yield {"type": "content", "delta": delta["content"]}
                        
                    if "tool_calls" in delta:
                        for tc in delta["tool_calls"]:
                            idx = tc["index"]
                            if idx not in tool_calls_buffer:
                                tool_calls_buffer[idx] = {
                                    "id": tc.get("id", ""),
                                    "type": "function",
                                    "function": {
                                        "name": tc.get("function", {}).get("name", ""),
                                        "arguments": tc.get("function", {}).get("arguments", "")
                                    }
                                }
                            else:
                                if "id" in tc and tc["id"]:
                                    tool_calls_buffer[idx]["id"] += tc["id"]
                                if "function" in tc:
                                    if "name" in tc["function"] and tc["function"]["name"]:
                                        tool_calls_buffer[idx]["function"]["name"] += tc["function"]["name"]
                                    if "arguments" in tc["function"] and tc["function"]["arguments"]:
                                        tool_calls_buffer[idx]["function"]["arguments"] += tc["function"]["arguments"]
                except Exception:
                    continue
                    
            if tool_calls_buffer:
                yield {
                    "type": "tool_calls",
                    "tool_calls": list(tool_calls_buffer.values())
                }
