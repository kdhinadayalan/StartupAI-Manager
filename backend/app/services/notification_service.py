from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.notification import Notification, NotificationType, NotificationSeverity
from app.services.workspace_service import get_member_membership


def create_notification(
    db: Session,
    workspace_id: str,
    title: str,
    message: str,
    type: str = NotificationType.SYSTEM_NOTICE.value,
    severity: str = NotificationSeverity.INFO.value,
    user_id: Optional[str] = None,
    link: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    event_key: Optional[str] = None,
) -> Optional[Notification]:
    """
    Create a persistent notification.
    Enforces idempotency / duplicate prevention via event_key.
    If an event with the same event_key was logged within the past 24 hours, skips creation.
    """
    if event_key:
        twenty_four_hours_ago = utc_now() - timedelta(hours=24)
        existing = db.execute(
            select(Notification).where(
                Notification.workspace_id == workspace_id,
                Notification.event_key == event_key,
                Notification.created_at >= twenty_four_hours_ago,
            )
        ).scalar_one_or_none()
        if existing:
            return existing

    notification = Notification(
        workspace_id=workspace_id,
        user_id=user_id,
        type=type,
        severity=severity,
        title=title,
        message=message,
        link=link,
        resource_type=resource_type,
        resource_id=resource_id,
        event_key=event_key,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def list_notifications(
    db: Session,
    workspace_id: str,
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> List[Notification]:
    """
    List user-accessible notifications within workspace.
    Enforces strict tenant isolation and user visibility.
    """
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    user_role = Role(membership.role)
    if not check_role_permission(user_role, Permission.NOTIFICATION_READ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to read notifications.",
        )

    query = select(Notification).where(
        Notification.workspace_id == workspace_id,
        (Notification.user_id == user_id) | (Notification.user_id.is_(None)),
    )
    if unread_only:
        query = query.where(Notification.is_read.is_(False))

    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    return list(db.execute(query).scalars().all())


def get_unread_count(
    db: Session,
    workspace_id: str,
    user_id: str,
) -> int:
    """Get total count of unread notifications for user badge."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    count = db.execute(
        select(func.count(Notification.id)).where(
            Notification.workspace_id == workspace_id,
            (Notification.user_id == user_id) | (Notification.user_id.is_(None)),
            Notification.is_read.is_(False),
        )
    ).scalar_one()
    return count


def mark_notification_as_read(
    db: Session,
    workspace_id: str,
    notification_id: str,
    user_id: str,
) -> Notification:
    """Mark a specific notification as read."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    notification = db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.workspace_id == workspace_id,
            (Notification.user_id == user_id) | (Notification.user_id.is_(None)),
        )
    ).scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_notifications_as_read(
    db: Session,
    workspace_id: str,
    user_id: str,
) -> int:
    """Mark all unread notifications for this user/workspace as read."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    result = db.execute(
        update(Notification)
        .where(
            Notification.workspace_id == workspace_id,
            (Notification.user_id == user_id) | (Notification.user_id.is_(None)),
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    db.commit()
    return result.rowcount
