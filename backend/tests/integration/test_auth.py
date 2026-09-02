import pytest
from fastapi.testclient import TestClient


def test_register_user_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "alice@startup.io",
            "password": "Password123!",
            "full_name": "Alice Founder",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == "alice@startup.io"
    assert data["data"]["full_name"] == "Alice Founder"
    assert "password" not in data["data"]
    assert "hashed_password" not in data["data"]


def test_register_duplicate_email_fails(client: TestClient):
    payload = {
        "email": "duplicate@startup.io",
        "password": "Password123!",
        "full_name": "Duplicate User",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["error"]["message"]


def test_register_short_password_fails(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "short@startup.io",
            "password": "short",
            "full_name": "Short Pwd",
        },
    )
    assert response.status_code == 422


def test_login_success(client: TestClient):
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "bob@startup.io",
            "password": "SecurePassword123!",
            "full_name": "Bob Builder",
        },
    )

    # Login
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "bob@startup.io",
            "password": "SecurePassword123!",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]
    assert data["data"]["user"]["email"] == "bob@startup.io"


def test_login_wrong_password_fails(client: TestClient):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "charlie@startup.io",
            "password": "CorrectPassword123!",
            "full_name": "Charlie",
        },
    )

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "charlie@startup.io",
            "password": "WrongPassword999!",
        },
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["error"]["message"]


def test_get_current_user_profile(client: TestClient):
    # Register and login
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "dana@startup.io",
            "password": "StrongPassword123!",
            "full_name": "Dana Developer",
        },
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "dana@startup.io", "password": "StrongPassword123!"},
    )
    token = login_res.json()["data"]["access_token"]

    # Access protected /me endpoint
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["email"] == "dana@startup.io"


def test_unauthenticated_request_fails(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_password_change_flow(client: TestClient):
    email = "eve@startup.io"
    old_pw = "OldPassword123!"
    new_pw = "NewSecurePassword456!"

    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": old_pw, "full_name": "Eve Engineer"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": old_pw},
    )
    token = login_res.json()["data"]["access_token"]

    # Change password
    change_res = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": old_pw, "new_password": new_pw},
    )
    assert change_res.status_code == 200

    # Old password should no longer work
    fail_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": old_pw},
    )
    assert fail_res.status_code == 401

    # New password works
    success_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": new_pw},
    )
    assert success_res.status_code == 200
