from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, generate_uuid, utc_now


class RiskCategory(str, Enum):
    FINANCIAL = "FINANCIAL"
    OPERATIONAL = "OPERATIONAL"
    PROJECT = "PROJECT"
    MARKETING = "MARKETING"
    MARKET = "MARKET"
    TECHNICAL = "TECHNICAL"
    TEAM = "TEAM"
    STRATEGIC = "STRATEGIC"


class RiskSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskStatus(str, Enum):
    IDENTIFIED = "IDENTIFIED"
    MONITORING = "MONITORING"
    MITIGATED = "MITIGATED"
    ACCEPTED = "ACCEPTED"


class RiskItem(Base, TimestampMixin):
    """
    Startup risk item.
    Enforces deterministic risk scoring: likelihood (1-5) * impact (1-5) = risk_score (1-25).
    """
    __tablename__ = "risk_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default=RiskCategory.OPERATIONAL.value, nullable=False, index=True)
    likelihood: Mapped[int] = mapped_column(Integer, default=3, nullable=False)  # 1 to 5
    impact: Mapped[int] = mapped_column(Integer, default=3, nullable=False)      # 1 to 5
    risk_score: Mapped[int] = mapped_column(Integer, default=9, nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), default=RiskSeverity.MEDIUM.value, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default=RiskStatus.IDENTIFIED.value, nullable=False, index=True)
    mitigation_plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detected_by: Mapped[str] = mapped_column(String(50), default="HUMAN", nullable=False)  # "AI_AGENT" or "HUMAN"
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace")
