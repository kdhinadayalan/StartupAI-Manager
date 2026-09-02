from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ResearchItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=255)
    topic: str = "COMPETITOR"
    source_name: str = "Internal Research"
    source_url: Optional[str] = None
    content: str = Field(..., min_length=1)
    key_findings: Optional[str] = None
    swot_category: str = "GENERAL"
    competitor_name: Optional[str] = None


class ResearchItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    workspace_id: str
    title: str
    topic: str
    source_name: str
    source_url: Optional[str] = None
    content: str
    key_findings: Optional[str] = None
    swot_category: str
    competitor_name: Optional[str] = None
    is_verified: bool
    created_at: datetime
