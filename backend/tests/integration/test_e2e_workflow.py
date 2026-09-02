import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_full_e2e_core_management_workflow(client: TestClient):
    """
    Simulates the full manual user journey:
    Register -> Login -> Create Workspace -> Invite Member -> Create Project ->
    Assign Project Member -> Create Task -> Move through Kanban -> Add Comment ->
    Verify Activity History -> Cross-Tenant Verification
    """
    # 1. Register & Login Founder
    founder_token = create_user_and_login(client, "founder_e2e@startup.io", "Sarah Founder")
    founder_headers = {"Authorization": f"Bearer {founder_token}"}

    # Register Member
    member_token = create_user_and_login(client, "dev_e2e@startup.io", "Dave Developer")
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # Register Outsider
    outsider_token = create_user_and_login(client, "outsider_e2e@competitor.com", "Eve Outsider")
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    # 2. Create Workspace
    ws_res = client.post(
        "/api/v1/workspaces",
        headers=founder_headers,
        json={"name": "NeuralStream AI", "industry": "AI / ML", "currency": "USD"},
    )
    assert ws_res.status_code == 201
    workspace_id = ws_res.json()["data"]["id"]

    # 3. Add Team Member with MANAGER role
    invite_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=founder_headers,
        json={"email": "dev_e2e@startup.io", "role": "MANAGER"},
    )
    assert invite_res.status_code == 201
    dev_user_id = invite_res.json()["data"]["user_id"]

    # 4. Create Project by Dev Member
    proj_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        headers=member_headers,  # MANAGER creates project and becomes automatic LEAD
        json={
            "name": "LLM Inference Pipeline",
            "description": "Sub-50ms latency streaming pipeline",
            "status": "PLANNING",
            "priority": "URGENT",
            "budget": 75000.0,
        },
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["data"]["id"]

    # 5. Founder assigns themselves as ADVISOR on the project
    founder_id = client.get("/api/v1/auth/me", headers=founder_headers).json()["data"]["id"]
    assign_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects/{project_id}/members",
        headers=founder_headers,
        json={"user_id": founder_id, "role": "ADVISOR"},
    )
    assert assign_res.status_code == 201
    assert assign_res.json()["data"]["role"] == "ADVISOR"

    # 6. Create Task
    task_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks",
        headers=member_headers,
        json={
            "project_id": project_id,
            "title": "Build speculative decoding engine",
            "description": "Implement speculative sampling with draft model",
            "status": "TODO",
            "priority": "URGENT",
            "assignee_id": dev_user_id,
            "estimated_hours": 16.0,
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["data"]["id"]

    # 7. Move Task through Kanban: TODO -> IN_PROGRESS -> REVIEW -> DONE
    for next_st in ["IN_PROGRESS", "REVIEW", "DONE"]:
        st_res = client.patch(
            f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/status",
            headers=member_headers,
            json={"status": next_st},
        )
        assert st_res.status_code == 200
        assert st_res.json()["data"]["status"] == next_st

    # 8. Add Comment
    comment_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/comments",
        headers=founder_headers,
        json={"content": "Great benchmark numbers! Ready for production roll-out."},
    )
    assert comment_res.status_code == 201

    # 9. Verify Activity History Log
    hist_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/history",
        headers=member_headers,
    )
    assert hist_res.status_code == 200
    events = [h["action"] for h in hist_res.json()["data"]]
    assert "TASK_CREATED" in events
    assert "STATUS_CHANGED" in events
    assert "COMMENT_ADDED" in events

    # 10. Verify Isolation: Outsider requests MUST fail
    # Attempt to read workspace
    assert client.get(f"/api/v1/workspaces/{workspace_id}", headers=outsider_headers).status_code == 404
    # Attempt to read project
    assert client.get(f"/api/v1/workspaces/{workspace_id}/projects/{project_id}", headers=outsider_headers).status_code == 404
    # Attempt to update task
    assert client.patch(f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}", headers=outsider_headers, json={"title": "Hacked"}).status_code == 404
