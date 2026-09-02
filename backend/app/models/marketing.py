from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, generate_uuid, utc_now


class CampaignChannel(str, Enum):
    SOCIAL_MEDIA = "SOCIAL_MEDIA"
    EMAIL = "EMAIL"
    SEARCH_ADS = "SEARCH_ADS"
    CONTENT = "CONTENT"
    EVENTS = "EVENTS"
    OTHER = "OTHER"


class CampaignStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"


class MarketingCampaign(Base, TimestampMixin):
    """Marketing campaign entity tracking spend, channel performance, and conversion metrics."""
    __tablename__ = "marketing_campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), default=CampaignChannel.SOCIAL_MEDIA.value, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=CampaignStatus.DRAFT.value, nullable=False, index=True)
    budget: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    spend: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    impressions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    conversions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_audience: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    goals: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace")
