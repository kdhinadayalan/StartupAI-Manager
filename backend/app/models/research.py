from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, generate_uuid, utc_now


class ResearchTopic(str, Enum):
    COMPETITOR = "COMPETITOR"
    MARKET_TREND = "MARKET_TREND"
    CUSTOMER_INSIGHT = "CUSTOMER_INSIGHT"
    PRICING = "PRICING"
    TECHNOLOGY = "TECHNOLOGY"
    REGULATORY = "REGULATORY"
    OTHER = "OTHER"


class SwotCategory(str, Enum):
    STRENGTH = "STRENGTH"
    WEAKNESS = "WEAKNESS"
    OPPORTUNITY = "OPPORTUNITY"
    THREAT = "THREAT"
    GENERAL = "GENERAL"


class ResearchItem(Base, TimestampMixin):
    """
    Market intelligence record.
    Preserves source provenance, factual findings, and SWOT classification.
    """
    __tablename__ = "research_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    topic: Mapped[str] = mapped_column(String(50), default=ResearchTopic.COMPETITOR.value, nullable=False, index=True)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    key_findings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    swot_category: Mapped[str] = mapped_column(String(50), default=SwotCategory.GENERAL.value, nullable=False, index=True)
    competitor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    is_verified: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace")
