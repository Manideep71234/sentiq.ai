from typing import AsyncGenerator, Dict, List, Any, Optional
from abc import ABC, abstractmethod

class BaseProvider(ABC):
    @abstractmethod
    async def generate_stream(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Yields either:
        {"type": "content", "delta": "string"}
        or
        {"type": "tool_calls", "tool_calls": [...list of tool call dicts...]}
        """
        pass
