import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_ai_manager_agent_orchestration_and_approval_workflow(client: TestClient):
    # 1. Setup Founder & Workspace
    founder_token = create_user_and_login(client, "ai_founder@startup.io", "AI Founder")
    viewer_token = create_user_and_login(client, "ai_viewer@startup.io", "AI Viewer")

    founder_header = {"Authorization": f"Bearer {founder_token}"}
    viewer_header = {"Authorization": f"Bearer {viewer_token}"}

    ws_res = client.post(
        "/api/v1/workspaces",
        headers=founder_header,
        json={"name": "Cognitive Labs", "industry": "Artificial Intelligence"},
    )
    assert ws_res.status_code == 201
    workspace_id = ws_res.json()["data"]["id"]

    # Add viewer to workspace
    client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=founder_header,
        json={"email": "ai_viewer@startup.io", "role": "VIEWER"},
    )

    # Create an initial project
    proj_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        headers=founder_header,
        json={"name": "Model Fine-tuning", "priority": "HIGH"},
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["data"]["id"]

    # 2. Query AI Manager Agent (Read-only / Low Risk query)
    chat_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/chat",
        headers=founder_header,
        json={"message": "What is the status of our projects and tasks? Give me a report."},
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()["data"]
    assert chat_data["status"] == "SUCCESS"
    assert chat_data["tool_calls_count"] >= 1
    assert "Plan" in chat_data["plan"] or "Inspect" in chat_data["plan"]
    assert chat_data["tokens_used"] > 0
    conversation_id = chat_data["conversation_id"]

    # 3. Ask AI to perform an action (Create Task -> Medium Risk -> Approval Gate)
    action_chat_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/chat",
        headers=founder_header,
        json={
            "conversation_id": conversation_id,
            "message": "Please create task Setup LoRA training pipeline with high priority.",
        },
    )
    assert action_chat_res.status_code == 200
    action_data = action_chat_res.json()["data"]
    assert action_data["status"] == "AWAITING_APPROVAL"
    assert len(action_data["pending_approvals"]) == 1

    approval_item = action_data["pending_approvals"][0]
    approval_id = approval_item["approval_id"]
    assert approval_item["risk_level"] == "MEDIUM"
    assert approval_item["action"] == "create_task"

    # 4. List pending approvals
    list_appr = client.get(
        f"/api/v1/workspaces/{workspace_id}/ai/approvals?status=PENDING",
        headers=founder_header,
    )
    assert list_appr.status_code == 200
    assert len(list_appr.json()["data"]) == 1
    assert list_appr.json()["data"][0]["id"] == approval_id

    # 5. SECURITY CHECK: VIEWER CANNOT APPROVE (Privilege escalation blocked)
    fail_approve = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/approvals/{approval_id}/approve",
        headers=viewer_header,
    )
    assert fail_approve.status_code == 403

    # 6. Founder approves the staged action -> Task is created!
    approve_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/approvals/{approval_id}/approve",
        headers=founder_header,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["data"]["status"] == "EXECUTED"

    # Verify task exists in project
    tasks_res = client.get(f"/api/v1/workspaces/{workspace_id}/tasks", headers=founder_header)
    assert tasks_res.status_code == 200
    task_titles = [t["title"] for t in tasks_res.json()["data"]]
    assert any("LoRA" in t for t in task_titles)

    # 7. Check AI Monitoring Telemetry endpoint
    telemetry_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/ai/monitoring",
        headers=founder_header,
    )
    assert telemetry_res.status_code == 200
    telemetry = telemetry_res.json()["data"]
    assert telemetry["total_runs"] >= 2
    assert telemetry["total_tokens"] > 0
    assert telemetry["avg_execution_time_ms"] > 0
