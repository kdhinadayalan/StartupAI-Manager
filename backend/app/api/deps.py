from typing import Callable, List, Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import Role, Permission, check_role_permission
from app.core.security import decode_token
from app.database.base import utc_now
from app.database.session import get_db
from app.models.user import User
from app.models.session import UserSession
from app.models.workspace import Workspace, WorkspaceMember

security = HTTPBearer(auto_error=False)


def get_token_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    """
    Extracts Bearer token, decodes JWT, and verifies persistent session revocation in PostgreSQL.
    Guarantees zero reliance on volatile in-memory state.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for API access.",
        )

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims: missing session identifier (JTI).",
        )

    # Validate against persistent database session store
    session = db.execute(
        select(UserSession).where(UserSession.token_jti == jti)
    ).scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or does not exist.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if session.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This session has been revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def get_current_user(
    request: Request,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> User:
    """Resolve current user from token subject."""
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject.",
        )

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    # Store current jti on request state for logout endpoint
    request.state.current_jti = payload.get("jti")
    return user


def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required.",
        )
    return current_user


def get_workspace_membership(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceMember:
    """
    Enforces multi-tenant isolation.
    Verifies that the current user belongs to the requested workspace.
    Returns 404 to avoid resource enumeration if workspace doesn't exist or user lacks access.
    """
    membership = db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    return membership


def require_roles(allowed_roles: List[Role]) -> Callable:
    """Factory dependency for RBAC role checking."""
    def role_checker(
        membership: WorkspaceMember = Depends(get_workspace_membership),
    ) -> WorkspaceMember:
        user_role = Role(membership.role)
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of the following roles: {[r.value for r in allowed_roles]}.",
            )
        return membership

    return role_checker


def require_permission(permission: Permission) -> Callable:
    """Factory dependency for granular RBAC permission checking."""
    def permission_checker(
        membership: WorkspaceMember = Depends(get_workspace_membership),
    ) -> WorkspaceMember:
        user_role = Role(membership.role)
        if not check_role_permission(user_role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires permission: {permission.value}.",
            )
        return membership

    return permission_checker
