from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    user_id: Optional[str] = None
    type: str
    severity: str
    title: str
    message: str
    link: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    unread_count: int
