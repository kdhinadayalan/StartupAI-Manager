import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_dashboard_summary_and_tenant_isolation(client: TestClient):
    # 1. Setup Founder & Workspace
    founder_token = create_user_and_login(client, "dash_founder@startup.io", "Dash Founder")
    auth_header = {"Authorization": f"Bearer {founder_token}"}

    ws_res = client.post(
        "/api/v1/workspaces",
        headers=auth_header,
        json={"name": "Apex AI", "industry": "Enterprise SaaS"},
    )
    assert ws_res.status_code == 201
    workspace_id = ws_res.json()["data"]["id"]

    # 2. Setup financial treasury & expense
    client.post(
        f"/api/v1/workspaces/{workspace_id}/finance/account",
        headers=auth_header,
        json={"balance": 50000.0, "currency": "USD"},
    )
    client.post(
        f"/api/v1/workspaces/{workspace_id}/finance/expenses",
        headers=auth_header,
        json={"title": "Cloud Servers", "amount": 5000.0, "category": "INFRASTRUCTURE"},
    )

    # 3. Request Dashboard Summary
    dash_res = client.get(f"/api/v1/workspaces/{workspace_id}/dashboard/summary", headers=auth_header)
    assert dash_res.status_code == 200
    data = dash_res.json()["data"]

    # Verify Health Score structure
    assert "health" in data
    assert 0 <= data["health"]["health_score"] <= 100
    assert data["health"]["grade"] in ["EXCELLENT", "HEALTHY", "CAUTION", "CRITICAL"]
    assert "breakdown" in data["health"]
    assert data["health"]["breakdown"]["delivery_weight"] == 0.40
    assert data["health"]["breakdown"]["runway_weight"] == 0.35
    assert data["health"]["breakdown"]["risk_weight"] == 0.25

    # Verify Domain Summaries
    assert data["finance"]["monthly_burn_rate"] == 5000.0
    assert data["finance"]["runway_months"] == 10.0
    assert data["finance"]["current_cash_balance"] == 50000.0
    assert "marketing" in data
    assert "risks" in data
    assert "research" in data
    assert "delivery" in data

    # 4. Anti-IDOR Tenant Isolation: Other user in Workspace B cannot access Workspace A dashboard
    attacker_token = create_user_and_login(client, "attacker_dash@startup.io", "Attacker")
    attacker_header = {"Authorization": f"Bearer {attacker_token}"}

    idor_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/dashboard/summary",
        headers=attacker_header,
    )
    # Anti-IDOR returns 404 to avoid tenant enumeration
    assert idor_res.status_code == 404


def test_notification_automated_triggers_and_api_lifecycle(client: TestClient):
    founder_token = create_user_and_login(client, "notif_lead@startup.io", "Notif Lead")
    auth_header = {"Authorization": f"Bearer {founder_token}"}

    ws_res = client.post(
        "/api/v1/workspaces",
        headers=auth_header,
        json={"name": "Pulse Tech", "industry": "FinTech"},
    )
    workspace_id = ws_res.json()["data"]["id"]

    # Set budget for OPERATIONS ($1,000)
    client.post(
        f"/api/v1/workspaces/{workspace_id}/finance/budgets",
        headers=auth_header,
        json={"category": "OPERATIONS", "amount": 1000.0},
    )

    # 1. Trigger Budget Overrun by recording $1,500 expense
    client.post(
        f"/api/v1/workspaces/{workspace_id}/finance/expenses",
        headers=auth_header,
        json={"title": "Office Supplies", "amount": 1500.0, "category": "OPERATIONS"},
    )

    # Check unread notifications count
    count_res = client.get(f"/api/v1/workspaces/{workspace_id}/notifications/unread-count", headers=auth_header)
    assert count_res.status_code == 200
    assert count_res.json()["data"]["unread_count"] >= 1

    # List notifications
    list_res = client.get(f"/api/v1/workspaces/{workspace_id}/notifications", headers=auth_header)
    assert list_res.status_code == 200
    notifs = list_res.json()["data"]
    assert any(n["type"] == "BUDGET_OVERRUN" for n in notifs)
    overrun_notif = next(n for n in notifs if n["type"] == "BUDGET_OVERRUN")

    # Mark single notification as read
    mark_res = client.patch(
        f"/api/v1/workspaces/{workspace_id}/notifications/{overrun_notif['id']}/read",
        headers=auth_header,
    )
    assert mark_res.status_code == 200
    assert mark_res.json()["data"]["is_read"] is True

    # 2. Trigger AI Approval Notification via AI chat
    client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        headers=auth_header,
        json={"name": "Pulse Core", "priority": "HIGH"},
    )
    ai_query = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/chat",
        headers=auth_header,
        json={"message": "Please create task Setup LoRA training pipeline with high priority."},
    )
    assert ai_query.status_code == 200

    # Verify AI_APPROVAL_PENDING notification exists
    list_res2 = client.get(f"/api/v1/workspaces/{workspace_id}/notifications", headers=auth_header)
    notifs2 = list_res2.json()["data"]
    assert any(n["type"] == "AI_APPROVAL_PENDING" for n in notifs2)

    # Mark all read
    read_all_res = client.post(f"/api/v1/workspaces/{workspace_id}/notifications/read-all", headers=auth_header)
    assert read_all_res.status_code == 200
    assert read_all_res.json()["data"]["marked_count"] >= 1

    # Verify zero unread
    final_count = client.get(f"/api/v1/workspaces/{workspace_id}/notifications/unread-count", headers=auth_header)
    assert final_count.json()["data"]["unread_count"] == 0


def test_ai_monitoring_telemetry_and_rbac(client: TestClient):
    founder_token = create_user_and_login(client, "telemetry_boss@startup.io", "Boss")
    auth_header = {"Authorization": f"Bearer {founder_token}"}

    ws_res = client.post(
        "/api/v1/workspaces",
        headers=auth_header,
        json={"name": "AI Telemetry Corp", "industry": "AI/ML"},
    )
    workspace_id = ws_res.json()["data"]["id"]

    # Run AI conversation to generate telemetry
    client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/chat",
        headers=auth_header,
        json={"message": "Analyze startup burn rate and projects"},
    )

    # Fetch AI Monitoring Telemetry
    mon_res = client.get(f"/api/v1/workspaces/{workspace_id}/ai/monitoring?days=7", headers=auth_header)
    assert mon_res.status_code == 200
    telemetry = mon_res.json()["data"]

    assert telemetry["total_runs"] >= 1
    assert telemetry["total_tokens"] > 0
    assert telemetry["avg_execution_time_ms"] >= 0
    assert "latency" in telemetry
    assert "status_distribution" in telemetry
    assert "tool_usage" in telemetry
    assert "recent_executions" in telemetry

    # Invite a VIEWER
    viewer_token = create_user_and_login(client, "viewer_telemetry@startup.io", "Viewer User")
    # Invite viewer
    client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=auth_header,
        json={"email": "viewer_telemetry@startup.io", "role": "VIEWER"},
    )

    viewer_header = {"Authorization": f"Bearer {viewer_token}"}

    # RBAC Test: VIEWER does not have AI_MONITORING_READ -> 403 Forbidden
    forbidden_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/ai/monitoring",
        headers=viewer_header,
    )
    assert forbidden_res.status_code == 403
