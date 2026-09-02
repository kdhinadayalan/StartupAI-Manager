import html
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.workspace import WorkspaceMember
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectMemberCreate
from app.services.audit_service import log_audit_event
from app.services.workspace_service import get_member_membership


def create_project(
    db: Session,
    workspace_id: str,
    user_id: str,
    project_in: ProjectCreate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Project:
    """Create a project within a verified workspace."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership or not check_role_permission(Role(membership.role), Permission.PROJECT_CREATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to create projects.",
        )

    # Validate owner belongs to the same workspace if provided
    if project_in.owner_id:
        owner_membership = get_member_membership(db, workspace_id, project_in.owner_id)
        if not owner_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Designated project owner must be a member of this workspace.",
            )

    project = Project(
        workspace_id=workspace_id,
        name=html.escape(project_in.name.strip()),
        description=html.escape(project_in.description.strip()) if project_in.description else None,
        status=project_in.status.value,
        priority=project_in.priority,
        deadline=project_in.deadline,
        budget=project_in.budget,
        owner_id=project_in.owner_id or user_id,
        created_by_id=user_id,
    )
    db.add(project)
    db.flush()

    # Automatically add creator as a project member
    member = ProjectMember(
        project_id=project.id,
        user_id=user_id,
        role="LEAD",
        joined_at=utc_now(),
    )
    db.add(member)
    db.commit()

    # Reload with relationships
    project = db.execute(
        select(Project)
        .options(joinedload(Project.owner), joinedload(Project.created_by))
        .where(Project.id == project.id)
    ).scalar_one()

    log_audit_event(
        db=db,
        action="PROJECT_CREATED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="project",
        resource_id=project.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details={"name": project.name, "status": project.status},
    )
    return project


def list_workspace_projects(
    db: Session,
    workspace_id: str,
    user_id: str,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Project]:
    """Retrieve all projects for a workspace with optional status and search filtering."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    query = (
        select(Project)
        .options(joinedload(Project.owner), joinedload(Project.created_by))
        .where(Project.workspace_id == workspace_id)
    )

    if status_filter:
        query = query.where(Project.status == status_filter)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Project.name.ilike(search_pattern),
                Project.description.ilike(search_pattern),
            )
        )

    query = query.order_by(Project.created_at.desc())
    return list(db.execute(query).scalars().all())


def get_project_detail(
    db: Session,
    workspace_id: str,
    project_id: str,
    user_id: str,
) -> Project:
    """Retrieve a specific project enforcing strict tenant boundaries (anti-IDOR)."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    project = db.execute(
        select(Project)
        .options(joinedload(Project.owner), joinedload(Project.created_by))
        .where(Project.id == project_id, Project.workspace_id == workspace_id)
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found in this workspace.",
        )
    return project


def update_project(
    db: Session,
    workspace_id: str,
    project_id: str,
    user_id: str,
    update_in: ProjectUpdate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Project:
    """Update project details."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership or not check_role_permission(Role(membership.role), Permission.PROJECT_UPDATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to update project.",
        )

    project = get_project_detail(db, workspace_id, project_id, user_id)

    update_dict = update_in.model_dump(exclude_unset=True)
    if "status" in update_dict and update_dict["status"]:
        update_dict["status"] = update_dict["status"].value

    if "owner_id" in update_dict and update_dict["owner_id"]:
        owner_membership = get_member_membership(db, workspace_id, update_dict["owner_id"])
        if not owner_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Designated project owner must be a member of this workspace.",
            )

    if "name" in update_dict and update_dict["name"]:
        update_dict["name"] = html.escape(update_dict["name"].strip())
    if "description" in update_dict and update_dict["description"]:
        update_dict["description"] = html.escape(update_dict["description"].strip())

    for field, value in update_dict.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)

    log_audit_event(
        db=db,
        action="PROJECT_UPDATED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="project",
        resource_id=project.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details=update_dict,
    )
    return project


def delete_project(
    db: Session,
    workspace_id: str,
    project_id: str,
    user_id: str,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """Delete project (Requires PROJECT_DELETE permission: Admin/Owner)."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership or not check_role_permission(Role(membership.role), Permission.PROJECT_DELETE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to delete projects.",
        )

    project = get_project_detail(db, workspace_id, project_id, user_id)
    db.delete(project)
    db.commit()

    log_audit_event(
        db=db,
        action="PROJECT_DELETED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="project",
        resource_id=project_id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return True


def add_project_member(
    db: Session,
    workspace_id: str,
    project_id: str,
    user_id: str,
    member_in: ProjectMemberCreate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> ProjectMember:
    """
    Add a workspace member to a project.
    Strictly verifies that target user belongs to the same workspace!
    """
    caller_membership = get_member_membership(db, workspace_id, user_id)
    if not caller_membership or not check_role_permission(Role(caller_membership.role), Permission.PROJECT_UPDATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to manage project members.",
        )

    # Verify project exists and belongs to workspace
    get_project_detail(db, workspace_id, project_id, user_id)

    # Verify target user belongs to this workspace
    target_workspace_member = get_member_membership(db, workspace_id, member_in.user_id)
    if not target_workspace_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to the workspace before being added to a project.",
        )

    # Check if already a project member
    existing = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == member_in.user_id,
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project.",
        )

    new_member = ProjectMember(
        project_id=project_id,
        user_id=member_in.user_id,
        role=member_in.role,
        joined_at=utc_now(),
    )
    db.add(new_member)
    db.commit()

    # Re-query with user relationship loaded
    new_member = db.execute(
        select(ProjectMember)
        .options(joinedload(ProjectMember.user))
        .where(ProjectMember.id == new_member.id)
    ).scalar_one()

    log_audit_event(
        db=db,
        action="PROJECT_MEMBER_ADDED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="project_member",
        resource_id=new_member.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details={"project_id": project_id, "user_id": member_in.user_id, "role": member_in.role},
    )
    return new_member


def list_project_members(
    db: Session,
    workspace_id: str,
    project_id: str,
    user_id: str,
) -> List[ProjectMember]:
    """List members of a project."""
    get_project_detail(db, workspace_id, project_id, user_id)

    query = (
        select(ProjectMember)
        .options(joinedload(ProjectMember.user))
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.joined_at.asc())
    )
    return list(db.execute(query).scalars().all())


def remove_project_member(
    db: Session,
    workspace_id: str,
    project_id: str,
    user_id: str,
    member_user_id: str,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """Remove a user from a project."""
    caller_membership = get_member_membership(db, workspace_id, user_id)
    if not caller_membership or not check_role_permission(Role(caller_membership.role), Permission.PROJECT_UPDATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to manage project members.",
        )

    get_project_detail(db, workspace_id, project_id, user_id)

    member = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == member_user_id,
        )
    ).scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project member not found.",
        )

    db.delete(member)
    db.commit()

    log_audit_event(
        db=db,
        action="PROJECT_MEMBER_REMOVED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="project_member",
        resource_id=project_id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details={"removed_user_id": member_user_id},
    )
    return True
