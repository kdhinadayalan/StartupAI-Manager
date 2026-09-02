from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.permissions import Role
from app.schemas.user import UserResponse


class WorkspaceBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    website: Optional[str] = None
    region: Optional[str] = None
    currency: str = Field("USD", min_length=1, max_length=10)


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    website: Optional[str] = None
    region: Optional[str] = None
    currency: Optional[str] = None


class WorkspaceResponse(WorkspaceBase):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime


class WorkspaceMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    user_id: str
    role: Role
    joined_at: datetime
    user: Optional[UserResponse] = None


class MemberInviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    role: Role = Role.TEAM_MEMBER


class MemberUpdateRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Role
