from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectMemberCreate,
    ProjectMemberResponse,
)
from app.services.project_service import (
    create_project,
    list_workspace_projects,
    get_project_detail,
    update_project,
    delete_project,
    add_project_member,
    list_project_members,
    remove_project_member,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/projects", tags=["Projects"])


@router.post("", response_model=SuccessResponse[ProjectResponse], status_code=status.HTTP_201_CREATED)
def create_new_project(
    workspace_id: str,
    project_in: ProjectCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project in the workspace."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    project = create_project(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        project_in=project_in,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Project created successfully.", data=project)


@router.get("", response_model=SuccessResponse[List[ProjectResponse]])
def get_projects(
    workspace_id: str,
    status: Optional[str] = Query(None, description="Filter by status: PLANNING, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED"),
    search: Optional[str] = Query(None, description="Search term for name/description"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all projects in the workspace."""
    projects = list_workspace_projects(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        status_filter=status,
        search=search,
    )
    return SuccessResponse(data=projects)


@router.get("/{project_id}", response_model=SuccessResponse[ProjectResponse])
def get_single_project(
    workspace_id: str,
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get project details with anti-IDOR workspace validation."""
    project = get_project_detail(
        db=db,
        workspace_id=workspace_id,
        project_id=project_id,
        user_id=current_user.id,
    )
    return SuccessResponse(data=project)


@router.patch("/{project_id}", response_model=SuccessResponse[ProjectResponse])
def update_existing_project(
    workspace_id: str,
    project_id: str,
    update_in: ProjectUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update project status, budget, deadline, or metadata."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    project = update_project(
        db=db,
        workspace_id=workspace_id,
        project_id=project_id,
        user_id=current_user.id,
        update_in=update_in,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Project updated successfully.", data=project)


@router.delete("/{project_id}", response_model=SuccessResponse[dict])
def remove_project(
    workspace_id: str,
    project_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a project (Requires Admin/Owner)."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    delete_project(
        db=db,
        workspace_id=workspace_id,
        project_id=project_id,
        user_id=current_user.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Project deleted successfully.")


@router.get("/{project_id}/members", response_model=SuccessResponse[List[ProjectMemberResponse]])
def get_project_members(
    workspace_id: str,
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List members assigned to this project."""
    members = list_project_members(
        db=db,
        workspace_id=workspace_id,
        project_id=project_id,
        user_id=current_user.id,
    )
    return SuccessResponse(data=members)


@router.post("/{project_id}/members", response_model=SuccessResponse[ProjectMemberResponse], status_code=status.HTTP_201_CREATED)
def assign_project_member(
    workspace_id: str,
    project_id: str,
    member_in: ProjectMemberCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign a workspace user to the project."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    member = add_project_member(
        db=db,
        workspace_id=workspace_id,
        project_id=project_id,
        user_id=current_user.id,
        member_in=member_in,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Project member added successfully.", data=member)


@router.delete("/{project_id}/members/{user_id}", response_model=SuccessResponse[dict])
def unassign_project_member(
    workspace_id: str,
    project_id: str,
    user_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a user from the project."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    remove_project_member(
        db=db,
        workspace_id=workspace_id,
        project_id=project_id,
        user_id=current_user.id,
        member_user_id=user_id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Project member removed successfully.")
