from datetime import timedelta
import pytest
import jwt

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token_identifier,
)
from app.core.permissions import Role, Permission, check_role_permission


def test_argon2id_password_hashing():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    # Verify Argon2 format
    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False


def test_short_password_rejection():
    with pytest.raises(ValueError, match="at least 8 characters"):
        hash_password("short")


def test_access_token_lifecycle():
    user_id = "test-user-uuid-123"
    token, jti, expire = create_access_token(user_id=user_id)

    assert isinstance(token, str)
    assert len(jti) > 0

    decoded = decode_token(token)
    assert decoded["sub"] == user_id
    assert decoded["jti"] == jti
    assert decoded["type"] == "access"
    assert "exp" in decoded


def test_refresh_token_lifecycle():
    user_id = "test-user-uuid-123"
    token, jti, expire = create_refresh_token(user_id=user_id)

    assert isinstance(token, str)
    decoded = decode_token(token)
    assert decoded["sub"] == user_id
    assert decoded["jti"] == jti
    assert decoded["type"] == "refresh"


def test_expired_token_rejection():
    user_id = "test-user-uuid-123"
    # Token expired 10 seconds ago
    token, _, _ = create_access_token(user_id=user_id, expires_delta=timedelta(seconds=-10))

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(token)


def test_token_hash_deterministic():
    token = "sample_refresh_token_string"
    h1 = hash_token_identifier(token)
    h2 = hash_token_identifier(token)
    assert h1 == h2
    assert len(h1) == 64  # SHA-256


def test_rbac_permissions_matrix():
    # Owner has all
    assert check_role_permission(Role.OWNER, Permission.WORKSPACE_DELETE) is True
    assert check_role_permission(Role.OWNER, Permission.AI_APPROVE_HIGH) is True

    # Admin cannot delete workspace, but can approve high-risk AI actions and invite members
    assert check_role_permission(Role.ADMIN, Permission.WORKSPACE_DELETE) is False
    assert check_role_permission(Role.ADMIN, Permission.AI_APPROVE_HIGH) is True
    assert check_role_permission(Role.ADMIN, Permission.MEMBER_INVITE) is True

    # Manager can approve medium-risk AI actions, but not high-risk
    assert check_role_permission(Role.MANAGER, Permission.AI_APPROVE_MEDIUM) is True
    assert check_role_permission(Role.MANAGER, Permission.AI_APPROVE_HIGH) is False

    # Team Member cannot manage finance or approve AI actions
    assert check_role_permission(Role.TEAM_MEMBER, Permission.FINANCE_CREATE) is False
    assert check_role_permission(Role.TEAM_MEMBER, Permission.AI_APPROVE_MEDIUM) is False
    assert check_role_permission(Role.TEAM_MEMBER, Permission.TASK_READ) is True

    # Viewer has read-only access
    assert check_role_permission(Role.VIEWER, Permission.TASK_READ) is True
    assert check_role_permission(Role.VIEWER, Permission.TASK_CREATE) is False
