from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.marketing import (
    CampaignCreate,
    CampaignResponse,
    CampaignUpdateMetrics,
    CampaignModifyBudget,
)
from app.services.marketing_service import (
    create_campaign,
    list_campaigns,
    update_campaign_metrics,
    modify_campaign_budget,
    analyze_campaign_performance,
)
from app.services.workspace_service import get_member_membership

router = APIRouter(prefix="/workspaces/{workspace_id}/marketing", tags=["Marketing Management"])


@router.get("/campaigns", response_model=SuccessResponse[List[CampaignResponse]])
def get_campaigns(
    workspace_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaigns = list_campaigns(db, workspace_id, current_user.id, status_filter=status_filter)
    return SuccessResponse(data=campaigns)


@router.post("/campaigns", response_model=SuccessResponse[CampaignResponse], status_code=status.HTTP_201_CREATED)
def add_campaign(
    workspace_id: str,
    body: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = create_campaign(
        db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        name=body.name,
        channel=body.channel,
        budget=body.budget,
        target_audience=body.target_audience,
        goals=body.goals,
    )
    return SuccessResponse(message="Campaign created.", data=campaign)


@router.patch("/campaigns/{campaign_id}/metrics", response_model=SuccessResponse[CampaignResponse])
def update_metrics(
    workspace_id: str,
    campaign_id: str,
    body: CampaignUpdateMetrics,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = update_campaign_metrics(
        db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        campaign_id=campaign_id,
        spend=body.spend,
        impressions=body.impressions,
        clicks=body.clicks,
        conversions=body.conversions,
    )
    return SuccessResponse(message="Metrics updated.", data=campaign)


@router.patch("/campaigns/{campaign_id}/budget", response_model=SuccessResponse[CampaignResponse])
def change_budget(
    workspace_id: str,
    campaign_id: str,
    body: CampaignModifyBudget,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = modify_campaign_budget(
        db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        campaign_id=campaign_id,
        new_budget=body.budget,
    )
    return SuccessResponse(message="Campaign budget updated.", data=campaign)


@router.get("/performance", response_model=SuccessResponse[Dict[str, Any]])
def get_performance(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = get_member_membership(db, workspace_id, current_user.id)
    if not membership:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found.")

    perf = analyze_campaign_performance(db, workspace_id)
    return SuccessResponse(data=perf)
