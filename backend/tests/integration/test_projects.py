import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_project_crud_and_membership(client: TestClient):
    owner_token = create_user_and_login(client, "project_owner@startup.io", "Project Owner")
    member_token = create_user_and_login(client, "project_member@startup.io", "Project Member")
    outsider_token = create_user_and_login(client, "outsider@other.io", "Outsider")

    owner_header = {"Authorization": f"Bearer {owner_token}"}
    member_header = {"Authorization": f"Bearer {member_token}"}

    # 1. Create Workspace
    ws_res = client.post("/api/v1/workspaces", headers=owner_header, json={"name": "DevOps Startup"})
    workspace_id = ws_res.json()["data"]["id"]

    # 2. Add member to workspace
    client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=owner_header,
        json={"email": "project_member@startup.io", "role": "TEAM_MEMBER"},
    )

    # 3. Create Project
    proj_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        headers=owner_header,
        json={
            "name": "Cloud Infrastructure",
            "description": "Kubernetes migration",
            "status": "PLANNING",
            "priority": "HIGH",
            "budget": 50000.0,
        },
    )
    assert proj_res.status_code == 201
    project = proj_res.json()["data"]
    assert project["name"] == "Cloud Infrastructure"
    project_id = project["id"]

    # 4. Filter projects by status
    list_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/projects?status=PLANNING",
        headers=owner_header,
    )
    assert list_res.status_code == 200
    assert len(list_res.json()["data"]) == 1

    # 5. Search projects
    search_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/projects?search=Kubernetes",
        headers=owner_header,
    )
    assert search_res.status_code == 200
    assert len(search_res.json()["data"]) == 1

    # 6. Assign member to project
    members_res = client.get(f"/api/v1/workspaces/{workspace_id}/members", headers=owner_header)
    member_user_id = [m["user_id"] for m in members_res.json()["data"] if m["user"]["email"] == "project_member@startup.io"][0]

    assign_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects/{project_id}/members",
        headers=owner_header,
        json={"user_id": member_user_id, "role": "DEVELOPER"},
    )
    assert assign_res.status_code == 201

    # 7. CRITICAL SECURITY TEST: Cannot add outsider user (from outside workspace) to project
    outsider_info = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {outsider_token}"}).json()["data"]
    fail_assign = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects/{project_id}/members",
        headers=owner_header,
        json={"user_id": outsider_info["id"], "role": "GUEST"},
    )
    assert fail_assign.status_code == 400
    assert "must belong to the workspace" in fail_assign.json()["error"]["message"]

    # 8. Update project status
    update_res = client.patch(
        f"/api/v1/workspaces/{workspace_id}/projects/{project_id}",
        headers=owner_header,
        json={"status": "ACTIVE"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["data"]["status"] == "ACTIVE"
