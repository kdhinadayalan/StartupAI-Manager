from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    RefreshTokenRequest,
    SessionResponse,
    TokenResponse,
)
from app.schemas.common import SuccessResponse
from app.schemas.user import UserCreate, UserResponse
from app.services.auth_service import (
    authenticate_user,
    change_user_password,
    create_user_session,
    list_user_sessions,
    refresh_user_tokens,
    register_user,
    revoke_all_user_sessions,
    revoke_session_by_jti,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=SuccessResponse[UserResponse], status_code=status.HTTP_201_CREATED)
def register(
    request: Request,
    user_in: UserCreate,
    db: Session = Depends(get_db),
):
    """Register a new user account."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)
    user = register_user(db, user_in, ip_address=ip_address, correlation_id=correlation_id)
    return SuccessResponse(message="User registered successfully.", data=user)


@router.post("/login", response_model=SuccessResponse[TokenResponse])
def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    """Authenticate with email and password, creating a persistent session."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    correlation_id = getattr(request.state, "correlation_id", None)

    user = authenticate_user(
        db=db,
        email=login_data.email,
        password=login_data.password,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    tokens, _ = create_user_session(db, user, ip_address=ip_address, user_agent=user_agent)
    return SuccessResponse(message="Login successful.", data=tokens)


@router.post("/refresh", response_model=SuccessResponse[TokenResponse])
def refresh_token(
    request: Request,
    body: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """Rotate tokens and validate against persistent database session."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    correlation_id = getattr(request.state, "correlation_id", None)

    new_tokens = refresh_user_tokens(
        db=db,
        refresh_token=body.refresh_token,
        ip_address=ip_address,
        user_agent=user_agent,
        correlation_id=correlation_id,
    )
    return SuccessResponse(message="Token refreshed successfully.", data=new_tokens)


@router.post("/logout", response_model=SuccessResponse[dict])
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke the current session persistently in PostgreSQL/database."""
    current_jti = getattr(request.state, "current_jti", None)
    correlation_id = getattr(request.state, "correlation_id", None)

    if current_jti:
        revoke_session_by_jti(db, jti=current_jti, user_id=current_user.id, correlation_id=correlation_id)

    return SuccessResponse(message="Session successfully revoked and logged out.")


@router.post("/logout-all", response_model=SuccessResponse[dict])
def logout_all_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke all active sessions for the current user in PostgreSQL/database."""
    correlation_id = getattr(request.state, "correlation_id", None)
    revoked_count = revoke_all_user_sessions(db, current_user.id, correlation_id=correlation_id)
    return SuccessResponse(
        message=f"All active sessions ({revoked_count}) have been revoked.",
        data={"revoked_count": revoked_count},
    )


@router.get("/me", response_model=SuccessResponse[UserResponse])
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Get profile of authenticated user."""
    return SuccessResponse(data=current_user)


@router.get("/sessions", response_model=SuccessResponse[List[SessionResponse]])
def get_active_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all persistent sessions for the authenticated user."""
    sessions = list_user_sessions(db, current_user.id)
    return SuccessResponse(data=sessions)


@router.delete("/sessions/{jti}", response_model=SuccessResponse[dict])
def revoke_specific_session(
    jti: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke a specific session JTI belonging to the user."""
    correlation_id = getattr(request.state, "correlation_id", None)
    revoked = revoke_session_by_jti(db, jti=jti, user_id=current_user.id, correlation_id=correlation_id)
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or already revoked.",
        )
    return SuccessResponse(message="Session revoked successfully.")


@router.post("/change-password", response_model=SuccessResponse[dict])
def change_password(
    request: Request,
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change user password, encrypt with Argon2id, and revoke all active sessions."""
    ip_address = request.client.host if request.client else None
    correlation_id = getattr(request.state, "correlation_id", None)

    change_user_password(
        db=db,
        user=current_user,
        current_password=body.current_password,
        new_password=body.new_password,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return SuccessResponse(
        message="Password updated successfully. All active sessions have been revoked."
    )
