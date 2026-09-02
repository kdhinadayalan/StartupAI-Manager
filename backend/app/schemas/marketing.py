from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CampaignCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=255)
    channel: str = "SOCIAL_MEDIA"
    budget: float = Field(default=0.0, ge=0)
    target_audience: Optional[str] = None
    goals: Optional[str] = None


class CampaignUpdateMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spend: Optional[float] = Field(None, ge=0)
    impressions: Optional[int] = Field(None, ge=0)
    clicks: Optional[int] = Field(None, ge=0)
    conversions: Optional[int] = Field(None, ge=0)


class CampaignModifyBudget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    budget: float = Field(..., ge=0)


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    workspace_id: str
    name: str
    channel: str
    status: str
    budget: float
    spend: float
    impressions: int
    clicks: int
    conversions: int
    target_audience: Optional[str] = None
    goals: Optional[str] = None
    created_at: datetime
