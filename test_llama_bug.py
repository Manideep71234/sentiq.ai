import os
os.environ["DATABASE_URL"] = "sqlite:///terminator.db"

import asyncio
from sqlmodel import Session, select, SQLModel
from core.database import engine
from core.models import User, ChatSession, ChatMessage
from core.agents.agent import run_agent_loop

async def main():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        user = db.exec(select(User)).first()
        if not user:
            user = User(username="testuser", password_hash="hash")
            db.add(user)
            db.commit()
            db.refresh(user)
            
        chat_session = ChatSession(user_id=user.id, title="Test Llama Bug")
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)
        
        messages = [{"role": "user", "content": "hi"}]
        
        print("Sending 'hi' to llama-3.1-8b-instant...")
        
        full_response = ""
        async for chunk in run_agent_loop(chat_session.id, user.id, db, messages, "groq", "llama-3.1-8b-instant"):
            if chunk.get("type") == "content":
                full_response += chunk.get("content", "")
                
        print("\n--- Response ---")
        print(full_response)
        print("----------------")
        
        # Cleanup
        db.delete(chat_session)
        db.commit()

if __name__ == "__main__":
    asyncio.run(main())
