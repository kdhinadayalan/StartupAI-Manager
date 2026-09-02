from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserResponse


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    conversation_id: Optional[str] = None


class PendingApprovalItem(BaseModel):
    approval_id: str
    risk_level: str
    action: str
    payload: Dict[str, Any]
    message: str


class ChatResponse(BaseModel):
    run_id: str
    conversation_id: str
    status: str
    plan: Optional[str] = None
    response: str
    tool_calls_count: int
    pending_approvals: List[Dict[str, Any]] = []
    tokens_used: int
    execution_time_ms: int


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    agent_run_id: str
    action_type: str
    action_payload: str
    risk_level: str
    status: str
    requested_by_agent: str
    explanation: Optional[str] = None
    reviewed_by_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    reviewed_by: Optional[UserResponse] = None


class ApprovalDecisionRequest(BaseModel):
    reason: Optional[str] = None


class AgentTelemetryResponse(BaseModel):
    total_runs: int
    total_tokens: int
    estimated_cost: float
    avg_execution_time_ms: float
    pending_approvals_count: int
    time_window_days: Optional[int] = None
    latency: Optional[Dict[str, Any]] = None
    status_distribution: Optional[Dict[str, int]] = None
    tool_usage: Optional[List[Dict[str, Any]]] = None
    recent_executions: Optional[List[Dict[str, Any]]] = None
