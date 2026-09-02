from typing import List, Optional
import html
from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.project import Project
from app.models.task import Task, TaskComment, TaskHistory, TaskStatus, TaskPriority
from app.models.workspace import WorkspaceMember
from app.schemas.task import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskCommentCreate
from app.services.audit_service import log_audit_event
from app.services.workspace_service import get_member_membership


def record_task_history(
    db: Session,
    workspace_id: str,
    task_id: str,
    action: str,
    user_id: Optional[str] = None,
    field_changed: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
) -> TaskHistory:
    """Record an immutable history log for a task."""
    history_entry = TaskHistory(
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=user_id,
        action=action,
        field_changed=field_changed,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        created_at=utc_now(),
    )
    db.add(history_entry)
    return history_entry


def create_task(
    db: Session,
    workspace_id: str,
    user_id: str,
    task_in: TaskCreate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Task:
    """Create a task within a verified project and workspace."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    if not check_role_permission(Role(membership.role), Permission.TASK_CREATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to create tasks.",
        )

    # Verify project belongs to this workspace
    project = db.execute(
        select(Project).where(
            Project.id == task_in.project_id,
            Project.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found in this workspace.",
        )

    # Verify assignee belongs to this workspace if assigned
    if task_in.assignee_id:
        assignee_membership = get_member_membership(db, workspace_id, task_in.assignee_id)
        if not assignee_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task assignee must be a member of this workspace.",
            )

    # Sanitize title and description against stored XSS
    sanitized_title = html.escape(task_in.title.strip())
    sanitized_description = html.escape(task_in.description.strip()) if task_in.description else None

    task = Task(
        workspace_id=workspace_id,
        project_id=task_in.project_id,
        title=sanitized_title,
        description=sanitized_description,
        status=task_in.status.value,
        priority=task_in.priority.value,
        assignee_id=task_in.assignee_id,
        created_by_id=user_id,
        due_date=task_in.due_date,
        estimated_hours=task_in.estimated_hours,
        actual_hours=task_in.actual_hours,
        tags=task_in.tags,
    )
    db.add(task)
    db.flush()

    # Record history
    record_task_history(
        db=db,
        workspace_id=workspace_id,
        task_id=task.id,
        user_id=user_id,
        action="TASK_CREATED",
        new_value=f"Created with status {task.status}",
    )

    db.commit()

    # Reload with relationships
    task = db.execute(
        select(Task)
        .options(joinedload(Task.assignee), joinedload(Task.created_by))
        .where(Task.id == task.id)
    ).scalar_one()

    log_audit_event(
        db=db,
        action="TASK_CREATED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="task",
        resource_id=task.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details={"title": task.title, "status": task.status},
    )
    return task


def list_workspace_tasks(
    db: Session,
    workspace_id: str,
    user_id: str,
    project_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    assignee_id: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Task]:
    """Retrieve tasks with optional Kanban status, priority, and project filters."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    query = (
        select(Task)
        .options(joinedload(Task.assignee), joinedload(Task.created_by))
        .where(Task.workspace_id == workspace_id)
    )

    if project_id:
        query = query.where(Task.project_id == project_id)
    if status_filter:
        query = query.where(Task.status == status_filter)
    if priority_filter:
        query = query.where(Task.priority == priority_filter)
    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Task.title.ilike(search_term),
                Task.description.ilike(search_term),
            )
        )

    query = query.order_by(Task.created_at.desc())
    return list(db.execute(query).scalars().all())


def get_task_detail(
    db: Session,
    workspace_id: str,
    task_id: str,
    user_id: str,
) -> Task:
    """Retrieve a single task enforcing strict workspace isolation."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    task = db.execute(
        select(Task)
        .options(joinedload(Task.assignee), joinedload(Task.created_by))
        .where(Task.id == task_id, Task.workspace_id == workspace_id)
    ).scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this workspace.",
        )
    return task


def update_task(
    db: Session,
    workspace_id: str,
    task_id: str,
    user_id: str,
    update_in: TaskUpdate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Task:
    """Update task fields and record detailed history entries for all changes."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    if not check_role_permission(Role(membership.role), Permission.TASK_UPDATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to update tasks.",
        )

    task = get_task_detail(db, workspace_id, task_id, user_id)
    update_data = update_in.model_dump(exclude_unset=True)

    if "assignee_id" in update_data and update_data["assignee_id"]:
        assignee_membership = get_member_membership(db, workspace_id, update_data["assignee_id"])
        if not assignee_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task assignee must be a member of this workspace.",
            )

    if "project_id" in update_data and update_data["project_id"]:
        project = db.execute(
            select(Project).where(
                Project.id == update_data["project_id"],
                Project.workspace_id == workspace_id,
            )
        ).scalar_one_or_none()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found in this workspace.",
            )

    # Sanitize title and description if updated
    if "title" in update_data and update_data["title"]:
        update_data["title"] = html.escape(update_data["title"].strip())
    if "description" in update_data and update_data["description"]:
        update_data["description"] = html.escape(update_data["description"].strip())

    # Detect field differences and record TaskHistory
    for field, new_val in update_data.items():
        if hasattr(task, field):
            old_val = getattr(task, field)
            # Enum conversion if needed
            val_to_set = new_val.value if hasattr(new_val, "value") else new_val
            if str(old_val) != str(val_to_set):
                record_task_history(
                    db=db,
                    workspace_id=workspace_id,
                    task_id=task.id,
                    user_id=user_id,
                    action=f"{field.upper()}_CHANGED",
                    field_changed=field,
                    old_value=str(old_val),
                    new_value=str(val_to_set),
                )
                setattr(task, field, val_to_set)

    db.commit()
    db.refresh(task)

    log_audit_event(
        db=db,
        action="TASK_UPDATED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="task",
        resource_id=task.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details=update_data,
    )
    return task


def update_task_status(
    db: Session,
    workspace_id: str,
    task_id: str,
    user_id: str,
    status_update: TaskStatusUpdate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Task:
    """Updates task status for Kanban movements with validation and audit history."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    if not check_role_permission(Role(membership.role), Permission.TASK_UPDATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to change task status.",
        )

    task = get_task_detail(db, workspace_id, task_id, user_id)
    old_status = task.status
    new_status = status_update.status.value

    if old_status != new_status:
        task.status = new_status
        record_task_history(
            db=db,
            workspace_id=workspace_id,
            task_id=task.id,
            user_id=user_id,
            action="STATUS_CHANGED",
            field_changed="status",
            old_value=old_status,
            new_value=new_status,
        )
        db.commit()
        db.refresh(task)

        log_audit_event(
            db=db,
            action="TASK_STATUS_CHANGED",
            user_id=user_id,
            workspace_id=workspace_id,
            resource_type="task",
            resource_id=task.id,
            ip_address=ip_address,
            correlation_id=correlation_id,
            details={"old_status": old_status, "new_status": new_status},
        )

    return task


def delete_task(
    db: Session,
    workspace_id: str,
    task_id: str,
    user_id: str,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """Delete a task (Requires TASK_DELETE permission)."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    if not check_role_permission(Role(membership.role), Permission.TASK_DELETE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to delete tasks.",
        )

    task = get_task_detail(db, workspace_id, task_id, user_id)
    db.delete(task)
    db.commit()

    log_audit_event(
        db=db,
        action="TASK_DELETED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="task",
        resource_id=task_id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return True


def add_task_comment(
    db: Session,
    workspace_id: str,
    task_id: str,
    user_id: str,
    comment_in: TaskCommentCreate,
) -> TaskComment:
    """Add a sanitized comment to a task and record history."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    if not check_role_permission(Role(membership.role), Permission.TASK_COMMENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to comment on tasks.",
        )

    # Ensure task exists in workspace
    get_task_detail(db, workspace_id, task_id, user_id)

    # Escape HTML to prevent stored XSS
    sanitized_content = html.escape(comment_in.content.strip())

    comment = TaskComment(
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=user_id,
        content=sanitized_content,
    )
    db.add(comment)
    db.flush()

    record_task_history(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=user_id,
        action="COMMENT_ADDED",
        new_value=sanitized_content[:100],
    )

    db.commit()

    # Load with user
    comment = db.execute(
        select(TaskComment)
        .options(joinedload(TaskComment.user))
        .where(TaskComment.id == comment.id)
    ).scalar_one()

    return comment


def list_task_comments(
    db: Session,
    workspace_id: str,
    task_id: str,
    user_id: str,
) -> List[TaskComment]:
    """List comments for a task in chronological order."""
    get_task_detail(db, workspace_id, task_id, user_id)

    query = (
        select(TaskComment)
        .options(joinedload(TaskComment.user))
        .where(TaskComment.task_id == task_id, TaskComment.workspace_id == workspace_id)
        .order_by(TaskComment.created_at.asc())
    )
    return list(db.execute(query).scalars().all())


def delete_task_comment(
    db: Session,
    workspace_id: str,
    task_id: str,
    comment_id: str,
    user_id: str,
) -> bool:
    """Delete comment if user is author or has Admin/Owner role."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    comment = db.execute(
        select(TaskComment).where(
            TaskComment.id == comment_id,
            TaskComment.task_id == task_id,
            TaskComment.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found.",
        )

    # Check permission: author or Admin/Owner
    is_author = comment.user_id == user_id
    has_delete_perm = check_role_permission(Role(membership.role), Permission.TASK_DELETE)

    if not is_author and not has_delete_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments.",
        )

    db.delete(comment)

    record_task_history(
        db=db,
        workspace_id=workspace_id,
        task_id=task_id,
        user_id=user_id,
        action="COMMENT_DELETED",
    )

    db.commit()
    return True


def get_task_history(
    db: Session,
    workspace_id: str,
    task_id: str,
    user_id: str,
) -> List[TaskHistory]:
    """Retrieve immutable audit history for a task."""
    get_task_detail(db, workspace_id, task_id, user_id)

    query = (
        select(TaskHistory)
        .options(joinedload(TaskHistory.user))
        .where(TaskHistory.task_id == task_id, TaskHistory.workspace_id == workspace_id)
        .order_by(TaskHistory.created_at.desc())
    )
    return list(db.execute(query).scalars().all())
