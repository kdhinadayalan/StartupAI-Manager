from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskResponse,
    TaskCommentCreate,
    TaskCommentResponse,
    TaskHistoryResponse,
)
from app.services.task_service import (
    create_task,
    list_workspace_tasks,
    get_task_detail,
    update_task,
    update_task_status,
    delete_task,
    add_task_comment,
    list_task_comments,
    delete_task_comment,
    get_task_history,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/tasks", tags=["Tasks"])


@router.post("", response_model=SuccessResponse[TaskResponse], status_code=status.HTTP_201_CREATED)
def create_new_task(
    workspace_id: str,
    task_in: TaskCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new task with audit history tracking."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    task = create_task(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        task_in=task_in,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Task created successfully.", data=task)


@router.get("", response_model=SuccessResponse[List[TaskResponse]])
def get_tasks(
    workspace_id: str,
    project_id: Optional[str] = Query(None, description="Filter by project"),
    status: Optional[str] = Query(None, description="Filter by status: TODO, IN_PROGRESS, REVIEW, DONE"),
    priority: Optional[str] = Query(None, description="Filter by priority: LOW, MEDIUM, HIGH, URGENT"),
    assignee_id: Optional[str] = Query(None, description="Filter by assignee user ID"),
    search: Optional[str] = Query(None, description="Search term for title/description"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List tasks in workspace with optional Kanban column/status and search filters."""
    tasks = list_workspace_tasks(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        project_id=project_id,
        status_filter=status,
        priority_filter=priority,
        assignee_id=assignee_id,
        search=search,
    )
    return SuccessResponse(data=tasks)


@router.get("/{task_id}", response_model=SuccessResponse[TaskResponse])
def get_single_task(
    workspace_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single task details with anti-IDOR workspace verification."""
    task = get_task_detail(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=current_user.id,
    )
    return SuccessResponse(data=task)


@router.patch("/{task_id}", response_model=SuccessResponse[TaskResponse])
def update_existing_task(
    workspace_id: str,
    task_id: str,
    update_in: TaskUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update task attributes, logging changed fields to immutable history."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    task = update_task(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=current_user.id,
        update_in=update_in,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Task updated successfully.", data=task)


@router.patch("/{task_id}/status", response_model=SuccessResponse[TaskResponse])
def change_task_status_kanban(
    workspace_id: str,
    task_id: str,
    status_update: TaskStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fast status transition endpoint optimized for Kanban drag-and-drop actions."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    task = update_task_status(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=current_user.id,
        status_update=status_update,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Task status updated.", data=task)


@router.delete("/{task_id}", response_model=SuccessResponse[dict])
def remove_task(
    workspace_id: str,
    task_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a task (Requires TASK_DELETE permission)."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    delete_task(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=current_user.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Task deleted successfully.")


@router.post("/{task_id}/comments", response_model=SuccessResponse[TaskCommentResponse], status_code=status.HTTP_201_CREATED)
def post_comment(
    workspace_id: str,
    task_id: str,
    comment_in: TaskCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a comment to a task (XSS sanitized, history recorded)."""
    comment = add_task_comment(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=current_user.id,
        comment_in=comment_in,
    )
    return SuccessResponse(message="Comment added successfully.", data=comment)


@router.get("/{task_id}/comments", response_model=SuccessResponse[List[TaskCommentResponse]])
def get_comments(
    workspace_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List comments for a task."""
    comments = list_task_comments(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=current_user.id,
    )
    return SuccessResponse(data=comments)


@router.delete("/{task_id}/comments/{comment_id}", response_model=SuccessResponse[dict])
def remove_comment(
    workspace_id: str,
    task_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a comment (Allowed for comment author or Admin/Owner)."""
    delete_task_comment(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        comment_id=comment_id,
        user_id=current_user.id,
    )
    return SuccessResponse(message="Comment deleted successfully.")


@router.get("/{task_id}/history", response_model=SuccessResponse[List[TaskHistoryResponse]])
def get_history(
    workspace_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve immutable audit log of task activities."""
    history = get_task_history(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=current_user.id,
    )
    return SuccessResponse(data=history)
