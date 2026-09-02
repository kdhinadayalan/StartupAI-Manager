from typing import Any, Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.services.dashboard_service import get_executive_dashboard_summary

router = APIRouter(prefix="/workspaces/{workspace_id}/dashboard", tags=["Executive Dashboard"])


@router.get("/summary", response_model=SuccessResponse[Dict[str, Any]])
def get_dashboard_summary(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve aggregated executive dashboard data including deterministic Startup Health Score,
    delivery progress, runway safety, open risks, marketing ROI, pending AI approvals, and recent alerts.
    Strictly verifies workspace membership and RBAC permissions.
    """
    summary = get_executive_dashboard_summary(db, workspace_id, current_user.id)
    return SuccessResponse(data=summary)
