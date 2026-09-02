from typing import Any, Dict, List, Optional
import json
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.ai import Approval, ApprovalStatus, RiskLevel
from app.models.workspace import WorkspaceMember
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.workspace_service import get_member_membership
from app.services.task_service import create_task, update_task, delete_task
from app.services.audit_service import log_audit_event


def list_workspace_approvals(
    db: Session,
    workspace_id: str,
    user_id: str,
    status_filter: Optional[str] = None,
) -> List[Approval]:
    """List pending and reviewed approval requests."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    query = (
        select(Approval)
        .options(joinedload(Approval.reviewed_by))
        .where(Approval.workspace_id == workspace_id)
    )
    if status_filter:
        query = query.where(Approval.status == status_filter)

    query = query.order_by(Approval.created_at.desc())
    return list(db.execute(query).scalars().all())


def approve_action(
    db: Session,
    workspace_id: str,
    approval_id: str,
    user_id: str,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Human Approver verifies and executes a staged AI action.
    Re-validates the human's permissions before executing.
    AI can NEVER approve its own actions.
    """
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    approval = db.execute(
        select(Approval).where(
            Approval.id == approval_id,
            Approval.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval request not found.",
        )

    if approval.status != ApprovalStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request with status '{approval.status}'.",
        )

    # Re-verify human user's permission for the risk tier
    user_role = Role(membership.role)
    if approval.risk_level == RiskLevel.HIGH.value:
        if not check_role_permission(user_role, Permission.AI_APPROVE_HIGH):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation requires High-Risk AI Approval permission (Admin or Owner).",
            )
    else:  # MEDIUM
        if not check_role_permission(user_role, Permission.AI_APPROVE_MEDIUM):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation requires Medium-Risk AI Approval permission (Manager, Admin, or Owner).",
            )

    # Execute the staged action
    payload = json.loads(approval.action_payload)
    execution_result = {}

    if approval.action_type == "create_task":
        task_in = TaskCreate(
            project_id=payload["project_id"],
            title=payload["title"],
            description=payload.get("description"),
            priority=payload.get("priority", "MEDIUM"),
            assignee_id=payload.get("assignee_id"),
            estimated_hours=payload.get("estimated_hours"),
        )
        task = create_task(db, workspace_id, user_id, task_in, ip_address, correlation_id)
        execution_result = {"task_id": task.id, "title": task.title, "status": task.status}

    elif approval.action_type == "update_task":
        update_in = TaskUpdate(
            title=payload.get("title"),
            status=payload.get("status"),
            priority=payload.get("priority"),
            assignee_id=payload.get("assignee_id"),
        )
        task = update_task(db, workspace_id, payload["task_id"], user_id, update_in, ip_address, correlation_id)
        execution_result = {"task_id": task.id, "status": task.status}

    elif approval.action_type == "delete_task":
        delete_task(db, workspace_id, payload["task_id"], user_id, ip_address, correlation_id)
        execution_result = {"deleted_task_id": payload["task_id"], "success": True}

    elif approval.action_type == "create_expense":
        from app.services.finance_service import create_expense
        exp = create_expense(
            db,
            workspace_id=workspace_id,
            user_id=user_id,
            title=payload["title"],
            amount=payload["amount"],
            category=payload.get("category", "OPERATIONS"),
            notes=payload.get("notes"),
        )
        execution_result = {"expense_id": exp.id, "amount": exp.amount, "category": exp.category}

    elif approval.action_type == "create_campaign":
        from app.services.marketing_service import create_campaign
        camp = create_campaign(
            db,
            workspace_id=workspace_id,
            user_id=user_id,
            name=payload["name"],
            channel=payload.get("channel", "SOCIAL_MEDIA"),
            budget=payload.get("budget", 0.0),
            target_audience=payload.get("target_audience"),
        )
        execution_result = {"campaign_id": camp.id, "name": camp.name, "budget": camp.budget}

    elif approval.action_type == "modify_campaign_budget":
        from app.services.marketing_service import modify_campaign_budget
        camp = modify_campaign_budget(
            db,
            workspace_id=workspace_id,
            user_id=user_id,
            campaign_id=payload["campaign_id"],
            new_budget=payload["new_budget"],
        )
        execution_result = {"campaign_id": camp.id, "new_budget": camp.budget}

    elif approval.action_type == "add_research_item":
        from app.services.research_service import create_research_item
        res_item = create_research_item(
            db,
            workspace_id=workspace_id,
            user_id=user_id,
            title=payload["title"],
            topic=payload.get("topic", "COMPETITOR"),
            source_name=payload.get("source_name", "Internal Research"),
            source_url=payload.get("source_url"),
            content=payload["content"],
            key_findings=payload.get("key_findings"),
            swot_category=payload.get("swot_category", "GENERAL"),
            competitor_name=payload.get("competitor_name"),
        )
        execution_result = {"research_id": res_item.id, "title": res_item.title}

    elif approval.action_type == "create_risk_candidate":
        from app.services.risk_service import create_risk_item
        r_item = create_risk_item(
            db,
            workspace_id=workspace_id,
            user_id=user_id,
            title=payload["title"],
            category=payload.get("category", "OPERATIONAL"),
            likelihood=payload.get("likelihood", 3),
            impact=payload.get("impact", 3),
            description=payload.get("description"),
            mitigation_plan=payload.get("mitigation_plan"),
            detected_by="AI_AGENT",
        )
        execution_result = {"risk_id": r_item.id, "score": r_item.risk_score, "severity": r_item.severity}

    # Update approval state to EXECUTED
    approval.status = ApprovalStatus.EXECUTED.value
    approval.reviewed_by_id = user_id
    approval.reviewed_at = utc_now()
    db.commit()

    log_audit_event(
        db=db,
        action="AI_ACTION_APPROVED_AND_EXECUTED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="approval",
        resource_id=approval.id,
        details={"action_type": approval.action_type, "result": execution_result},
        ip_address=ip_address,
        correlation_id=correlation_id,
    )

    return {
        "approval_id": approval.id,
        "status": ApprovalStatus.EXECUTED.value,
        "action_type": approval.action_type,
        "execution_result": execution_result,
    }


def reject_action(
    db: Session,
    workspace_id: str,
    approval_id: str,
    user_id: str,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Reject a staged AI action."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    approval = db.execute(
        select(Approval).where(
            Approval.id == approval_id,
            Approval.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval request not found.",
        )

    if approval.status != ApprovalStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject request with status '{approval.status}'.",
        )

    approval.status = ApprovalStatus.REJECTED.value
    approval.reviewed_by_id = user_id
    approval.reviewed_at = utc_now()
    approval.rejection_reason = reason
    db.commit()

    log_audit_event(
        db=db,
        action="AI_ACTION_REJECTED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="approval",
        resource_id=approval.id,
        details={"reason": reason},
        ip_address=ip_address,
        correlation_id=correlation_id,
    )

    return {
        "approval_id": approval.id,
        "status": ApprovalStatus.REJECTED.value,
        "action_type": approval.action_type,
    }
