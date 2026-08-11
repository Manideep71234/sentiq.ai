import json
import httpx
from typing import AsyncGenerator, Dict, List, Any, Optional
from .base import BaseProvider
from core.config import settings
import logging

_client = None

def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=60.0, limits=httpx.Limits(max_keepalive_connections=50))
    return _client

class GeminiProvider(BaseProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key.strip()
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        
    async def generate_stream(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        
        contents = []
        system_instruction = None
        
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            
            if role == "system":
                if not system_instruction:
                    system_instruction = {"role": "user", "parts": [{"text": content}]}
                else:
                    system_instruction["parts"][0]["text"] += f"\n{content}"
            elif role == "user":
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "assistant":
                part = {"text": content}
                if msg.get("tool_calls"):
                    part["text"] += f"\n[Tool Calls: {json.dumps(msg.get('tool_calls'))}]"
                contents.append({"role": "model", "parts": [part]})
            elif role == "tool":
                contents.append({
                    "role": "user", 
                    "parts": [{"functionResponse": {"name": msg.get("name", "tool"), "response": {"result": content}}}]
                })
        
        payload = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": settings.MAX_TOKENS_PER_REQUEST
            }
        }
        
        if system_instruction:
            payload["systemInstruction"] = system_instruction
            
        if tools:
            gemini_tools = []
            for t in tools:
                if t.get("type") == "function":
                    fn = t.get("function", {})
                    gemini_tools.append({
                        "name": fn.get("name"),
                        "description": fn.get("description", ""),
                        "parameters": fn.get("parameters", {})
                    })
            if gemini_tools:
                payload["tools"] = [{"functionDeclarations": gemini_tools}]
                
        client = get_client()
        url = f"{self.base_url}/models/{model}:streamGenerateContent?key={self.api_key}&alt=sse"
        
        async with client.stream(
            "POST", 
            url,
            headers={"Content-Type": "application/json"},
            json=payload
        ) as response:
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                await response.aread()
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logging.error(error_msg)
                raise Exception(error_msg) from e
                
            tool_calls_buffer = {}
            
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]" or not data_str.strip():
                    continue
                
                try:
                    data = json.loads(data_str)
                    
                    if "error" in data:
                        error_msg = data["error"].get("message", str(data["error"]))
                        yield {"error": error_msg}
                        break
                        
                    if "candidates" in data and len(data["candidates"]) > 0:
                        candidate = data["candidates"][0]
                        content = candidate.get("content", {})
                        parts = content.get("parts", [])
                        
                        for part in parts:
                            if "text" in part and part["text"]:
                                yield {"type": "content", "delta": part["text"]}
                            
                            if "functionCall" in part:
                                fc = part["functionCall"]
                                idx = 0 
                                if idx not in tool_calls_buffer:
                                    tool_calls_buffer[idx] = {
                                        "id": f"call_{fc.get('name')}",
                                        "type": "function",
                                        "function": {
                                            "name": fc.get("name", ""),
                                            "arguments": ""
                                        }
                                    }
                                
                                if "args" in fc:
                                    args_json = json.dumps(fc["args"])
                                    tool_calls_buffer[idx]["function"]["arguments"] = args_json
                                    
                except Exception as e:
                    logging.error(f"Error processing streaming data '{data_str}': {e}")
                    continue
                    
            if tool_calls_buffer:
                yield {
                    "type": "tool_calls",
                    "tool_calls": list(tool_calls_buffer.values())
                }
