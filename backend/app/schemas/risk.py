from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class RiskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str = "OPERATIONAL"
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)
    mitigation_plan: Optional[str] = None


class RiskStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    mitigation_plan: Optional[str] = None


class RiskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    workspace_id: str
    title: str
    description: Optional[str] = None
    category: str
    likelihood: int
    impact: int
    risk_score: int
    severity: str
    status: str
    mitigation_plan: Optional[str] = None
    detected_by: str
    created_at: datetime
