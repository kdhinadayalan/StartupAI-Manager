from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.ai import AIConversation, AIAgentRun, Approval, ApprovalStatus
from app.schemas.common import SuccessResponse
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    ApprovalResponse,
    ApprovalDecisionRequest,
    AgentTelemetryResponse,
)
from app.agents.orchestrator import ManagerAgent
from app.services.approval_service import (
    list_workspace_approvals,
    approve_action,
    reject_action,
)
from app.services.workspace_service import get_member_membership

router = APIRouter(prefix="/workspaces/{workspace_id}/ai", tags=["AI Agent System"])
manager_agent = ManagerAgent()


@router.post("/chat", response_model=SuccessResponse[ChatResponse])
async def chat_with_manager_agent(
    workspace_id: str,
    body: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Interact with the central Manager Agent.
    Orchestrates planning, risk evaluation, tool dispatching, and approval staging.
    """
    membership = get_member_membership(db, workspace_id, current_user.id)
    if not membership:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found or access denied.")

    # Resolve or initialize conversation thread
    conversation_id = body.conversation_id
    if not conversation_id:
        conversation = AIConversation(
            workspace_id=workspace_id,
            user_id=current_user.id,
            title=body.message[:50] if len(body.message) > 50 else body.message,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        conversation_id = conversation.id

    correlation_id = getattr(request.state, "correlation_id", None)

    # Run Manager Agent orchestration loop
    result = await manager_agent.run(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        conversation_id=conversation_id,
        user_query=body.message,
        correlation_id=correlation_id,
    )

    response_data = ChatResponse(
        run_id=result["run_id"],
        conversation_id=conversation_id,
        status=result["status"],
        plan=result["plan"],
        response=result["response"],
        tool_calls_count=result["tool_calls_count"],
        pending_approvals=result["pending_approvals"],
        tokens_used=result["tokens_used"],
        execution_time_ms=result["execution_time_ms"],
    )

    return SuccessResponse(data=response_data)


@router.get("/approvals", response_model=SuccessResponse[List[ApprovalResponse]])
def get_approvals(
    workspace_id: str,
    status: Optional[str] = Query(None, description="Filter by status: PENDING, APPROVED, REJECTED, EXECUTED"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List pending and historical approval requests."""
    approvals = list_workspace_approvals(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        status_filter=status,
    )
    return SuccessResponse(data=approvals)


@router.post("/approvals/{approval_id}/approve", response_model=SuccessResponse[dict])
def approve_pending_action(
    workspace_id: str,
    approval_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authorize and execute a staged AI action.
    Strictly verifies the human caller's RBAC permissions.
    """
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)

    result = approve_action(
        db=db,
        workspace_id=workspace_id,
        approval_id=approval_id,
        user_id=current_user.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Action approved and executed successfully.", data=result)


@router.post("/approvals/{approval_id}/reject", response_model=SuccessResponse[dict])
def reject_pending_action(
    workspace_id: str,
    approval_id: str,
    body: ApprovalDecisionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reject a staged AI action."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)

    result = reject_action(
        db=db,
        workspace_id=workspace_id,
        approval_id=approval_id,
        user_id=current_user.id,
        reason=body.reason,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Action rejected.", data=result)


from app.services.telemetry_service import get_ai_monitoring_telemetry


@router.get("/monitoring", response_model=SuccessResponse[AgentTelemetryResponse])
def get_ai_monitoring_metrics(
    workspace_id: str,
    days: Optional[int] = Query(30, description="Time window in days (default 30; null for all time)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve telemetry metrics on agent runs, latency, tokens, approvals, and tool performance."""
    telemetry = get_ai_monitoring_telemetry(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        days=days,
    )
    return SuccessResponse(
        data=AgentTelemetryResponse(
            total_runs=telemetry["total_runs"],
            total_tokens=telemetry["total_tokens"],
            estimated_cost=telemetry["estimated_cost"],
            avg_execution_time_ms=telemetry["latency"]["avg_ms"],
            pending_approvals_count=telemetry["pending_approvals_count"],
            time_window_days=telemetry["time_window_days"],
            latency=telemetry["latency"],
            status_distribution=telemetry["status_distribution"],
            tool_usage=telemetry["tool_usage"],
            recent_executions=telemetry["recent_executions"],
        )
    )
