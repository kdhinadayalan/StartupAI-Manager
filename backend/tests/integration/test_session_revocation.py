import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.session import UserSession
from app.core.security import decode_token


def test_persistent_session_creation_in_db(client: TestClient, db: Session):
    # 1. Register user
    client.post(
        "/api/v1/auth/register",
        json={"email": "session_test@startup.io", "password": "Password123!", "full_name": "Session User"},
    )

    # 2. Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "session_test@startup.io", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["data"]["access_token"]
    payload = decode_token(token)
    jti = payload["jti"]

    # 3. Verify persistent DB record exists in user_sessions table
    db_session = db.execute(
        select(UserSession).where(UserSession.token_jti == jti)
    ).scalar_one_or_none()

    assert db_session is not None
    assert db_session.token_jti == jti
    assert db_session.is_revoked is False


def test_logout_revokes_session_in_db_and_denies_future_requests(client: TestClient, db: Session):
    # 1. Register and Login
    client.post(
        "/api/v1/auth/register",
        json={"email": "logout_test@startup.io", "password": "Password123!", "full_name": "Logout User"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "logout_test@startup.io", "password": "Password123!"},
    )
    token = login_res.json()["data"]["access_token"]
    payload = decode_token(token)
    jti = payload["jti"]

    # 2. Token works initially
    pre_logout_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert pre_logout_res.status_code == 200

    # 3. Call Logout (persists revocation to DB)
    logout_res = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_res.status_code == 200

    # 4. Verify in DB that is_revoked is True
    db_session = db.execute(
        select(UserSession).where(UserSession.token_jti == jti)
    ).scalar_one_or_none()
    assert db_session is not None
    assert db_session.is_revoked is True
    assert db_session.revoked_at is not None

    # 5. Immediate rejection of the revoked token on subsequent requests (Persistent Revocation)
    post_logout_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert post_logout_res.status_code == 401
    assert "revoked" in post_logout_res.json()["error"]["message"].lower()


def test_token_rotation_and_revocation_on_refresh(client: TestClient, db: Session):
    # 1. Register and Login
    client.post(
        "/api/v1/auth/register",
        json={"email": "refresh_test@startup.io", "password": "Password123!", "full_name": "Refresh User"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "refresh_test@startup.io", "password": "Password123!"},
    )
    old_refresh_token = login_res.json()["data"]["refresh_token"]
    old_payload = decode_token(old_refresh_token)
    old_jti = old_payload["jti"]

    # 2. Refresh token
    refresh_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert refresh_res.status_code == 200
    new_data = refresh_res.json()["data"]
    new_access_token = new_data["access_token"]
    new_refresh_token = new_data["refresh_token"]

    # 3. Check old session is now marked is_revoked = True in DB
    old_session = db.execute(
        select(UserSession).where(UserSession.token_jti == old_jti)
    ).scalar_one_or_none()
    assert old_session is not None
    assert old_session.is_revoked is True

    # 4. Check new session exists and works
    new_payload = decode_token(new_access_token)
    new_jti = new_payload["jti"]
    assert new_jti != old_jti

    check_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_access_token}"},
    )
    assert check_res.status_code == 200

    # 5. Reusing the old refresh token MUST fail
    reuse_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert reuse_res.status_code == 401


def test_logout_all_sessions(client: TestClient, db: Session):
    # 1. Register
    client.post(
        "/api/v1/auth/register",
        json={"email": "multi_session@startup.io", "password": "Password123!", "full_name": "Multi User"},
    )

    # 2. Login twice to create two sessions (e.g. desktop and mobile)
    login1 = client.post(
        "/api/v1/auth/login",
        json={"email": "multi_session@startup.io", "password": "Password123!"},
    )
    token1 = login1.json()["data"]["access_token"]

    login2 = client.post(
        "/api/v1/auth/login",
        json={"email": "multi_session@startup.io", "password": "Password123!"},
    )
    token2 = login2.json()["data"]["access_token"]

    # Both tokens work
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token1}"}).status_code == 200
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token2}"}).status_code == 200

    # 3. Call logout-all with token1
    logout_all_res = client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert logout_all_res.status_code == 200
    assert logout_all_res.json()["data"]["revoked_count"] >= 2

    # 4. Both tokens are now persistently revoked in DB and rejected
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token1}"}).status_code == 401
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token2}"}).status_code == 401
