from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, ScheduledTask, TaskResult
from core.auth import get_current_user
from core.scheduler import sync_db_tasks

router = APIRouter(prefix="/scheduled-tasks", tags=["scheduled-tasks"])

@router.get("/")
def get_scheduled_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    return db.exec(select(ScheduledTask).where(ScheduledTask.user_id == user.id)).all()

@router.post("/")
def create_scheduled_task(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    task = ScheduledTask(
        user_id=user.id,
        name=data["name"],
        prompt=data["prompt"],
        cron_expression=data["cron_expression"],
        enabled=data.get("enabled", True)
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Sync with APScheduler
    sync_db_tasks()
    return task

@router.put("/{task_id}")
def update_scheduled_task(task_id: int, data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    task = db.exec(select(ScheduledTask).where(ScheduledTask.id == task_id, ScheduledTask.user_id == user.id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Scheduled Task not found")
        
    if "name" in data: task.name = data["name"]
    if "prompt" in data: task.prompt = data["prompt"]
    if "cron_expression" in data: task.cron_expression = data["cron_expression"]
    if "enabled" in data: task.enabled = data["enabled"]
    
    db.commit()
    db.refresh(task)
    
    # Sync with APScheduler
    sync_db_tasks()
    return task

@router.delete("/{task_id}")
def delete_scheduled_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    task = db.exec(select(ScheduledTask).where(ScheduledTask.id == task_id, ScheduledTask.user_id == user.id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Scheduled Task not found")
        
    # Delete associated results
    results = db.exec(select(TaskResult).where(TaskResult.scheduled_task_id == task.id)).all()
    for r in results:
        db.delete(r)
        
    db.delete(task)
    db.commit()
    
    # Sync with APScheduler
    sync_db_tasks()
    return {"status": "success"}

@router.get("/results")
def get_task_results(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    # Get all scheduled tasks for user
    tasks = db.exec(select(ScheduledTask).where(ScheduledTask.user_id == user.id)).all()
    task_ids = [t.id for t in tasks]
    
    if not task_ids:
        return []
        
    # Get results for those tasks
    # For SQLite compatibility in IN clause, pass a list
    statement = select(TaskResult).where(TaskResult.scheduled_task_id.in_(task_ids)).order_by(TaskResult.created_at.desc())
    results = db.exec(statement).all()
    
    # Hydrate with task names for UI convenience
    task_map = {t.id: t.name for t in tasks}
    return [
        {
            "id": r.id,
            "scheduled_task_id": r.scheduled_task_id,
            "task_name": task_map.get(r.scheduled_task_id, "Unknown"),
            "output": r.output,
            "created_at": r.created_at.isoformat() + "Z"
        }
        for r in results
    ]
