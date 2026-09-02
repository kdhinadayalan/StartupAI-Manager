import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_task_lifecycle_kanban_and_history(client: TestClient):
    owner_token = create_user_and_login(client, "task_owner@startup.io", "Task Owner")
    member_token = create_user_and_login(client, "task_member@startup.io", "Task Member")

    owner_header = {"Authorization": f"Bearer {owner_token}"}
    member_header = {"Authorization": f"Bearer {member_token}"}

    # 1. Setup workspace and project
    ws_res = client.post("/api/v1/workspaces", headers=owner_header, json={"name": "SaaS Platform"})
    workspace_id = ws_res.json()["data"]["id"]

    client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=owner_header,
        json={"email": "task_member@startup.io", "role": "TEAM_MEMBER"},
    )
    members_res = client.get(f"/api/v1/workspaces/{workspace_id}/members", headers=owner_header)
    member_user_id = [m["user_id"] for m in members_res.json()["data"] if m["user"]["email"] == "task_member@startup.io"][0]

    proj_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        headers=owner_header,
        json={"name": "Auth Overhaul"},
    )
    project_id = proj_res.json()["data"]["id"]

    # 2. Create Task
    task_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks",
        headers=owner_header,
        json={
            "project_id": project_id,
            "title": "Implement WebAuthn",
            "description": "Add biometric passkey authentication",
            "status": "TODO",
            "priority": "HIGH",
            "assignee_id": member_user_id,
        },
    )
    assert task_res.status_code == 201
    task = task_res.json()["data"]
    task_id = task["id"]
    assert task["status"] == "TODO"
    assert task["priority"] == "HIGH"

    # 3. Kanban Status Transitions: TODO -> IN_PROGRESS -> REVIEW -> DONE
    for next_status in ["IN_PROGRESS", "REVIEW", "DONE"]:
        status_res = client.patch(
            f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/status",
            headers=member_header,
            json={"status": next_status},
        )
        assert status_res.status_code == 200
        assert status_res.json()["data"]["status"] == next_status

    # 4. Reject invalid status string
    bad_status_res = client.patch(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/status",
        headers=member_header,
        json={"status": "INVALID_STATUS_STRING"},
    )
    assert bad_status_res.status_code == 422

    # 5. Add Comments & XSS Sanitization Check
    malicious_payload = "<script>alert('xss');</script><b>Test comment</b>"
    comment_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/comments",
        headers=member_header,
        json={"content": malicious_payload},
    )
    assert comment_res.status_code == 201
    stored_comment = comment_res.json()["data"]["content"]
    assert "<script>" not in stored_comment
    assert "&lt;script&gt;" in stored_comment

    # 6. Verify Task History is Immutable and Recorded
    history_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/history",
        headers=owner_header,
    )
    assert history_res.status_code == 200
    history_entries = history_res.json()["data"]
    actions = [h["action"] for h in history_entries]

    assert "TASK_CREATED" in actions
    assert "STATUS_CHANGED" in actions
    assert "COMMENT_ADDED" in actions
