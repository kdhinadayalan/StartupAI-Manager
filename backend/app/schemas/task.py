from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskStatus, TaskPriority
from app.schemas.user import UserResponse


class TaskBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = Field(None, ge=0)
    actual_hours: Optional[float] = Field(None, ge=0)
    tags: Optional[str] = None
    assignee_id: Optional[str] = None


class TaskCreate(TaskBase):
    project_id: str


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = Field(None, ge=0)
    actual_hours: Optional[float] = Field(None, ge=0)
    tags: Optional[str] = None
    assignee_id: Optional[str] = None
    project_id: Optional[str] = None


class TaskStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: TaskStatus


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    workspace_id: str
    project_id: str
    created_by_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    assignee: Optional[UserResponse] = None
    created_by: Optional[UserResponse] = None


class TaskCommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(..., min_length=1, max_length=5000)


class TaskCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    task_id: str
    user_id: str
    content: str
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None


class TaskHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    task_id: str
    user_id: Optional[str] = None
    action: str
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None
