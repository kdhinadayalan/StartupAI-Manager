from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select, case
from sqlalchemy.orm import Session

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.ai import AIAgentRun, AIToolCall, Approval, ApprovalStatus, AgentRunStatus
from app.services.workspace_service import get_member_membership


def get_ai_monitoring_telemetry(
    db: Session,
    workspace_id: str,
    user_id: str,
    days: Optional[int] = 30,
) -> Dict[str, Any]:
    """
    Deep telemetry aggregation engine for AI Agent monitoring.
    Enforces authentication, RBAC (AI_MONITORING_READ), and tenant isolation.
    Uses indexed database aggregations to avoid pulling large row sets into memory.
    """
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    user_role = Role(membership.role)
    if not check_role_permission(user_role, Permission.AI_MONITORING_READ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. AI Monitoring requires Manager, Admin, or Owner role.",
        )

    base_query = select(AIAgentRun).where(AIAgentRun.workspace_id == workspace_id)
    if days:
        cutoff = utc_now() - timedelta(days=days)
        base_query = base_query.where(AIAgentRun.created_at >= cutoff)

    # 1. High-level aggregates
    agg_query = select(
        func.count(AIAgentRun.id),
        func.coalesce(func.sum(AIAgentRun.tokens_used), 0),
        func.coalesce(func.sum(AIAgentRun.cost_estimate), 0.0),
        func.coalesce(func.avg(AIAgentRun.execution_time_ms), 0.0),
        func.coalesce(func.min(AIAgentRun.execution_time_ms), 0),
        func.coalesce(func.max(AIAgentRun.execution_time_ms), 0),
    ).where(AIAgentRun.workspace_id == workspace_id)

    if days:
        agg_query = agg_query.where(AIAgentRun.created_at >= cutoff)

    total_runs, total_tokens, total_cost, avg_latency, min_latency, max_latency = db.execute(
        agg_query
    ).one()

    # 2. Status distribution
    status_query = select(
        AIAgentRun.status,
        func.count(AIAgentRun.id),
    ).where(AIAgentRun.workspace_id == workspace_id)
    if days:
        status_query = status_query.where(AIAgentRun.created_at >= cutoff)
    status_query = status_query.group_by(AIAgentRun.status)

    status_counts = {status_name: count for status_name, count in db.execute(status_query).all()}

    # 3. Tool telemetry (join AIToolCall on agent_run_id)
    tool_query = (
        select(
            AIToolCall.tool_name,
            func.count(AIToolCall.id).label("call_count"),
            func.sum(case((AIToolCall.is_error.is_(True), 1), else_=0)).label("error_count"),
        )
        .join(AIAgentRun, AIToolCall.agent_run_id == AIAgentRun.id)
        .where(AIAgentRun.workspace_id == workspace_id)
    )
    if days:
        tool_query = tool_query.where(AIAgentRun.created_at >= cutoff)
    tool_query = tool_query.group_by(AIToolCall.tool_name).order_by(func.count(AIToolCall.id).desc())

    tool_stats = []
    for tool_name, call_count, error_count in db.execute(tool_query).all():
        err_pct = round((error_count / call_count * 100), 1) if call_count > 0 else 0.0
        tool_stats.append({
            "tool_name": tool_name,
            "call_count": call_count,
            "error_count": error_count,
            "error_rate_percent": err_pct,
        })

    # 4. Pending approvals
    pending_count = db.execute(
        select(func.count(Approval.id)).where(
            Approval.workspace_id == workspace_id,
            Approval.status == ApprovalStatus.PENDING.value,
        )
    ).scalar_one()

    # 5. Recent agent executions trace (limited to top 20, data minimized)
    recent_runs = db.execute(
        select(AIAgentRun)
        .where(AIAgentRun.workspace_id == workspace_id)
        .order_by(AIAgentRun.created_at.desc())
        .limit(20)
    ).scalars().all()

    execution_traces = [
        {
            "id": r.id,
            "agent_name": r.agent_name,
            "query_snippet": r.user_query[:100] + ("..." if len(r.user_query) > 100 else ""),
            "status": r.status,
            "tokens_used": r.tokens_used,
            "execution_time_ms": r.execution_time_ms,
            "cost_estimate": round(r.cost_estimate, 5),
            "created_at": r.created_at.isoformat(),
        }
        for r in recent_runs
    ]

    return {
        "time_window_days": days,
        "total_runs": total_runs,
        "total_tokens": total_tokens,
        "estimated_cost": round(float(total_cost), 4),
        "latency": {
            "avg_ms": round(float(avg_latency), 1),
            "min_ms": min_latency,
            "max_ms": max_latency,
        },
        "status_distribution": {
            "success": status_counts.get(AgentRunStatus.SUCCESS.value, 0),
            "awaiting_approval": status_counts.get(AgentRunStatus.AWAITING_APPROVAL.value, 0),
            "error": status_counts.get(AgentRunStatus.ERROR.value, 0),
        },
        "pending_approvals_count": pending_count,
        "tool_usage": tool_stats,
        "recent_executions": execution_traces,
    }
