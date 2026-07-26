from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from core.database import engine
from sqlmodel import Session, select
from core.models import ScheduledTask, TaskResult
import asyncio
import json

# Setup Job Store pointing to our existing SQLite DB
jobstores = {
    'default': SQLAlchemyJobStore(engine=engine, tablename='apscheduler_jobs')
}

scheduler = AsyncIOScheduler(jobstores=jobstores)

async def execute_scheduled_task(scheduled_task_id: int):
    # Import agent loop here to avoid circular imports
    from core.agents.agent import run_agent_loop
    
    with Session(engine) as db:
        scheduled_task = db.exec(select(ScheduledTask).where(ScheduledTask.id == scheduled_task_id)).first()
        if not scheduled_task or not scheduled_task.enabled:
            return
            
        user_id = scheduled_task.user_id
        prompt = scheduled_task.prompt
        
        # We need a dummy session_id for the agent loop
        session_id = -1 
        messages = [{"role": "user", "content": prompt}]
        
        try:
            full_response = ""
            async for chunk in run_agent_loop(session_id, user_id, db, messages, provider_name="openrouter", model="openrouter/free"):
                if chunk["type"] == "content":
                    full_response += chunk["content"]
                    
            # Save result
            task_result = TaskResult(
                scheduled_task_id=scheduled_task.id,
                output=full_response
            )
            db.add(task_result)
            
            # Update last run
            from datetime import datetime, timezone
            scheduled_task.last_run_at = datetime.now(timezone.utc).replace(tzinfo=None)
            
            db.commit()
        except Exception as e:
            # Save error
            task_result = TaskResult(
                scheduled_task_id=scheduled_task.id,
                output=f"Error executing task: {str(e)}"
            )
            db.add(task_result)
            db.commit()

def start_scheduler():
    if not scheduler.running:
        scheduler.start()

def sync_db_tasks():
    """Reads ScheduledTasks from DB and registers them in APScheduler"""
    with Session(engine) as db:
        tasks = db.exec(select(ScheduledTask).where(ScheduledTask.enabled == True)).all()
        
        # Remove all existing jobs to start fresh
        scheduler.remove_all_jobs()
        
        for task in tasks:
            from apscheduler.triggers.cron import CronTrigger
            try:
                trigger = CronTrigger.from_crontab(task.cron_expression)
                scheduler.add_job(
                    execute_scheduled_task, 
                    trigger=trigger, 
                    args=[task.id], 
                    id=f"task_{task.id}",
                    replace_existing=True
                )
            except Exception as e:
                print(f"Failed to schedule task {task.id}: {e}")
