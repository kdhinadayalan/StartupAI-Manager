from typing import List
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceMemberResponse,
    MemberInviteRequest,
    MemberUpdateRoleRequest,
)
from app.services.workspace_service import (
    create_workspace,
    get_user_workspaces,
    get_workspace_detail,
    update_workspace,
    delete_workspace,
    list_workspace_members,
    add_workspace_member,
    update_workspace_member_role,
    remove_workspace_member,
)

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


@router.post("", response_model=SuccessResponse[WorkspaceResponse], status_code=status.HTTP_201_CREATED)
def create_new_workspace(
    request: Request,
    workspace_in: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new startup workspace and designate creator as Owner."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    workspace = create_workspace(
        db=db,
        user=current_user,
        workspace_in=workspace_in,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Workspace created successfully.", data=workspace)


@router.get("", response_model=SuccessResponse[List[WorkspaceResponse]])
def list_my_workspaces(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all workspaces where authenticated user is an active member."""
    workspaces = get_user_workspaces(db=db, user_id=current_user.id)
    return SuccessResponse(data=workspaces)


@router.get("/{workspace_id}", response_model=SuccessResponse[WorkspaceResponse])
def get_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single workspace metadata with isolation validation."""
    workspace = get_workspace_detail(db=db, workspace_id=workspace_id, user_id=current_user.id)
    return SuccessResponse(data=workspace)


@router.patch("/{workspace_id}", response_model=SuccessResponse[WorkspaceResponse])
def update_existing_workspace(
    workspace_id: str,
    workspace_in: WorkspaceUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update workspace details (Requires Admin/Owner)."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    updated = update_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        update_in=workspace_in,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Workspace updated successfully.", data=updated)


@router.delete("/{workspace_id}", response_model=SuccessResponse[dict])
def remove_workspace(
    workspace_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a workspace (Requires Owner role)."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    delete_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Workspace deleted successfully.")


@router.get("/{workspace_id}/members", response_model=SuccessResponse[List[WorkspaceMemberResponse]])
def get_members(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List members of a workspace."""
    members = list_workspace_members(db=db, workspace_id=workspace_id, user_id=current_user.id)
    return SuccessResponse(data=members)


@router.post("/{workspace_id}/members", response_model=SuccessResponse[WorkspaceMemberResponse], status_code=status.HTTP_201_CREATED)
def invite_member(
    workspace_id: str,
    invite_in: MemberInviteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an existing user to the workspace with assigned role (Requires Admin/Owner)."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    member = add_workspace_member(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        invite_in=invite_in,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Member added successfully.", data=member)


@router.patch("/{workspace_id}/members/{member_id}", response_model=SuccessResponse[WorkspaceMemberResponse])
def update_member_role(
    workspace_id: str,
    member_id: str,
    role_in: MemberUpdateRoleRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change role of a workspace member (Requires Admin/Owner)."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    updated_member = update_workspace_member_role(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        target_member_id=member_id,
        new_role=role_in.role,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Member role updated.", data=updated_member)


@router.delete("/{workspace_id}/members/{member_id}", response_model=SuccessResponse[dict])
def remove_member(
    workspace_id: str,
    member_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a user from the workspace (Requires Admin/Owner)."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    remove_workspace_member(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        target_member_id=member_id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Member removed successfully.")
