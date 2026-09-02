import html
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.risk import RiskItem, RiskCategory, RiskSeverity, RiskStatus
from app.models.task import Task
from app.services.workspace_service import get_member_membership
from app.services.finance_service import compare_budget_vs_actual, calculate_cash_runway
from app.services.marketing_service import analyze_campaign_performance
from app.services.audit_service import log_audit_event


def calculate_risk_score(likelihood: int, impact: int) -> Tuple[int, str]:
    """
    Deterministic Risk Scoring Model:
    Score = Likelihood (1-5) * Impact (1-5).
    Classification:
      1–4:   LOW
      5–9:   MEDIUM
      10–16: HIGH
      17–25: CRITICAL
    """
    l_clamped = max(1, min(5, likelihood))
    i_clamped = max(1, min(5, impact))
    score = l_clamped * i_clamped

    if score >= 17:
        severity = RiskSeverity.CRITICAL.value
    elif score >= 10:
        severity = RiskSeverity.HIGH.value
    elif score >= 5:
        severity = RiskSeverity.MEDIUM.value
    else:
        severity = RiskSeverity.LOW.value

    return score, severity


def create_risk_item(
    db: Session,
    workspace_id: str,
    user_id: str,
    title: str,
    category: str = RiskCategory.OPERATIONAL.value,
    likelihood: int = 3,
    impact: int = 3,
    description: Optional[str] = None,
    mitigation_plan: Optional[str] = None,
    detected_by: str = "HUMAN",
) -> RiskItem:
    """Create a tracked risk item."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.RISK_MANAGE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to manage risks.")

    score, severity = calculate_risk_score(likelihood, impact)

    risk = RiskItem(
        workspace_id=workspace_id,
        title=html.escape(title.strip()),
        description=html.escape(description.strip()) if description else None,
        category=category,
        likelihood=likelihood,
        impact=impact,
        risk_score=score,
        severity=severity,
        status=RiskStatus.IDENTIFIED.value,
        mitigation_plan=html.escape(mitigation_plan.strip()) if mitigation_plan else None,
        detected_by=detected_by,
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)

    log_audit_event(
        db=db,
        action="RISK_CREATED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="risk",
        resource_id=risk.id,
        details={"score": score, "severity": severity, "category": category},
    )
    return risk


def list_risk_items(
    db: Session,
    workspace_id: str,
    user_id: str,
    category: Optional[str] = None,
    severity: Optional[str] = None,
) -> List[RiskItem]:
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    query = select(RiskItem).where(RiskItem.workspace_id == workspace_id)
    if category:
        query = query.where(RiskItem.category == category)
    if severity:
        query = query.where(RiskItem.severity == severity)

    return list(db.execute(query.order_by(RiskItem.risk_score.desc())).scalars().all())


def update_risk_status(
    db: Session,
    workspace_id: str,
    risk_id: str,
    user_id: str,
    status_str: str,
    mitigation_plan: Optional[str] = None,
) -> RiskItem:
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.RISK_MANAGE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to manage risks.")

    risk = db.execute(
        select(RiskItem).where(RiskItem.id == risk_id, RiskItem.workspace_id == workspace_id)
    ).scalar_one_or_none()
    if not risk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found.")

    risk.status = status_str
    if mitigation_plan:
        risk.mitigation_plan = mitigation_plan
    if status_str in [RiskStatus.MITIGATED.value, RiskStatus.ACCEPTED.value]:
        risk.resolved_at = utc_now()

    db.commit()
    db.refresh(risk)
    return risk


def scan_startup_risks(db: Session, workspace_id: str) -> List[Dict[str, Any]]:
    """
    Automated Deterministic Risk Scanner:
    Analyzes live workspace data across tasks, finance, and marketing.
    Identifies risk indicators without jumping to unfounded conclusions.
    """
    signals = []
    now = utc_now()

    # 1. Operational Signal: Overdue tasks
    overdue_tasks = db.execute(
        select(Task).where(
            Task.workspace_id == workspace_id,
            Task.due_date.isnot(None),
            Task.due_date < now,
            Task.status != "DONE",
        )
    ).scalars().all()

    if overdue_tasks:
        count = len(overdue_tasks)
        score, severity = calculate_risk_score(likelihood=min(5, 2 + count), impact=3)
        signals.append({
            "category": RiskCategory.OPERATIONAL.value,
            "title": f"Overdue Tasks Detected ({count} items)",
            "description": f"There are {count} overdue tasks currently past deadline.",
            "indicator": "Repeated overdue tasks indicate potential sprint delivery or bottleneck risks.",
            "likelihood": min(5, 2 + count),
            "impact": 3,
            "risk_score": score,
            "severity": severity,
            "affected_tasks": [{"id": t.id, "title": t.title} for t in overdue_tasks[:5]],
        })

    # 2. Financial Signal: Budget overruns
    budget_comparison = compare_budget_vs_actual(db, workspace_id)
    exceeded = [b for b in budget_comparison if b["is_exceeded"]]
    if exceeded:
        for b in exceeded:
            score, severity = calculate_risk_score(likelihood=4, impact=4)
            signals.append({
                "category": RiskCategory.FINANCIAL.value,
                "title": f"Budget Exceeded in {b['category']}",
                "description": f"Actual spending (${b['actual']:,.2f}) has exceeded budget (${b['budget']:,.2f}) by ${abs(b['variance']):,.2f}.",
                "indicator": "Spending variance indicates potential budget overrun risk.",
                "likelihood": 4,
                "impact": 4,
                "risk_score": score,
                "severity": severity,
            })

    # 3. Financial Signal: Short runway (< 3 months)
    runway_data = calculate_cash_runway(db, workspace_id)
    if runway_data["has_cash_data"] and runway_data["runway_months"] is not None:
        months = runway_data["runway_months"]
        if months < 3.0:
            score, severity = calculate_risk_score(likelihood=5, impact=5)
            signals.append({
                "category": RiskCategory.FINANCIAL.value,
                "title": f"Critical Runway Alert ({months} months remaining)",
                "description": f"Cash runway is currently at {months} months based on trailing burn rate.",
                "indicator": "Cash balance requires immediate capital injection or aggressive burn reduction.",
                "likelihood": 5,
                "impact": 5,
                "risk_score": score,
                "severity": severity,
            })

    # 4. Marketing Signal: Underperforming campaigns
    marketing_perf = analyze_campaign_performance(db, workspace_id)
    if marketing_perf["underperforming_count"] > 0:
        score, severity = calculate_risk_score(likelihood=3, impact=2)
        signals.append({
            "category": RiskCategory.MARKETING.value,
            "title": f"Underperforming Marketing Campaigns ({marketing_perf['underperforming_count']})",
            "description": f"{marketing_perf['underperforming_count']} active campaigns have CTR below 1% or zero conversions.",
            "indicator": "Marketing spend efficiency is below target.",
            "likelihood": 3,
            "impact": 2,
            "risk_score": score,
            "severity": severity,
        })

    # Dispatch notifications for Critical/High signals (idempotent with event_key)
    from app.services.notification_service import create_notification
    for s in signals:
        if s["severity"] in ["CRITICAL", "HIGH"]:
            create_notification(
                db=db,
                workspace_id=workspace_id,
                type="RISK_ALERT",
                severity="CRITICAL" if s["severity"] == "CRITICAL" else "WARNING",
                title=f"Risk Detected: {s['title']}",
                message=s["description"],
                link="/risks",
                resource_type="risk",
                event_key=f"RISK_SIGNAL:{workspace_id}:{s['category']}:{s['title']}",
            )

    return signals
