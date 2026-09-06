import html
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, MemberInviteRequest
from app.services.audit_service import log_audit_event


def get_member_membership(db: Session, workspace_id: str, user_id: str) -> Optional[WorkspaceMember]:
    """Retrieve membership record for authorization verification."""
    return db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    ).scalar_one_or_none()


def get_single_company(db: Session) -> Optional[Workspace]:
    """Retrieve the single company workspace if initialized."""
    return db.execute(select(Workspace).order_by(Workspace.created_at.asc())).scalar_one_or_none()


def create_workspace(
    db: Session,
    user: User,
    workspace_in: WorkspaceCreate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Workspace:
    """Creates the single company workspace and designates creator as the OWNER."""
    existing_company = get_single_company(db)
    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Single-company system: A company workspace already exists. Multiple companies are not supported.",
        )
    workspace = Workspace(
        name=html.escape(workspace_in.name.strip()),
        description=html.escape(workspace_in.description.strip()) if workspace_in.description else None,
        industry=html.escape(workspace_in.industry.strip()) if workspace_in.industry else None,
        stage=html.escape(workspace_in.stage.strip()) if workspace_in.stage else None,
        website=html.escape(workspace_in.website.strip()) if workspace_in.website else None,
        region=html.escape(workspace_in.region.strip()) if workspace_in.region else None,
        currency=workspace_in.currency or "USD",
        owner_id=user.id,
    )
    db.add(workspace)
    db.flush()

    # Create Owner membership
    owner_membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role=Role.OWNER.value,
        joined_at=utc_now(),
    )
    db.add(owner_membership)
    db.commit()
    db.refresh(workspace)

    log_audit_event(
        db=db,
        action="WORKSPACE_CREATED",
        user_id=user.id,
        workspace_id=workspace.id,
        resource_type="workspace",
        resource_id=workspace.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details={"name": workspace.name},
    )
    return workspace


def get_user_workspaces(db: Session, user_id: str) -> List[Workspace]:
    """List all workspaces where user is an active member."""
    query = (
        select(Workspace)
        .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(Workspace.created_at.desc())
    )
    return list(db.execute(query).scalars().all())


def get_workspace_detail(db: Session, workspace_id: str, user_id: str) -> Workspace:
    """Retrieve workspace if user is a member; return 404 to avoid IDOR and resource enumeration."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    workspace = db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    ).scalar_one_or_none()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    return workspace


def update_workspace(
    db: Session,
    workspace_id: str,
    user_id: str,
    update_in: WorkspaceUpdate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Workspace:
    """Update workspace attributes with RBAC check."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership or not check_role_permission(Role(membership.role), Permission.WORKSPACE_UPDATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to update workspace.",
        )

    workspace = db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    ).scalar_one_or_none()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    update_data = update_in.model_dump(exclude_unset=True)
    for str_field in ["name", "description", "industry", "stage", "website", "region"]:
        if str_field in update_data and update_data[str_field]:
            update_data[str_field] = html.escape(update_data[str_field].strip())

    for field, value in update_data.items():
        setattr(workspace, field, value)

    db.commit()
    db.refresh(workspace)

    log_audit_event(
        db=db,
        action="WORKSPACE_UPDATED",
        user_id=user_id,
        workspace_id=workspace.id,
        resource_type="workspace",
        resource_id=workspace.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details=update_data,
    )
    return workspace


def delete_workspace(
    db: Session,
    workspace_id: str,
    user_id: str,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """Delete workspace (Owner-only operation)."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    if not check_role_permission(Role(membership.role), Permission.WORKSPACE_DELETE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace Owners can delete workspaces.",
        )

    workspace = db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    ).scalar_one_or_none()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    ws_name = workspace.name
    db.delete(workspace)
    db.commit()

    log_audit_event(
        db=db,
        action="WORKSPACE_DELETED",
        user_id=user_id,
        workspace_id=None,
        resource_type="workspace",
        resource_id=workspace_id,
        details={"workspace_name": ws_name, "deleted_workspace_id": workspace_id},
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return True


def list_workspace_members(db: Session, workspace_id: str, user_id: str) -> List[WorkspaceMember]:
    """List all members of a workspace."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    query = (
        select(WorkspaceMember)
        .options(joinedload(WorkspaceMember.user))
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.joined_at.asc())
    )
    return list(db.execute(query).scalars().all())


def add_workspace_member(
    db: Session,
    workspace_id: str,
    user_id: str,
    invite_in: MemberInviteRequest,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> WorkspaceMember:
    """Invite an existing user by email to join the workspace."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership or not check_role_permission(Role(membership.role), Permission.MEMBER_INVITE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to invite members.",
        )

    # Privilege escalation guards
    if invite_in.role == Role.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign OWNER role via invitation. The initial bootstrap user is the OWNER.",
        )
    if invite_in.role == Role.ADMIN and membership.role != Role.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the OWNER can assign or invite ADMIN members.",
        )

    target_user = db.execute(
        select(User).where(User.email == invite_in.email.lower())
    ).scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email does not exist.",
        )

    existing_membership = get_member_membership(db, workspace_id, target_user.id)
    if existing_membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this workspace.",
        )

    new_member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=target_user.id,
        role=invite_in.role.value,
        joined_at=utc_now(),
    )
    db.add(new_member)
    db.commit()

    # Re-query with user relationship loaded
    new_member = db.execute(
        select(WorkspaceMember)
        .options(joinedload(WorkspaceMember.user))
        .where(WorkspaceMember.id == new_member.id)
    ).scalar_one()

    log_audit_event(
        db=db,
        action="MEMBER_ADDED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="workspace_member",
        resource_id=new_member.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details={"added_user_email": target_user.email, "role": invite_in.role.value},
    )
    return new_member


def update_workspace_member_role(
    db: Session,
    workspace_id: str,
    user_id: str,
    target_member_id: str,
    new_role: Role,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> WorkspaceMember:
    """Update a member's role."""
    caller_membership = get_member_membership(db, workspace_id, user_id)
    if not caller_membership or not check_role_permission(Role(caller_membership.role), Permission.MEMBER_UPDATE_ROLE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to update member roles.",
        )

    target_member = db.execute(
        select(WorkspaceMember)
        .options(joinedload(WorkspaceMember.user))
        .where(WorkspaceMember.id == target_member_id, WorkspaceMember.workspace_id == workspace_id)
    ).scalar_one_or_none()

    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this workspace.",
        )

    # Privilege escalation guards
    if new_role == Role.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign OWNER role. The initial bootstrap user is the OWNER.",
        )
    if new_role == Role.ADMIN and caller_membership.role != Role.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the OWNER can assign ADMIN role.",
        )
    if target_member.role in (Role.OWNER.value, Role.ADMIN.value) and caller_membership.role != Role.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the OWNER can modify OWNER or ADMIN members.",
        )

    # Protect against demoting the last owner
    if target_member.role == Role.OWNER.value and new_role != Role.OWNER:
        owner_count = db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.role == Role.OWNER.value,
            )
        ).scalars().all()
        if len(owner_count) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the sole workspace owner.",
            )

    old_role = target_member.role
    target_member.role = new_role.value
    db.commit()

    log_audit_event(
        db=db,
        action="ROLE_CHANGED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="workspace_member",
        resource_id=target_member.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details={"old_role": old_role, "new_role": new_role.value},
    )
    return target_member


def remove_workspace_member(
    db: Session,
    workspace_id: str,
    user_id: str,
    target_member_id: str,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """Remove a member from the workspace."""
    caller_membership = get_member_membership(db, workspace_id, user_id)
    if not caller_membership or not check_role_permission(Role(caller_membership.role), Permission.MEMBER_REMOVE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to remove members.",
        )

    target_member = db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.id == target_member_id,
            WorkspaceMember.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()

    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this workspace.",
        )

    if target_member.role == Role.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workspace owners cannot be removed directly.",
        )

    if target_member.role == Role.ADMIN.value and caller_membership.role != Role.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the OWNER can remove ADMIN members.",
        )

    db.delete(target_member)
    db.commit()

    log_audit_event(
        db=db,
        action="MEMBER_REMOVED",
        user_id=user_id,
        workspace_id=workspace_id,
        resource_type="workspace_member",
        resource_id=target_member_id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return True
