import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_complete_platform_e2e_all_10_journeys(client: TestClient):
    """
    Executes the comprehensive 10-journey end-to-end verification of StartupAI Manager:
    Journey 1: Registration
    Journey 2: Login & Token Management
    Journey 3: Workspace & RBAC
    Journey 4: Project, Task Kanban & Comments
    Journey 5: AI Chat & Agent Routing
    Journey 6: Specialized Domain Agents (Finance, Marketing, Research, Risk)
    Journey 7: Human-in-the-Loop Approval Workflow
    Journey 8: Executive Command Center & Health Score
    Journey 9: In-App User Notifications
    Journey 10: Logout & Persistent Revocation
    """
    # -------------------------------------------------------------------------
    # Journey 1 — Registration
    # -------------------------------------------------------------------------
    reg_payload = {
        "email": "ceo_production@quantumai.com",
        "password": "SecurePassword2026!",
        "full_name": "Elena Rostova",
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    user_id = reg_res.json()["data"]["id"]
    assert reg_res.json()["data"]["email"] == "ceo_production@quantumai.com"

    # Verify duplicate email is safely rejected
    dup_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code == 400

    # -------------------------------------------------------------------------
    # Journey 2 — Login & Session Creation
    # -------------------------------------------------------------------------
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "ceo_production@quantumai.com", "password": "SecurePassword2026!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()["data"]
    access_token = token_data["access_token"]
    refresh_token = token_data["refresh_token"]
    auth_headers = {"Authorization": f"Bearer {access_token}"}

    # Verify profile access
    me_res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert me_res.status_code == 200
    assert me_res.json()["data"]["id"] == user_id

    # -------------------------------------------------------------------------
    # Journey 3 — Workspace & RBAC
    # -------------------------------------------------------------------------
    ws_res = client.post(
        "/api/v1/workspaces",
        headers=auth_headers,
        json={"name": "QuantumAI Corp", "industry": "Quantum Computing", "currency": "USD"},
    )
    assert ws_res.status_code == 201
    workspace_id = ws_res.json()["data"]["id"]

    # Register a second team member
    cto_token = create_user_and_login(client, "cto@quantumai.com", "Marcus Vance")
    cto_headers = {"Authorization": f"Bearer {cto_token}"}

    # Invite CTO as MANAGER
    invite_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=auth_headers,
        json={"email": "cto@quantumai.com", "role": "MANAGER"},
    )
    assert invite_res.status_code == 201
    cto_user_id = invite_res.json()["data"]["user_id"]

    # -------------------------------------------------------------------------
    # Journey 4 — Project, Tasks, Kanban & Activity
    # -------------------------------------------------------------------------
    proj_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        headers=cto_headers,
        json={
            "name": "Q-Core Simulator",
            "description": "Fault-tolerant quantum circuit emulator",
            "status": "ACTIVE",
            "priority": "HIGH",
            "budget": 120000.0,
        },
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["data"]["id"]

    # Create Task
    task_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks",
        headers=cto_headers,
        json={
            "project_id": project_id,
            "title": "Implement Noise Threshold Modeling",
            "status": "TODO",
            "priority": "HIGH",
            "assignee_id": cto_user_id,
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["data"]["id"]

    # Transition Kanban Status: TODO -> IN_PROGRESS -> DONE
    move_res = client.patch(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/status",
        headers=cto_headers,
        json={"status": "DONE"},
    )
    assert move_res.status_code == 200
    assert move_res.json()["data"]["status"] == "DONE"

    # Add Comment
    comment_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/comments",
        headers=auth_headers,
        json={"content": "Verified noise threshold against experimental benchmark."},
    )
    assert comment_res.status_code == 201

    # Verify Activity History
    history_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/history",
        headers=auth_headers,
    )
    assert history_res.status_code == 200
    history_actions = [h["action"] for h in history_res.json()["data"]]
    assert "TASK_CREATED" in history_actions
    assert "STATUS_CHANGED" in history_actions
    assert "COMMENT_ADDED" in history_actions

    # -------------------------------------------------------------------------
    # Journey 5 — AI Chat & Agent Routing
    # -------------------------------------------------------------------------
    ai_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/chat",
        headers=auth_headers,
        json={"message": "Please list our active projects and summary"},
    )
    assert ai_res.status_code == 200
    assert ai_res.json()["data"]["response"] is not None

    # -------------------------------------------------------------------------
    # Journey 6 — Specialized Domain Agents
    # -------------------------------------------------------------------------
    # 1. Finance: Treasury cash balance and expense
    acc_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/finance/account",
        headers=auth_headers,
        json={"balance": 350000.0, "currency": "USD"},
    )
    assert acc_res.status_code == 200

    exp_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/finance/expenses",
        headers=auth_headers,
        json={"title": "Cloud Quantum Cluster Rental", "amount": 25000.0, "category": "R&D"},
    )
    assert exp_res.status_code == 201

    fin_analysis = client.get(
        f"/api/v1/workspaces/{workspace_id}/finance/runway",
        headers=auth_headers,
    )
    assert fin_analysis.status_code == 200
    assert fin_analysis.json()["data"]["runway_months"] is not None

    # 2. Marketing: Campaign
    mkt_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/marketing/campaigns",
        headers=auth_headers,
        json={"name": "Q-Core Alpha Developer Launch", "channel": "SOCIAL_MEDIA", "budget": 5000.0},
    )
    assert mkt_res.status_code == 201

    # 3. Research: Item
    res_item = client.post(
        f"/api/v1/workspaces/{workspace_id}/research/items",
        headers=auth_headers,
        json={"title": "State of Quantum Error Correction 2026", "topic": "INDUSTRY_TRENDS", "content": "Surface codes demonstrating threshold scaling."},
    )
    assert res_item.status_code == 201

    # 4. Risk: Item with deterministic calculation
    risk_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/risks",
        headers=auth_headers,
        json={"title": "Cryogenic Helium Supply Constraint", "likelihood": 4, "impact": 4, "category": "OPERATIONAL"},
    )
    assert risk_res.status_code == 201
    assert risk_res.json()["data"]["risk_score"] == 16
    assert risk_res.json()["data"]["severity"] == "HIGH"

    # -------------------------------------------------------------------------
    # Journey 7 — Human-in-the-Loop AI Approval Workflow
    # -------------------------------------------------------------------------
    # Stage an AI approval action
    staged_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/chat",
        headers=auth_headers,
        json={"message": "I want to delete project Q-Core Simulator"},
    )
    assert staged_res.status_code == 200

    # List pending approvals
    approvals_res = client.get(f"/api/v1/workspaces/{workspace_id}/ai/approvals", headers=auth_headers)
    assert approvals_res.status_code == 200

    # -------------------------------------------------------------------------
    # Journey 8 — Executive Command Center Dashboard
    # -------------------------------------------------------------------------
    dash_res = client.get(f"/api/v1/workspaces/{workspace_id}/dashboard/summary", headers=auth_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()["data"]
    assert "health" in dash_data
    assert dash_data["health"]["health_score"] is not None
    assert dash_data["health"]["grade"] is not None
    assert dash_data["delivery"] is not None
    assert dash_data["finance"] is not None
    assert dash_data["risks"] is not None

    # -------------------------------------------------------------------------
    # Journey 9 — In-App Notifications
    # -------------------------------------------------------------------------
    notifs_res = client.get(f"/api/v1/workspaces/{workspace_id}/notifications", headers=auth_headers)
    assert notifs_res.status_code == 200
    unread_res = client.get(f"/api/v1/workspaces/{workspace_id}/notifications/unread-count", headers=auth_headers)
    assert unread_res.status_code == 200

    # Mark all read
    mark_res = client.post(f"/api/v1/workspaces/{workspace_id}/notifications/read-all", headers=auth_headers)
    assert mark_res.status_code == 200

    # -------------------------------------------------------------------------
    # Journey 10 — Logout & Persistent Session Revocation
    # -------------------------------------------------------------------------
    logout_res = client.post("/api/v1/auth/logout", headers=auth_headers)
    assert logout_res.status_code == 200

    # Verify that future requests with the revoked access token are rejected
    post_logout_res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert post_logout_res.status_code == 401
    assert "revoked" in post_logout_res.json()["error"]["message"].lower()

    # Verify that refresh token cannot recreate access
    refresh_fail_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_fail_res.status_code == 401
