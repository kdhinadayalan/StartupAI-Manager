from datetime import datetime
from enum import Enum
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, generate_uuid, utc_now


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"


class AgentRunStatus(str, Enum):
    SUCCESS = "SUCCESS"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    ERROR = "ERROR"


class AIConversation(Base, TimestampMixin):
    """Chat thread between a user and the AI Manager Agent within a workspace."""
    __tablename__ = "ai_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="AI Manager Consultation", nullable=False)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace")
    user: Mapped["User"] = relationship("User")
    runs: Mapped[List["AIAgentRun"]] = relationship(
        "AIAgentRun", back_populates="conversation", cascade="all, delete-orphan"
    )


class AIAgentRun(Base):
    """
    Execution trace of a multi-agent orchestration run.
    Records the user query, plan, sub-agent delegations, execution time, and tokens used.
    """
    __tablename__ = "ai_agent_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_name: Mapped[str] = mapped_column(String(100), default="ManagerAgent", nullable=False)
    user_query: Mapped[str] = mapped_column(Text, nullable=False)
    plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    final_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_estimate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    execution_time_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=AgentRunStatus.SUCCESS.value, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    # Relationships
    conversation: Mapped["AIConversation"] = relationship("AIConversation", back_populates="runs")
    tool_calls: Mapped[List["AIToolCall"]] = relationship(
        "AIToolCall", back_populates="agent_run", cascade="all, delete-orphan"
    )
    approvals: Mapped[List["Approval"]] = relationship(
        "Approval", back_populates="agent_run", cascade="all, delete-orphan"
    )


class AIToolCall(Base):
    """Record of a tool invoked by an agent during execution."""
    __tablename__ = "ai_tool_calls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    agent_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_agent_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False)
    arguments_json: Mapped[str] = mapped_column(Text, nullable=False)
    result_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(20), default=RiskLevel.LOW.value, nullable=False)
    is_error: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    agent_run: Mapped["AIAgentRun"] = relationship("AIAgentRun", back_populates="tool_calls")


class Approval(Base, TimestampMixin):
    """
    Human Approval Request.
    Medium and High risk actions proposed by AI are staged here.
    AI can NEVER approve its own actions.
    """
    __tablename__ = "ai_approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_agent_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    action_payload: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)  # MEDIUM or HIGH
    status: Mapped[str] = mapped_column(
        String(50), default=ApprovalStatus.PENDING.value, nullable=False, index=True
    )
    requested_by_agent: Mapped[str] = mapped_column(String(100), nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    agent_run: Mapped["AIAgentRun"] = relationship("AIAgentRun", back_populates="approvals")
    reviewed_by: Mapped[Optional["User"]] = relationship("User")


class WorkspaceAISettings(Base, TimestampMixin):
    """
    Configuration for Workspace AI Provider, model selection, BYOK API keys,
    and private Local Ollama endpoints with zero-data-leakage settings.
    """
    __tablename__ = "workspace_ai_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), default="MOCK", nullable=False)  # GEMINI, OPENAI, OLLAMA, MOCK
    model_name: Mapped[str] = mapped_column(String(100), default="startupai-mock-v1", nullable=False)
    api_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Custom corporate API key
    ollama_base_url: Mapped[str] = mapped_column(String(255), default="http://localhost:11434", nullable=False)
    custom_base_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    temperature: Mapped[float] = mapped_column(Float, default=0.2, nullable=False)
    pii_masking_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace")

