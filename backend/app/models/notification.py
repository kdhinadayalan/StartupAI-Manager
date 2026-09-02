from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, generate_uuid, utc_now


class NotificationType(str, Enum):
    AI_APPROVAL_PENDING = "AI_APPROVAL_PENDING"
    RISK_ALERT = "RISK_ALERT"
    BUDGET_OVERRUN = "BUDGET_OVERRUN"
    TASK_ASSIGNED = "TASK_ASSIGNED"
    SYSTEM_NOTICE = "SYSTEM_NOTICE"


class NotificationSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class Notification(Base):
    """
    In-app notification entity supporting user-targeted alerts and workspace-wide announcements.
    Includes event_key to prevent duplicate notifications for repeated occurrences of the same event.
    """
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    type: Mapped[str] = mapped_column(String(50), default=NotificationType.SYSTEM_NOTICE.value, nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), default=NotificationSeverity.INFO.value, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resource_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    event_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace")
    user: Mapped[Optional["User"]] = relationship("User")
