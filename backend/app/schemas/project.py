from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.project import ProjectStatus
from app.schemas.user import UserResponse


class ProjectBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: str = Field("MEDIUM", pattern="^(LOW|MEDIUM|HIGH|URGENT)$")
    deadline: Optional[datetime] = None
    budget: Optional[float] = Field(None, ge=0)
    owner_id: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[str] = Field(None, pattern="^(LOW|MEDIUM|HIGH|URGENT)$")
    deadline: Optional[datetime] = None
    budget: Optional[float] = Field(None, ge=0)
    owner_id: Optional[str] = None


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    workspace_id: str
    created_by_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    owner: Optional[UserResponse] = None
    created_by: Optional[UserResponse] = None


class ProjectMemberCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    role: str = Field("MEMBER", min_length=2, max_length=50)


class ProjectMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    user_id: str
    role: str
    joined_at: datetime
    user: Optional[UserResponse] = None
