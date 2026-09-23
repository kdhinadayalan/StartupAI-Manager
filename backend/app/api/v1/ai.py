from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import Role
from app.database.session import get_db
from app.models.user import User
from app.models.ai import AIConversation, AIAgentRun, Approval, ApprovalStatus, WorkspaceAISettings
from app.schemas.common import SuccessResponse
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    ApprovalResponse,
    ApprovalDecisionRequest,
    AgentTelemetryResponse,
    WorkspaceAISettingsResponse,
    WorkspaceAISettingsUpdate,
    TestAIConnectionRequest,
    TestAIConnectionResponse,
)
from app.agents.orchestrator import ManagerAgent
from app.agents.provider import test_ai_provider_connection
from app.services.approval_service import (
    list_workspace_approvals,
    approve_action,
    reject_action,
)
from app.services.workspace_service import get_member_membership
from app.services.audit_service import log_audit_event

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


def _mask_api_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    if len(key) <= 8:
        return "••••••••"
    return f"{key[:3]}••••••••{key[-4:]}"


@router.get("/settings", response_model=SuccessResponse[WorkspaceAISettingsResponse])
def get_workspace_ai_settings(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve workspace AI provider, model, and privacy settings."""
    membership = get_member_membership(db, workspace_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied.")

    ai_settings = (
        db.query(WorkspaceAISettings)
        .filter(WorkspaceAISettings.workspace_id == workspace_id)
        .first()
    )

    if not ai_settings:
        ai_settings = WorkspaceAISettings(
            workspace_id=workspace_id,
            provider="MOCK",
            model_name="startupai-mock-v1",
            ollama_base_url="http://localhost:11434",
            temperature=0.2,
            pii_masking_enabled=True,
        )
        db.add(ai_settings)
        db.commit()
        db.refresh(ai_settings)

    resp = WorkspaceAISettingsResponse(
        workspace_id=ai_settings.workspace_id,
        provider=ai_settings.provider,
        model_name=ai_settings.model_name,
        has_custom_api_key=bool(ai_settings.api_key),
        masked_api_key=_mask_api_key(ai_settings.api_key),
        ollama_base_url=ai_settings.ollama_base_url,
        custom_base_url=ai_settings.custom_base_url,
        temperature=ai_settings.temperature,
        pii_masking_enabled=ai_settings.pii_masking_enabled,
        updated_at=ai_settings.updated_at,
    )
    return SuccessResponse(data=resp)


@router.put("/settings", response_model=SuccessResponse[WorkspaceAISettingsResponse])
def update_workspace_ai_settings(
    workspace_id: str,
    body: WorkspaceAISettingsUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update workspace AI provider, model selection, BYOK API key, or local Ollama URL.
    Strictly restricted to workspace OWNER and ADMIN roles.
    """
    membership = get_member_membership(db, workspace_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied.")

    if membership.role not in [Role.OWNER.value, Role.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace Owners and Admins can configure AI provider settings.",
        )

    ai_settings = (
        db.query(WorkspaceAISettings)
        .filter(WorkspaceAISettings.workspace_id == workspace_id)
        .first()
    )

    if not ai_settings:
        ai_settings = WorkspaceAISettings(workspace_id=workspace_id)
        db.add(ai_settings)

    if body.provider is not None:
        ai_settings.provider = body.provider.upper()
    if body.model_name is not None:
        ai_settings.model_name = body.model_name.strip()
    if body.api_key is not None:
        # If empty string provided, clears the custom key; otherwise saves
        ai_settings.api_key = body.api_key.strip() if body.api_key.strip() else None
    if body.ollama_base_url is not None:
        ai_settings.ollama_base_url = body.ollama_base_url.strip()
    if body.custom_base_url is not None:
        ai_settings.custom_base_url = body.custom_base_url.strip() if body.custom_base_url.strip() else None
    if body.temperature is not None:
        ai_settings.temperature = body.temperature
    if body.pii_masking_enabled is not None:
        ai_settings.pii_masking_enabled = body.pii_masking_enabled

    db.commit()
    db.refresh(ai_settings)

    correlation_id = getattr(request.state, "correlation_id", None)
    log_audit_event(
        db=db,
        action="AI_SETTINGS_UPDATED",
        user_id=current_user.id,
        workspace_id=workspace_id,
        resource_type="workspace_ai_settings",
        resource_id=ai_settings.id,
        details={
            "provider": ai_settings.provider,
            "model_name": ai_settings.model_name,
            "has_custom_api_key": bool(ai_settings.api_key),
            "ollama_base_url": ai_settings.ollama_base_url,
            "custom_base_url": ai_settings.custom_base_url,
            "pii_masking_enabled": ai_settings.pii_masking_enabled,
        },
        correlation_id=correlation_id,
    )

    resp = WorkspaceAISettingsResponse(
        workspace_id=ai_settings.workspace_id,
        provider=ai_settings.provider,
        model_name=ai_settings.model_name,
        has_custom_api_key=bool(ai_settings.api_key),
        masked_api_key=_mask_api_key(ai_settings.api_key),
        ollama_base_url=ai_settings.ollama_base_url,
        custom_base_url=ai_settings.custom_base_url,
        temperature=ai_settings.temperature,
        pii_masking_enabled=ai_settings.pii_masking_enabled,
        updated_at=ai_settings.updated_at,
    )
    return SuccessResponse(message="AI Settings updated successfully.", data=resp)


@router.post("/settings/test-connection", response_model=SuccessResponse[TestAIConnectionResponse])
async def test_ai_connection(
    workspace_id: str,
    body: TestAIConnectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Test live connectivity and latency for a specified provider (Ollama, Gemini, OpenAI, Mock, Custom).
    Strictly restricted to workspace OWNER and ADMIN roles.
    """
    membership = get_member_membership(db, workspace_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied.")

    if membership.role not in [Role.OWNER.value, Role.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace Owners and Admins can test AI connections.",
        )

    # If api_key not provided in request body (None), fall back to stored workspace key
    api_key_to_use = body.api_key
    stored_settings = None
    if api_key_to_use is None:
        stored_settings = (
            db.query(WorkspaceAISettings)
            .filter(WorkspaceAISettings.workspace_id == workspace_id)
            .first()
        )
        if stored_settings and stored_settings.api_key:
            api_key_to_use = stored_settings.api_key

    # If custom_base_url not provided (None), fall back to stored custom_base_url
    custom_url_to_use = body.custom_base_url
    if custom_url_to_use is None:
        if not stored_settings:
            stored_settings = (
                db.query(WorkspaceAISettings)
                .filter(WorkspaceAISettings.workspace_id == workspace_id)
                .first()
            )
        if stored_settings and stored_settings.custom_base_url:
            custom_url_to_use = stored_settings.custom_base_url

    result = await test_ai_provider_connection(
        provider=body.provider,
        model_name=body.model_name,
        api_key=api_key_to_use,
        ollama_base_url=body.ollama_base_url,
        custom_base_url=custom_url_to_use,
    )

    resp = TestAIConnectionResponse(
        status=result["status"],
        latency_ms=result.get("latency_ms", 0),
        provider=result.get("provider", body.provider),
        model_name=result.get("model_name", body.model_name or ""),
        message=result.get("message", ""),
        details=result.get("details"),
    )
    return SuccessResponse(data=resp)

