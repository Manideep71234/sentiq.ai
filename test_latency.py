import asyncio
import time
# pyrefly: ignore [missing-import]
from sqlmodel import Session
from core.database import engine
from core.models import User
from core.agents.agent import run_agent_loop

async def test_latency():
    with Session(engine) as db:
        user = db.query(User).first()
        if not user:
            print("No user")
            return
            
        print("Starting agent loop")
        t0 = time.time()
        
        # mock messages
        messages = [{"role": "user", "content": "Hello"}]
        
        async for chunk in run_agent_loop(1, user.id, db, messages, "openrouter", "openrouter/free"):
            t1 = time.time()
            print(f"[{t1-t0:.2f}s] Received chunk type: {chunk.get('type')}")
            if chunk.get("type") == "content":
                print(f"Content length: {len(chunk.get('content', ''))}")
                break

if __name__ == "__main__":
    asyncio.run(test_latency())
