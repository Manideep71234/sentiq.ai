from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from core.database import get_session
from core.models import User, Task
from core.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.get("/")
def get_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    return db.exec(select(Task).where(Task.user_id == user.id).order_by(Task.due_date)).all()

@router.post("/")
def create_task(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    due_date = None
    if data.get("due_date"):
        due_date = datetime.fromisoformat(data["due_date"].replace('Z', '+00:00'))

    task = Task(
        user_id=user.id,
        title=data["title"],
        description=data.get("description"),
        due_date=due_date,
        priority=data.get("priority")
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.put("/{task_id}")
def update_task(task_id: int, data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    task = db.exec(select(Task).where(Task.id == task_id, Task.user_id == user.id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if "title" in data: task.title = data["title"]
    if "description" in data: task.description = data["description"]
    if "priority" in data: task.priority = data["priority"]
    if "done" in data: task.done = data["done"]
    
    if "due_date" in data:
        if data["due_date"]:
            task.due_date = datetime.fromisoformat(data["due_date"].replace('Z', '+00:00'))
        else:
            task.due_date = None
            
    db.commit()
    db.refresh(task)
    return task

@router.delete("/{task_id}")
def delete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_session)):
    task = db.exec(select(Task).where(Task.id == task_id, Task.user_id == user.id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    db.delete(task)
    db.commit()
    return {"status": "success"}
