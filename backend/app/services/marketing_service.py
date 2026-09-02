import html
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Role, Permission, check_role_permission
from app.models.marketing import MarketingCampaign, CampaignChannel, CampaignStatus
from app.services.workspace_service import get_member_membership
from app.services.audit_service import log_audit_event


def create_campaign(
    db: Session,
    workspace_id: str,
    user_id: str,
    name: str,
    channel: str = CampaignChannel.SOCIAL_MEDIA.value,
    budget: float = 0.0,
    target_audience: Optional[str] = None,
    goals: Optional[str] = None,
) -> MarketingCampaign:
    """Create a new marketing campaign."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.MARKETING_MANAGE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to manage marketing.")

    campaign = MarketingCampaign(
        workspace_id=workspace_id,
        name=html.escape(name.strip()),
        channel=channel,
        status=CampaignStatus.ACTIVE.value,
        budget=budget,
        spend=0.0,
        impressions=0,
        clicks=0,
        conversions=0,
        target_audience=html.escape(target_audience.strip()) if target_audience else None,
        goals=html.escape(goals.strip()) if goals else None,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def list_campaigns(
    db: Session,
    workspace_id: str,
    user_id: str,
    status_filter: Optional[str] = None,
) -> List[MarketingCampaign]:
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    query = select(MarketingCampaign).where(MarketingCampaign.workspace_id == workspace_id)
    if status_filter:
        query = query.where(MarketingCampaign.status == status_filter)
    return list(db.execute(query.order_by(MarketingCampaign.created_at.desc())).scalars().all())


def update_campaign_metrics(
    db: Session,
    workspace_id: str,
    user_id: str,
    campaign_id: str,
    spend: Optional[float] = None,
    impressions: Optional[int] = None,
    clicks: Optional[int] = None,
    conversions: Optional[int] = None,
) -> MarketingCampaign:
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.MARKETING_MANAGE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    campaign = db.execute(
        select(MarketingCampaign).where(
            MarketingCampaign.id == campaign_id,
            MarketingCampaign.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")

    if spend is not None:
        campaign.spend = spend
    if impressions is not None:
        campaign.impressions = impressions
    if clicks is not None:
        campaign.clicks = clicks
    if conversions is not None:
        campaign.conversions = conversions

    db.commit()
    db.refresh(campaign)
    return campaign


def modify_campaign_budget(
    db: Session,
    workspace_id: str,
    user_id: str,
    campaign_id: str,
    new_budget: float,
) -> MarketingCampaign:
    """Modify campaign budget. High impact action requiring MARKETING_MANAGE."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.MARKETING_MANAGE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to modify campaign budget.")

    campaign = db.execute(
        select(MarketingCampaign).where(
            MarketingCampaign.id == campaign_id,
            MarketingCampaign.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")

    old_budget = campaign.budget
    campaign.budget = new_budget
    db.commit()
    db.refresh(campaign)

    log_audit_event(
        db=db,
        action="CAMPAIGN_BUDGET_MODIFIED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="campaign",
        resource_id=campaign.id,
        details={"old_budget": old_budget, "new_budget": new_budget},
    )
    return campaign


def analyze_campaign_performance(db: Session, workspace_id: str) -> Dict[str, Any]:
    """
    Deterministic Marketing Performance Analysis:
    Calculates CTR, Conversion Rate, CAC, and flags underperforming/overbudget campaigns.
    """
    campaigns = db.execute(
        select(MarketingCampaign).where(MarketingCampaign.workspace_id == workspace_id)
    ).scalars().all()

    total_budget = sum(c.budget for c in campaigns)
    total_spend = sum(c.spend for c in campaigns)
    total_impressions = sum(c.impressions for c in campaigns)
    total_clicks = sum(c.clicks for c in campaigns)
    total_conversions = sum(c.conversions for c in campaigns)

    overall_ctr = round((total_clicks / total_impressions * 100), 2) if total_impressions > 0 else 0.0
    overall_cvr = round((total_conversions / total_clicks * 100), 2) if total_clicks > 0 else 0.0
    overall_cac = round((total_spend / total_conversions), 2) if total_conversions > 0 else 0.0

    analyzed = []
    underperforming = []

    for c in campaigns:
        ctr = round((c.clicks / c.impressions * 100), 2) if c.impressions > 0 else 0.0
        cvr = round((c.conversions / c.clicks * 100), 2) if c.clicks > 0 else 0.0
        cpa = round((c.spend / c.conversions), 2) if c.conversions > 0 else 0.0
        is_overbudget = c.spend > c.budget if c.budget > 0 else False
        is_underperforming = (ctr < 1.0 and c.impressions > 500) or (c.spend > 100 and c.conversions == 0)

        entry = {
            "id": c.id,
            "name": c.name,
            "channel": c.channel,
            "status": c.status,
            "budget": c.budget,
            "spend": c.spend,
            "ctr_percent": ctr,
            "cvr_percent": cvr,
            "cost_per_acquisition": cpa,
            "is_overbudget": is_overbudget,
            "is_underperforming": is_underperforming,
        }
        analyzed.append(entry)
        if is_underperforming:
            underperforming.append(entry)

    return {
        "total_campaigns": len(campaigns),
        "total_budget": round(total_budget, 2),
        "total_spend": round(total_spend, 2),
        "overall_ctr": overall_ctr,
        "overall_cvr": overall_cvr,
        "overall_cac": overall_cac,
        "campaigns": analyzed,
        "underperforming_count": len(underperforming),
        "underperforming_campaigns": underperforming,
    }
