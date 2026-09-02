from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.risk import RiskCreate, RiskStatusUpdate, RiskResponse
from app.services.risk_service import (
    create_risk_item,
    list_risk_items,
    update_risk_status,
    scan_startup_risks,
    calculate_risk_score,
)
from app.services.workspace_service import get_member_membership

router = APIRouter(prefix="/workspaces/{workspace_id}/risks", tags=["Risk Detection & Management"])


@router.get("", response_model=SuccessResponse[List[RiskResponse]])
def get_risks(
    workspace_id: str,
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    risks = list_risk_items(db, workspace_id, current_user.id, category=category, severity=severity)
    return SuccessResponse(data=risks)


@router.post("", response_model=SuccessResponse[RiskResponse], status_code=status.HTTP_201_CREATED)
def add_risk(
    workspace_id: str,
    body: RiskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    risk = create_risk_item(
        db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        title=body.title,
        category=body.category,
        likelihood=body.likelihood,
        impact=body.impact,
        description=body.description,
        mitigation_plan=body.mitigation_plan,
        detected_by="HUMAN",
    )
    return SuccessResponse(message="Risk item created.", data=risk)


@router.patch("/{risk_id}/status", response_model=SuccessResponse[RiskResponse])
def update_status(
    workspace_id: str,
    risk_id: str,
    body: RiskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    risk = update_risk_status(
        db,
        workspace_id=workspace_id,
        risk_id=risk_id,
        user_id=current_user.id,
        status_str=body.status,
        mitigation_plan=body.mitigation_plan,
    )
    return SuccessResponse(message="Risk status updated.", data=risk)


@router.get("/scan", response_model=SuccessResponse[List[Dict[str, Any]]])
def scan_risks(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = get_member_membership(db, workspace_id, current_user.id)
    if not membership:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found.")

    signals = scan_startup_risks(db, workspace_id)
    return SuccessResponse(data=signals)


@router.get("/calculate-score", response_model=SuccessResponse[Dict[str, Any]])
def calculate_score(
    likelihood: int = Query(..., ge=1, le=5),
    impact: int = Query(..., ge=1, le=5),
):
    score, severity = calculate_risk_score(likelihood, impact)
    return SuccessResponse(data={"likelihood": likelihood, "impact": impact, "risk_score": score, "severity": severity})
