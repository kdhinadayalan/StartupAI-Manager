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


def test_owner_can_delete_workspace_and_audit_logged(client: TestClient):
    """Verify that only the workspace OWNER can delete the workspace."""
    owner_token = create_user_and_login(client, "ws_owner_del@test.com", "Workspace Owner")
    auth_header = {"Authorization": f"Bearer {owner_token}"}

    # Create workspace
    create_res = client.post(
        "/api/v1/workspaces",
        headers=auth_header,
        json={"name": "Ephemeral Tech", "industry": "Software"},
    )
    assert create_res.status_code == 201
    workspace_id = create_res.json()["data"]["id"]

    # Delete workspace as owner
    del_res = client.delete(f"/api/v1/workspaces/{workspace_id}", headers=auth_header)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True
    assert "deleted successfully" in del_res.json()["message"]

    # Verify workspace is gone
    get_res = client.get(f"/api/v1/workspaces/{workspace_id}", headers=auth_header)
    assert get_res.status_code == 404


def test_admin_cannot_delete_workspace(client: TestClient):
    """
    Verify that an ADMIN role can manage resources but CANNOT delete a workspace.
    Only the OWNER has Permission.WORKSPACE_DELETE.
    """
    owner_token = create_user_and_login(client, "owner_nodelete@test.com", "Real Owner")
    admin_token = create_user_and_login(client, "admin_nodelete@test.com", "Admin User")

    owner_header = {"Authorization": f"Bearer {owner_token}"}
    admin_header = {"Authorization": f"Bearer {admin_token}"}

    # Owner creates workspace
    ws_res = client.post(
        "/api/v1/workspaces",
        headers=owner_header,
        json={"name": "Protected Corp"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["data"]["id"]

    # Invite admin user with ADMIN role
    inv_res = client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=owner_header,
        json={"email": "admin_nodelete@test.com", "role": "ADMIN"},
    )
    assert inv_res.status_code == 201

    # Admin attempts to delete workspace -> must fail with 403 Forbidden
    del_res = client.delete(f"/api/v1/workspaces/{ws_id}", headers=admin_header)
    assert del_res.status_code == 403
    err_text = del_res.json().get("detail") or del_res.json().get("error", {}).get("message", "")
    assert "Only workspace Owners can delete workspaces" in err_text


def test_manager_team_member_and_viewer_cannot_delete_workspace(client: TestClient):
    """Verify that MANAGER, TEAM_MEMBER, and VIEWER roles are denied workspace deletion."""
    owner_token = create_user_and_login(client, "owner_roles@test.com", "Owner User")
    mgr_token = create_user_and_login(client, "mgr_user@test.com", "Manager User")
    tm_token = create_user_and_login(client, "tm_user@test.com", "Team User")
    viewer_token = create_user_and_login(client, "viewer_user@test.com", "Viewer User")

    owner_header = {"Authorization": f"Bearer {owner_token}"}

    ws_res = client.post(
        "/api/v1/workspaces",
        headers=owner_header,
        json={"name": "Role Test Workspace"},
    )
    ws_id = ws_res.json()["data"]["id"]

    # Invite members with different roles
    client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=owner_header,
        json={"email": "mgr_user@test.com", "role": "MANAGER"},
    )
    client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=owner_header,
        json={"email": "tm_user@test.com", "role": "TEAM_MEMBER"},
    )
    client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=owner_header,
        json={"email": "viewer_user@test.com", "role": "VIEWER"},
    )

    # Manager attempts delete -> 403
    res_mgr = client.delete(f"/api/v1/workspaces/{ws_id}", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res_mgr.status_code == 403

    # Team Member attempts delete -> 403
    res_tm = client.delete(f"/api/v1/workspaces/{ws_id}", headers={"Authorization": f"Bearer {tm_token}"})
    assert res_tm.status_code == 403

    # Viewer attempts delete -> 403
    res_v = client.delete(f"/api/v1/workspaces/{ws_id}", headers={"Authorization": f"Bearer {viewer_token}"})
    assert res_v.status_code == 403


def test_non_member_cannot_delete_workspace(client: TestClient):
    """Verify that an unauthorized non-member receives 404 Anti-Enumeration response."""
    owner_token = create_user_and_login(client, "owner_priv@test.com", "Owner")
    stranger_token = create_user_and_login(client, "stranger@test.com", "Stranger")

    ws_res = client.post(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Private Domain"},
    )
    ws_id = ws_res.json()["data"]["id"]

    # Stranger attempts delete -> 404 (Anti-Enumeration)
    del_res = client.delete(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {stranger_token}"},
    )
    assert del_res.status_code == 404


def test_single_company_enforcement_and_second_creation_rejected(client: TestClient):
    """
    Verify single-company enforcement:
    1. First user registers and initializes the company workspace as OWNER.
    2. Second user attempts to create a second company -> rejected with 400.
    3. Second user is invited as TEAM_MEMBER.
    4. Second user (TEAM_MEMBER) attempts to delete the company -> 403 Forbidden.
    5. OWNER deletes the company -> 200 OK.
    6. After deletion, the company can be re-initialized.
    """
    user_token = create_user_and_login(client, "initial_owner@test.com", "Initial Owner")
    other_token = create_user_and_login(client, "second_user@test.com", "Second User")

    user_header = {"Authorization": f"Bearer {user_token}"}
    other_header = {"Authorization": f"Bearer {other_token}"}

    # User creates single company workspace (is OWNER)
    ws1_res = client.post(
        "/api/v1/workspaces",
        headers=user_header,
        json={"name": "Sole Startup Inc"},
    )
    assert ws1_res.status_code == 201
    ws1_id = ws1_res.json()["data"]["id"]

    # Second user attempts to create a second company -> Rejected with 400
    ws2_res = client.post(
        "/api/v1/workspaces",
        headers=other_header,
        json={"name": "Forbidden Second Company"},
    )
    assert ws2_res.status_code == 400
    assert "Single-company system" in ws2_res.json()["error"]["message"]

    # Owner invites Second User as TEAM_MEMBER
    client.post(
        f"/api/v1/workspaces/{ws1_id}/members",
        headers=user_header,
        json={"email": "second_user@test.com", "role": "TEAM_MEMBER"},
    )

    # Second user tries to delete the company -> Forbidden (403)
    del2_res = client.delete(f"/api/v1/workspaces/{ws1_id}", headers=other_header)
    assert del2_res.status_code == 403

    # Owner deletes the company -> Success (200)
    del1_res = client.delete(f"/api/v1/workspaces/{ws1_id}", headers=user_header)
    assert del1_res.status_code == 200

    # Company is now gone (404)
    ws1_check = client.get(f"/api/v1/workspaces/{ws1_id}", headers=user_header)
    assert ws1_check.status_code == 404

    # Now that the previous company was deleted, a new company can be initialized
    new_ws_res = client.post(
        "/api/v1/workspaces",
        headers=other_header,
        json={"name": "Reborn Startup Inc"},
    )
    assert new_ws_res.status_code == 201
    assert new_ws_res.json()["data"]["name"] == "Reborn Startup Inc"
