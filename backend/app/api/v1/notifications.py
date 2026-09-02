from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.services.notification_service import (
    list_notifications,
    get_unread_count,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/notifications", tags=["Notifications & Alerts"])


@router.get("", response_model=SuccessResponse[List[NotificationResponse]])
def get_notifications(
    workspace_id: str,
    unread_only: bool = Query(False, description="Filter only unread alerts"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List notifications for the current authenticated user in this workspace."""
    items = list_notifications(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    return SuccessResponse(data=items)


@router.get("/unread-count", response_model=SuccessResponse[UnreadCountResponse])
def get_unread_badge_count(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the unread notification count for the user's notification bell."""
    count = get_unread_count(db=db, workspace_id=workspace_id, user_id=current_user.id)
    return SuccessResponse(data=UnreadCountResponse(unread_count=count))


@router.patch("/{notification_id}/read", response_model=SuccessResponse[NotificationResponse])
def mark_read(
    workspace_id: str,
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark an individual notification as read."""
    notification = mark_notification_as_read(
        db=db,
        workspace_id=workspace_id,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    return SuccessResponse(message="Notification marked as read.", data=notification)


@router.post("/read-all", response_model=SuccessResponse[dict])
def mark_all_read(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications as read."""
    updated = mark_all_notifications_as_read(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
    )
    return SuccessResponse(message="All notifications marked as read.", data={"marked_count": updated})
