import html
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Role, Permission, check_role_permission
from app.models.research import ResearchItem, ResearchTopic, SwotCategory
from app.agents.prompt_defense import sanitize_user_prompt
from app.services.workspace_service import get_member_membership


def create_research_item(
    db: Session,
    workspace_id: str,
    user_id: str,
    title: str,
    topic: str = ResearchTopic.COMPETITOR.value,
    source_name: str = "Internal Research",
    source_url: Optional[str] = None,
    content: str = "",
    key_findings: Optional[str] = None,
    swot_category: str = SwotCategory.GENERAL.value,
    competitor_name: Optional[str] = None,
    is_verified: bool = True,
) -> ResearchItem:
    """
    Store verified research item.
    Treats all external and ingested content as UNTRUSTED DATA and sanitizes against prompt injection.
    """
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.RESEARCH_MANAGE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to manage research.")

    sanitized_content = sanitize_user_prompt(content)
    escaped_title = html.escape(title.strip())

    item = ResearchItem(
        workspace_id=workspace_id,
        title=escaped_title,
        topic=topic,
        source_name=html.escape(source_name.strip()),
        source_url=source_url,
        content=sanitized_content,
        key_findings=html.escape(key_findings.strip()) if key_findings else None,
        swot_category=swot_category,
        competitor_name=html.escape(competitor_name.strip()) if competitor_name else None,
        is_verified=is_verified,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_research_items(
    db: Session,
    workspace_id: str,
    user_id: str,
    topic: Optional[str] = None,
    competitor: Optional[str] = None,
) -> List[ResearchItem]:
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    query = select(ResearchItem).where(ResearchItem.workspace_id == workspace_id)
    if topic:
        query = query.where(ResearchItem.topic == topic)
    if competitor:
        query = query.where(ResearchItem.competitor_name == competitor)

    return list(db.execute(query.order_by(ResearchItem.created_at.desc())).scalars().all())


def get_swot_matrix(db: Session, workspace_id: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Synthesizes SWOT matrix grouping verified items into Strengths, Weaknesses, Opportunities, and Threats.
    """
    items = db.execute(
        select(ResearchItem).where(ResearchItem.workspace_id == workspace_id)
    ).scalars().all()

    matrix: Dict[str, List[Dict[str, Any]]] = {
        "STRENGTH": [],
        "WEAKNESS": [],
        "OPPORTUNITY": [],
        "THREAT": [],
    }

    for item in items:
        if item.swot_category in matrix:
            matrix[item.swot_category].append({
                "id": item.id,
                "title": item.title,
                "key_findings": item.key_findings or item.content[:120],
                "source": item.source_name,
                "competitor": item.competitor_name,
            })

    return matrix


def analyze_competitors(db: Session, workspace_id: str) -> List[Dict[str, Any]]:
    """Groups intelligence by competitor name."""
    items = db.execute(
        select(ResearchItem).where(
            ResearchItem.workspace_id == workspace_id,
            ResearchItem.competitor_name.isnot(None),
        )
    ).scalars().all()

    competitor_map: Dict[str, List[Dict]] = {}
    for it in items:
        name = it.competitor_name or "Unknown"
        if name not in competitor_map:
            competitor_map[name] = []
        competitor_map[name].append({
            "title": it.title,
            "topic": it.topic,
            "swot": it.swot_category,
            "findings": it.key_findings or it.content[:100],
            "source": it.source_name,
        })

    return [{"competitor": k, "intelligence_count": len(v), "findings": v} for k, v in competitor_map.items()]
