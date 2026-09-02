import pytest
from fastapi.testclient import TestClient


def create_user_and_login(client: TestClient, email: str, name: str = "Test User") -> str:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": name},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    return login_res.json()["data"]["access_token"]


def test_create_and_list_workspaces(client: TestClient):
    token = create_user_and_login(client, "founder@acme.com", "Acme Founder")
    auth_header = {"Authorization": f"Bearer {token}"}

    # Create workspace
    create_res = client.post(
        "/api/v1/workspaces",
        headers=auth_header,
        json={"name": "Acme AI", "description": "Next Gen AI", "industry": "Technology"},
    )
    assert create_res.status_code == 201
    workspace = create_res.json()["data"]
    assert workspace["name"] == "Acme AI"
    workspace_id = workspace["id"]

    # List workspaces
    list_res = client.get("/api/v1/workspaces", headers=auth_header)
    assert list_res.status_code == 200
    workspaces = list_res.json()["data"]
    assert len(workspaces) == 1
    assert workspaces[0]["id"] == workspace_id

    # View workspace detail
    get_res = client.get(f"/api/v1/workspaces/{workspace_id}", headers=auth_header)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["name"] == "Acme AI"


def test_workspace_member_invitation_and_roles(client: TestClient):
    owner_token = create_user_and_login(client, "owner@startup.io", "Owner User")
    member_token = create_user_and_login(client, "employee@startup.io", "Employee User")

    owner_header = {"Authorization": f"Bearer {owner_token}"}
    member_header = {"Authorization": f"Bearer {member_token}"}

    # Owner creates workspace
    ws_res = client.post(
        "/api/v1/workspaces",
        headers=owner_header,
        json={"name": "Startup Inc"},
    )
    workspace_id = ws_res.json()["data"]["id"]

    # Invite employee as VIEWER
    invite_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=owner_header,
        json={"email": "employee@startup.io", "role": "VIEWER"},
    )
    assert invite_res.status_code == 201
    member_record = invite_res.json()["data"]
    assert member_record["role"] == "VIEWER"

    # Employee can now view workspace
    view_res = client.get(f"/api/v1/workspaces/{workspace_id}", headers=member_header)
    assert view_res.status_code == 200

    # Employee as VIEWER cannot invite other users (RBAC check)
    fail_invite = client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=member_header,
        json={"email": "hacker@evil.com", "role": "ADMIN"},
    )
    assert fail_invite.status_code == 403

    # Owner promotes employee to MANAGER
    update_role_res = client.patch(
        f"/api/v1/workspaces/{workspace_id}/members/{member_record['id']}",
        headers=owner_header,
        json={"role": "MANAGER"},
    )
    assert update_role_res.status_code == 200
    assert update_role_res.json()["data"]["role"] == "MANAGER"


def test_cannot_demote_sole_owner(client: TestClient):
    token = create_user_and_login(client, "soleowner@startup.io", "Sole Owner")
    auth_header = {"Authorization": f"Bearer {token}"}

    ws_res = client.post(
        "/api/v1/workspaces",
        headers=auth_header,
        json={"name": "Solo Startup"},
    )
    workspace_id = ws_res.json()["data"]["id"]

    members_res = client.get(f"/api/v1/workspaces/{workspace_id}/members", headers=auth_header)
    owner_member_id = members_res.json()["data"][0]["id"]

    # Attempt to demote sole owner to TEAM_MEMBER
    demote_res = client.patch(
        f"/api/v1/workspaces/{workspace_id}/members/{owner_member_id}",
        headers=auth_header,
        json={"role": "TEAM_MEMBER"},
    )
    assert demote_res.status_code == 400
    assert "sole workspace owner" in demote_res.json()["error"]["message"]
