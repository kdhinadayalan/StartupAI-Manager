from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.task import Task
from app.models.project import Project
from app.models.risk import RiskItem, RiskSeverity, RiskStatus
from app.models.ai import Approval, ApprovalStatus
from app.models.notification import Notification
from app.services.workspace_service import get_member_membership
from app.services.finance_service import (
    calculate_monthly_burn_rate,
    calculate_cash_runway,
    compare_budget_vs_actual,
    get_or_create_financial_account,
)
from app.services.marketing_service import analyze_campaign_performance
from app.services.research_service import get_swot_matrix, analyze_competitors


def calculate_startup_health_score(
    delivery_score: float,
    runway_score: Optional[float],
    risk_score: float,
) -> Dict[str, Any]:
    """
    Deterministic Startup Health Score:
      Delivery Health = 40%
      Runway Safety   = 35%
      Risk Index      = 25%

    If runway data is missing, transparently communicates limitations
    without hallucinating a perfect or arbitrary runway score.
    """
    d_score = max(0.0, min(100.0, delivery_score))
    r_score = max(0.0, min(100.0, risk_score))

    if runway_score is None:
        # Prorated over available dimensions with explicit limitation notice
        composite = round((d_score * 0.55) + (r_score * 0.45), 1)
        data_confidence = "PARTIAL_DATA"
        limitation_notice = "Runway information is unavailable; available cash balance has not been provided."
    else:
        rw_score = max(0.0, min(100.0, runway_score))
        composite = round((d_score * 0.40) + (rw_score * 0.35) + (r_score * 0.25), 1)
        data_confidence = "FULL_DATA"
        limitation_notice = None

    if composite >= 90:
        grade = "EXCELLENT"
    elif composite >= 75:
        grade = "HEALTHY"
    elif composite >= 50:
        grade = "CAUTION"
    else:
        grade = "CRITICAL"

    return {
        "health_score": composite,
        "grade": grade,
        "data_confidence": data_confidence,
        "limitation_notice": limitation_notice,
        "breakdown": {
            "delivery_score": round(d_score, 1),
            "runway_score": round(runway_score, 1) if runway_score is not None else None,
            "risk_score": round(r_score, 1),
            "delivery_weight": 0.40,
            "runway_weight": 0.35,
            "risk_weight": 0.25,
        },
    }


def get_executive_dashboard_summary(
    db: Session,
    workspace_id: str,
    user_id: str,
) -> Dict[str, Any]:
    """
    Synthesizes the complete Executive Dashboard command center.
    Strictly verifies workspace membership and RBAC permissions.
    Avoids N+1 queries through focused aggregate selections.
    """
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    user_role = Role(membership.role)
    if not check_role_permission(user_role, Permission.DASHBOARD_READ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to view dashboard.",
        )

    now = utc_now()

    # 1. Projects & Tasks Summary
    tasks = db.execute(
        select(Task).where(Task.workspace_id == workspace_id)
    ).scalars().all()

    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == "DONE")
    overdue_tasks = sum(1 for t in tasks if t.due_date and t.due_date < now and t.status != "DONE")

    if total_tasks == 0:
        delivery_score = 100.0
        delivery_status = "NO_TASKS"
    else:
        completion_pct = (completed_tasks / total_tasks) * 100.0
        overdue_penalty = overdue_tasks * 10.0
        delivery_score = max(0.0, min(100.0, completion_pct - overdue_penalty))
        delivery_status = "ON_TRACK" if overdue_tasks == 0 else "BOTTLENECKS_DETECTED"

    # 2. Finance & Runway Summary
    burn_data = calculate_monthly_burn_rate(db, workspace_id)
    runway_data = calculate_cash_runway(db, workspace_id)
    budget_comparisons = compare_budget_vs_actual(db, workspace_id)
    overbudget_count = sum(1 for b in budget_comparisons if b["is_exceeded"])

    account = get_or_create_financial_account(db, workspace_id, user_id)

    if not runway_data["has_cash_data"] or runway_data["runway_months"] is None:
        runway_score = None
        runway_status = "insufficient_data"
    else:
        months = runway_data["runway_months"]
        if months >= 12.0:
            runway_score = 100.0
            runway_status = "EXCELLENT"
        elif months >= 6.0:
            runway_score = 80.0 + ((months - 6.0) / 6.0 * 20.0)
            runway_status = "HEALTHY"
        elif months >= 3.0:
            runway_score = 50.0 + ((months - 3.0) / 3.0 * 30.0)
            runway_status = "WARNING"
        else:
            runway_score = max(0.0, (months / 3.0 * 50.0))
            runway_status = "CRITICAL"

    # 3. Risks Summary
    risks = db.execute(
        select(RiskItem).where(
            RiskItem.workspace_id == workspace_id,
            RiskItem.status.in_([RiskStatus.IDENTIFIED.value, RiskStatus.MONITORING.value]),
        )
    ).scalars().all()

    critical_risks = sum(1 for r in risks if r.severity == RiskSeverity.CRITICAL.value)
    high_risks = sum(1 for r in risks if r.severity == RiskSeverity.HIGH.value)
    medium_risks = sum(1 for r in risks if r.severity == RiskSeverity.MEDIUM.value)
    low_risks = sum(1 for r in risks if r.severity == RiskSeverity.LOW.value)

    risk_deductions = (critical_risks * 25.0) + (high_risks * 12.0) + (medium_risks * 5.0) + (low_risks * 1.0)
    risk_score = max(0.0, min(100.0, 100.0 - risk_deductions))

    # 4. Composite Health Score
    health = calculate_startup_health_score(
        delivery_score=delivery_score,
        runway_score=runway_score,
        risk_score=risk_score,
    )

    # 5. Marketing Overview
    mkt_perf = analyze_campaign_performance(db, workspace_id)

    # 6. Research Overview
    swot = get_swot_matrix(db, workspace_id)
    competitors = analyze_competitors(db, workspace_id)

    # 7. Pending AI Approvals (with full payload for Dashboard Review Cards)
    approvals = db.execute(
        select(Approval).where(
            Approval.workspace_id == workspace_id,
            Approval.status == ApprovalStatus.PENDING.value,
        ).order_by(Approval.created_at.desc()).limit(5)
    ).scalars().all()

    approval_cards = [
        {
            "id": a.id,
            "action_type": a.action_type,
            "action_payload": a.action_payload,
            "risk_level": a.risk_level,
            "requested_by_agent": a.requested_by_agent,
            "explanation": a.explanation,
            "created_at": a.created_at.isoformat(),
        }
        for a in approvals
    ]

    # 8. Recent Unread Notifications (top 5)
    recent_notifications = db.execute(
        select(Notification).where(
            Notification.workspace_id == workspace_id,
            (Notification.user_id == user_id) | (Notification.user_id.is_(None)),
            Notification.is_read.is_(False),
        ).order_by(Notification.created_at.desc()).limit(5)
    ).scalars().all()

    alerts = [
        {
            "id": n.id,
            "type": n.type,
            "severity": n.severity,
            "title": n.title,
            "message": n.message,
            "link": n.link,
            "created_at": n.created_at.isoformat(),
        }
        for n in recent_notifications
    ]

    return {
        "health": health,
        "delivery": {
            "score": round(delivery_score, 1),
            "status": delivery_status,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "overdue_tasks": overdue_tasks,
        },
        "finance": {
            "score": round(runway_score, 1) if runway_score is not None else None,
            "runway_status": runway_status,
            "monthly_burn_rate": burn_data["monthly_burn_rate"],
            "runway_months": runway_data["runway_months"],
            "current_cash_balance": account.current_cash_balance,
            "currency": account.currency,
            "overbudget_categories_count": overbudget_count,
            "message": runway_data["message"],
        },
        "risks": {
            "score": round(risk_score, 1),
            "total_active_risks": len(risks),
            "critical_count": critical_risks,
            "high_count": high_risks,
            "medium_count": medium_risks,
            "low_count": low_risks,
        },
        "marketing": {
            "total_campaigns": mkt_perf["total_campaigns"],
            "total_spend": mkt_perf["total_spend"],
            "overall_ctr": mkt_perf["overall_ctr"],
            "overall_cvr": mkt_perf["overall_cvr"],
            "overall_cac": mkt_perf["overall_cac"],
            "underperforming_count": mkt_perf["underperforming_count"],
        },
        "research": {
            "strengths_count": len(swot.get("STRENGTH", [])),
            "weaknesses_count": len(swot.get("WEAKNESS", [])),
            "opportunities_count": len(swot.get("OPPORTUNITY", [])),
            "threats_count": len(swot.get("THREAT", [])),
            "competitors_count": len(competitors),
        },
        "pending_approvals": approval_cards,
        "recent_alerts": alerts,
    }
