from typing import Any, Dict, Optional
import json
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.database.base import utc_now


def log_audit_event(
    db: Session,
    action: str,
    user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> AuditLog:
    """Record an audit log entry in the database."""
    details_str = json.dumps(details) if details else None
    audit_entry = AuditLog(
        action=action,
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details_str,
        ip_address=ip_address,
        correlation_id=correlation_id,
        timestamp=utc_now(),
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry
