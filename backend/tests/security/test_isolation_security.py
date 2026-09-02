import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_cross_tenant_idor_isolation(client: TestClient):
    # Setup Tenant A
    user_a_token = create_user_and_login(client, "user_a@tenant-a.com", "Tenant A Owner")
    header_a = {"Authorization": f"Bearer {user_a_token}"}

    ws_a_res = client.post("/api/v1/workspaces", headers=header_a, json={"name": "Workspace Alpha"})
    ws_a_id = ws_a_res.json()["data"]["id"]

    proj_a_res = client.post(
        f"/api/v1/workspaces/{ws_a_id}/projects",
        headers=header_a,
        json={"name": "Secret Project Alpha"},
    )
    proj_a_id = proj_a_res.json()["data"]["id"]

    task_a_res = client.post(
        f"/api/v1/workspaces/{ws_a_id}/tasks",
        headers=header_a,
        json={"project_id": proj_a_id, "title": "Confidential Alpha Task"},
    )
    task_a_id = task_a_res.json()["data"]["id"]

    # Setup Tenant B
    user_b_token = create_user_and_login(client, "user_b@tenant-b.com", "Tenant B Owner")
    header_b = {"Authorization": f"Bearer {user_b_token}"}

    ws_b_res = client.post("/api/v1/workspaces", headers=header_b, json={"name": "Workspace Beta"})
    ws_b_id = ws_b_res.json()["data"]["id"]

    # ATTACK SCENARIO 1: User B attempts to access Workspace A directly
    res1 = client.get(f"/api/v1/workspaces/{ws_a_id}", headers=header_b)
    assert res1.status_code == 404
    assert "not found" in res1.json()["error"]["message"].lower()

    # ATTACK SCENARIO 2: User B attempts to read Project A from Workspace A
    res2 = client.get(f"/api/v1/workspaces/{ws_a_id}/projects/{proj_a_id}", headers=header_b)
    assert res2.status_code == 404

    # ATTACK SCENARIO 3: User B attempts to pass Workspace B in URL with Project A's ID
    res3 = client.get(f"/api/v1/workspaces/{ws_b_id}/projects/{proj_a_id}", headers=header_b)
    assert res3.status_code == 404

    # ATTACK SCENARIO 4: User B attempts to modify Task A
    res4 = client.patch(
        f"/api/v1/workspaces/{ws_a_id}/tasks/{task_a_id}",
        headers=header_b,
        json={"title": "Hacked Task Title"},
    )
    assert res4.status_code == 404

    # ATTACK SCENARIO 5: User B attempts to delete Task A
    res5 = client.delete(f"/api/v1/workspaces/{ws_a_id}/tasks/{task_a_id}", headers=header_b)
    assert res5.status_code == 404

    # ATTACK SCENARIO 6: User B attempts to post comment on Task A
    res6 = client.post(
        f"/api/v1/workspaces/{ws_a_id}/tasks/{task_a_id}/comments",
        headers=header_b,
        json={"content": "Unauthorized comment"},
    )
    assert res6.status_code == 404


def test_privilege_escalation_prevention(client: TestClient):
    owner_token = create_user_and_login(client, "admin_owner@company.com", "Admin Owner")
    viewer_token = create_user_and_login(client, "viewer@company.com", "Viewer User")

    owner_header = {"Authorization": f"Bearer {owner_token}"}
    viewer_header = {"Authorization": f"Bearer {viewer_token}"}

    # Setup Workspace with Owner
    ws_res = client.post("/api/v1/workspaces", headers=owner_header, json={"name": "Company Corp"})
    workspace_id = ws_res.json()["data"]["id"]

    # Invite user as VIEWER
    client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=owner_header,
        json={"email": "viewer@company.com", "role": "VIEWER"},
    )

    # 1. VIEWER cannot create projects
    res1 = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        headers=viewer_header,
        json={"name": "Viewer Unauthorized Project"},
    )
    assert res1.status_code == 403

    # 2. VIEWER cannot delete workspace
    res2 = client.delete(f"/api/v1/workspaces/{workspace_id}", headers=viewer_header)
    assert res2.status_code == 403

    # 3. VIEWER cannot invite other users
    res3 = client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=viewer_header,
        json={"email": "newbie@company.com", "role": "ADMIN"},
    )
    assert res3.status_code == 403
