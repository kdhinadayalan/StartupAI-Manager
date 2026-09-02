import pytest
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.models.notification import Notification, NotificationType, NotificationSeverity
from app.services.notification_service import (
    create_notification,
    list_notifications,
    get_unread_count,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)


def test_notification_creation_and_duplicate_prevention(db: Session):
    user = User(email="notif_owner@test.io", hashed_password="pw", full_name="Notif Owner")
    db.add(user)
    db.flush()

    ws = Workspace(name="Notif WS", owner_id=user.id)
    db.add(ws)
    db.flush()

    mem = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="OWNER")
    db.add(mem)
    db.commit()

    # 1. Create initial notification with event_key
    n1 = create_notification(
        db=db,
        workspace_id=ws.id,
        title="Budget Exceeded",
        message="Operations budget exceeded by $500",
        type=NotificationType.BUDGET_OVERRUN.value,
        severity=NotificationSeverity.WARNING.value,
        event_key="OVERRUN:ws:OPERATIONS",
    )
    assert n1 is not None
    assert n1.is_read is False

    # 2. Duplicate prevention: repeated trigger with same event_key within 24h is deduplicated
    n2 = create_notification(
        db=db,
        workspace_id=ws.id,
        title="Budget Exceeded Duplicate",
        message="Operations budget exceeded by $500 again",
        type=NotificationType.BUDGET_OVERRUN.value,
        severity=NotificationSeverity.WARNING.value,
        event_key="OVERRUN:ws:OPERATIONS",
    )
    assert n2.id == n1.id  # Returns existing without creating duplicate

    # 3. Different event_key creates separate notification
    n3 = create_notification(
        db=db,
        workspace_id=ws.id,
        title="Critical Risk Detected",
        message="Overdue tasks detected",
        type=NotificationType.RISK_ALERT.value,
        severity=NotificationSeverity.CRITICAL.value,
        event_key="RISK:ws:OVERDUE",
    )
    assert n3.id != n1.id


def test_notification_read_lifecycle(db: Session):
    user = User(email="notif_user2@test.io", hashed_password="pw", full_name="Notif User 2")
    db.add(user)
    db.flush()

    ws = Workspace(name="Notif WS 2", owner_id=user.id)
    db.add(ws)
    db.flush()

    mem = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="OWNER")
    db.add(mem)
    db.commit()

    # Add 3 notifications
    for i in range(3):
        create_notification(
            db=db,
            workspace_id=ws.id,
            title=f"Alert {i}",
            message=f"Message {i}",
            user_id=user.id,
        )

    assert get_unread_count(db, ws.id, user.id) == 3
    items = list_notifications(db, ws.id, user.id, unread_only=True)
    assert len(items) == 3

    # Mark first read
    mark_notification_as_read(db, ws.id, items[0].id, user.id)
    assert get_unread_count(db, ws.id, user.id) == 2

    # Mark all read
    marked = mark_all_notifications_as_read(db, ws.id, user.id)
    assert marked == 2
    assert get_unread_count(db, ws.id, user.id) == 0
