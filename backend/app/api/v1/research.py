from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.research import ResearchItemCreate, ResearchItemResponse
from app.services.research_service import (
    create_research_item,
    list_research_items,
    get_swot_matrix,
    analyze_competitors,
)
from app.services.workspace_service import get_member_membership

router = APIRouter(prefix="/workspaces/{workspace_id}/research", tags=["Market & Competitor Research"])


@router.get("/items", response_model=SuccessResponse[List[ResearchItemResponse]])
def get_items(
    workspace_id: str,
    topic: Optional[str] = Query(None),
    competitor: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = list_research_items(db, workspace_id, current_user.id, topic=topic, competitor=competitor)
    return SuccessResponse(data=items)


@router.post("/items", response_model=SuccessResponse[ResearchItemResponse], status_code=status.HTTP_201_CREATED)
def add_item(
    workspace_id: str,
    body: ResearchItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = create_research_item(
        db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        title=body.title,
        topic=body.topic,
        source_name=body.source_name,
        source_url=body.source_url,
        content=body.content,
        key_findings=body.key_findings,
        swot_category=body.swot_category,
        competitor_name=body.competitor_name,
    )
    return SuccessResponse(message="Research item stored.", data=item)


@router.get("/swot", response_model=SuccessResponse[Dict[str, List[Dict[str, Any]]]])
def get_swot(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = get_member_membership(db, workspace_id, current_user.id)
    if not membership:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found.")

    matrix = get_swot_matrix(db, workspace_id)
    return SuccessResponse(data=matrix)


@router.get("/competitors", response_model=SuccessResponse[List[Dict[str, Any]]])
def get_competitors(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = get_member_membership(db, workspace_id, current_user.id)
    if not membership:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found.")

    competitors = analyze_competitors(db, workspace_id)
    return SuccessResponse(data=competitors)
