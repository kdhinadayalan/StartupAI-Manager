from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, update

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token_identifier,
)
from app.database.base import utc_now
from app.models.user import User
from app.models.session import UserSession
from app.schemas.user import UserCreate
from app.schemas.auth import TokenResponse
from app.services.audit_service import log_audit_event


def register_user(
    db: Session,
    user_in: UserCreate,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> User:
    """Register a new user with Argon2id hashed password."""
    # Check if user already exists
    existing = db.execute(
        select(User).where(User.email == user_in.email.lower())
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Hash password with Argon2id
    hashed = hash_password(user_in.password)

    user = User(
        email=user_in.email.lower(),
        hashed_password=hashed,
        full_name=user_in.full_name.strip(),
        avatar_url=user_in.avatar_url,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action="USER_REGISTERED",
        user_id=user.id,
        resource_type="user",
        resource_id=user.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
        details={"email": user.email},
    )

    return user


def authenticate_user(
    db: Session,
    email: str,
    password: str,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> User:
    """Verify credentials and return active user, or raise 401."""
    user = db.execute(
        select(User).where(User.email == email.lower())
    ).scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            resource_type="auth",
            details={"email": email.lower()},
            ip_address=ip_address,
            correlation_id=correlation_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    log_audit_event(
        db=db,
        action="LOGIN_SUCCESS",
        user_id=user.id,
        resource_type="auth",
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return user


def create_user_session(
    db: Session,
    user: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[TokenResponse, UserSession]:
    """
    Creates access & refresh tokens and stores the session persistently in the DB.
    Enforces persistent session tracking and revocation capability.
    """
    # Create tokens sharing a unified session JTI
    access_token, jti, access_expires = create_access_token(user.id)
    refresh_token, _, refresh_expires = create_refresh_token(user.id, jti=jti)

    # Persist session record in DB
    session = UserSession(
        user_id=user.id,
        token_jti=jti,
        refresh_token_hash=hash_token_identifier(refresh_token),
        user_agent=user_agent[:500] if user_agent else None,
        ip_address=ip_address,
        is_revoked=False,
        expires_at=refresh_expires,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    token_response = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        expires_in=int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
        user=user,
    )
    return token_response, session


def refresh_user_tokens(
    db: Session,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> TokenResponse:
    """
    Validates refresh token against persistent database session,
    rotates tokens, revokes the old session, and issues a new session.
    """
    try:
        payload = decode_token(refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    user_id = payload.get("sub")
    jti = payload.get("jti")

    if not user_id or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims.",
        )

    # Query persistent database session store
    session = db.execute(
        select(UserSession).where(UserSession.token_jti == jti)
    ).scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session not found or expired.",
        )

    # Check revocation status in DB
    if session.is_revoked:
        # Potential token reuse attack! Revoke all sessions for this user for safety
        db.execute(
            update(UserSession)
            .where(UserSession.user_id == user_id)
            .values(is_revoked=True, revoked_at=utc_now())
        )
        db.commit()
        log_audit_event(
            db=db,
            action="TOKEN_REUSE_DETECTED",
            user_id=user_id,
            details={"revoked_jti": jti},
            ip_address=ip_address,
            correlation_id=correlation_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Revoked token used. All sessions terminated for security.",
        )

    # Verify refresh token hash matches stored hash
    if session.refresh_token_hash != hash_token_identifier(refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token credentials.",
        )

    # Revoke current session (Token rotation)
    session.is_revoked = True
    session.revoked_at = utc_now()
    db.commit()

    # Verify user exists and is active
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    # Issue new token pair
    new_token_resp, _ = create_user_session(db, user, ip_address, user_agent)
    return new_token_resp


def revoke_session_by_jti(
    db: Session,
    jti: str,
    user_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """
    Persistently marks a session as revoked in the database.
    Does not rely on process-local memory.
    """
    query = select(UserSession).where(UserSession.token_jti == jti)
    if user_id:
        query = query.where(UserSession.user_id == user_id)

    session = db.execute(query).scalar_one_or_none()
    if not session:
        return False

    session.is_revoked = True
    session.revoked_at = utc_now()
    db.commit()

    log_audit_event(
        db=db,
        action="SESSION_REVOKED",
        user_id=session.user_id,
        resource_type="session",
        resource_id=session.id,
        correlation_id=correlation_id,
        details={"jti": jti},
    )
    return True


def revoke_all_user_sessions(
    db: Session,
    user_id: str,
    correlation_id: Optional[str] = None,
) -> int:
    """Revoke all active sessions for a user persistently in the database."""
    now = utc_now()
    result = db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.is_revoked == False)
        .values(is_revoked=True, revoked_at=now)
    )
    db.commit()

    log_audit_event(
        db=db,
        action="ALL_SESSIONS_REVOKED",
        user_id=user_id,
        resource_type="user",
        resource_id=user_id,
        correlation_id=correlation_id,
    )
    return result.rowcount


def list_user_sessions(db: Session, user_id: str) -> List[UserSession]:
    """Retrieve all active and past sessions for a user."""
    return list(
        db.execute(
            select(UserSession)
            .where(UserSession.user_id == user_id)
            .order_by(UserSession.created_at.desc())
        ).scalars().all()
    )


def change_user_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """Verify old password, update to new Argon2id hash, and revoke all other sessions."""
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    user.hashed_password = hash_password(new_password)
    db.commit()

    # Security rule: revoke all sessions on password change
    revoke_all_user_sessions(db, user.id, correlation_id)

    log_audit_event(
        db=db,
        action="PASSWORD_CHANGED",
        user_id=user.id,
        resource_type="user",
        resource_id=user.id,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    return True


def update_user_profile(
    db: Session,
    user: User,
    full_name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> User:
    """Update user's full name and avatar URL. Email and password cannot be mutated here."""
    updated = False
    if full_name is not None:
        trimmed = full_name.strip()
        if len(trimmed) < 2 or len(trimmed) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name must be between 2 and 100 characters.",
            )
        user.full_name = trimmed
        updated = True

    if avatar_url is not None:
        user.avatar_url = avatar_url.strip() if avatar_url.strip() else None
        updated = True

    if updated:
        user.updated_at = utc_now()
        db.commit()
        db.refresh(user)

        log_audit_event(
            db=db,
            action="USER_PROFILE_UPDATED",
            user_id=user.id,
            resource_type="user",
            resource_id=user.id,
            details={"full_name": user.full_name, "avatar_url": user.avatar_url},
            ip_address=ip_address,
            correlation_id=correlation_id,
        )

    return user

