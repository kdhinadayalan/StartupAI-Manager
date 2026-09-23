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


class WorkspaceAISettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: str
    provider: str
    model_name: str
    has_custom_api_key: bool = False
    masked_api_key: Optional[str] = None
    ollama_base_url: str = "http://localhost:11434"
    custom_base_url: Optional[str] = None
    temperature: float = 0.2
    pii_masking_enabled: bool = True
    updated_at: Optional[datetime] = None


class WorkspaceAISettingsUpdate(BaseModel):
    provider: Optional[str] = Field(None, description="GEMINI, OPENAI, OLLAMA, MOCK, CUSTOM")
    model_name: Optional[str] = Field(None, max_length=100)
    api_key: Optional[str] = Field(None, max_length=255)
    ollama_base_url: Optional[str] = Field(None, max_length=255)
    custom_base_url: Optional[str] = Field(None, max_length=255)
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    pii_masking_enabled: Optional[bool] = None


class TestAIConnectionRequest(BaseModel):
    provider: str = Field(..., description="GEMINI, OPENAI, OLLAMA, MOCK, CUSTOM")
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    ollama_base_url: Optional[str] = None
    custom_base_url: Optional[str] = None


class TestAIConnectionResponse(BaseModel):
    status: str = Field(..., description="'connected' or 'error'")
    latency_ms: int
    provider: str
    model_name: str
    message: str
    details: Optional[Dict[str, Any]] = None

