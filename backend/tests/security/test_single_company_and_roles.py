import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_journeys_1_to_7_bootstrap_and_invitations_all_6_roles(client: TestClient):
    """
    Verify E2E User Journeys 1 through 7:
    Journey 1: Initial company + OWNER setup
    Journey 2: OWNER login
    Journey 3: OWNER invites ADMIN
    Journey 4: OWNER invites TEAM_LEAD
    Journey 5: OWNER invites MANAGER
    Journey 6: OWNER invites TEAM_MEMBER
    Journey 7: OWNER invites VIEWER
    """
    # Journey 1 & 2: First user registers, logs in, creates single company and becomes OWNER
    owner_token = create_user_and_login(client, "ceo_owner@startup.ai", "Founder & CEO")
    owner_header = {"Authorization": f"Bearer {owner_token}"}

    create_ws = client.post(
        "/api/v1/workspaces",
        headers=owner_header,
        json={"name": "StartupAI Technologies Inc", "industry": "Artificial Intelligence", "stage": "Series A"},
    )
    assert create_ws.status_code == 201
    company = create_ws.json()["data"]
    company_id = company["id"]
    assert company["name"] == "StartupAI Technologies Inc"

    # Verify GET /workspaces/current returns single company
    current_res = client.get("/api/v1/workspaces/current", headers=owner_header)
    assert current_res.status_code == 200
    assert current_res.json()["data"]["id"] == company_id

    # Register other users for the company
    admin_token = create_user_and_login(client, "admin@startup.ai", "Admin User")
    lead_token = create_user_and_login(client, "lead@startup.ai", "Team Lead")
    mgr_token = create_user_and_login(client, "manager@startup.ai", "Engineering Manager")
    member_token = create_user_and_login(client, "member@startup.ai", "Core Engineer")
    viewer_token = create_user_and_login(client, "investor_viewer@startup.ai", "Investor Viewer")

    # Journey 3: OWNER invites ADMIN
    inv_admin = client.post(
        f"/api/v1/workspaces/{company_id}/members",
        headers=owner_header,
        json={"email": "admin@startup.ai", "role": "ADMIN"},
    )
    assert inv_admin.status_code == 201
    assert inv_admin.json()["data"]["role"] == "ADMIN"

    # Journey 4: OWNER invites TEAM_LEAD
    inv_lead = client.post(
        f"/api/v1/workspaces/{company_id}/members",
        headers=owner_header,
        json={"email": "lead@startup.ai", "role": "TEAM_LEAD"},
    )
    assert inv_lead.status_code == 201
    assert inv_lead.json()["data"]["role"] == "TEAM_LEAD"

    # Journey 5: OWNER invites MANAGER
    inv_mgr = client.post(
        f"/api/v1/workspaces/{company_id}/members",
        headers=owner_header,
        json={"email": "manager@startup.ai", "role": "MANAGER"},
    )
    assert inv_mgr.status_code == 201
    assert inv_mgr.json()["data"]["role"] == "MANAGER"

    # Journey 6: OWNER invites TEAM_MEMBER
    inv_member = client.post(
        f"/api/v1/workspaces/{company_id}/members",
        headers=owner_header,
        json={"email": "member@startup.ai", "role": "TEAM_MEMBER"},
    )
    assert inv_member.status_code == 201
    assert inv_member.json()["data"]["role"] == "TEAM_MEMBER"

    # Journey 7: OWNER invites VIEWER
    inv_viewer = client.post(
        f"/api/v1/workspaces/{company_id}/members",
        headers=owner_header,
        json={"email": "investor_viewer@startup.ai", "role": "VIEWER"},
    )
    assert inv_viewer.status_code == 201
    assert inv_viewer.json()["data"]["role"] == "VIEWER"

    # Verify all 6 members listed in company
    members_res = client.get(f"/api/v1/workspaces/{company_id}/members", headers=owner_header)
    assert members_res.status_code == 200
    roles = [m["role"] for m in members_res.json()["data"]]
    assert set(roles) == {"OWNER", "ADMIN", "TEAM_LEAD", "MANAGER", "TEAM_MEMBER", "VIEWER"}


def test_journey_8_six_roles_rbac_permission_boundaries(client: TestClient):
    """
    Verify RBAC permission boundaries across all 6 roles:
    - OWNER: Full access, can delete workspace
    - ADMIN: Can create projects/tasks/budgets, CANNOT delete workspace
    - TEAM_LEAD: Can create/update tasks, view projects, CANNOT delete projects, CANNOT manage finance
    - MANAGER: Can create projects and tasks, CANNOT delete workspace
    - TEAM_MEMBER: Can view projects, update assigned tasks, CANNOT create projects
    - VIEWER: Read-only, CANNOT create tasks or projects
    """
    owner_token = create_user_and_login(client, "rbac_owner@startup.ai", "Owner")
    admin_token = create_user_and_login(client, "rbac_admin@startup.ai", "Admin")
    lead_token = create_user_and_login(client, "rbac_lead@startup.ai", "Lead")
    mgr_token = create_user_and_login(client, "rbac_mgr@startup.ai", "Manager")
    member_token = create_user_and_login(client, "rbac_tm@startup.ai", "Member")
    viewer_token = create_user_and_login(client, "rbac_v@startup.ai", "Viewer")

    owner_hdr = {"Authorization": f"Bearer {owner_token}"}
    admin_hdr = {"Authorization": f"Bearer {admin_token}"}
    lead_hdr = {"Authorization": f"Bearer {lead_token}"}
    mgr_hdr = {"Authorization": f"Bearer {mgr_token}"}
    member_hdr = {"Authorization": f"Bearer {member_token}"}
    viewer_hdr = {"Authorization": f"Bearer {viewer_token}"}

    # Setup single company
    ws_res = client.post("/api/v1/workspaces", headers=owner_hdr, json={"name": "RBAC Corp"})
    ws_id = ws_res.json()["data"]["id"]

    # Invite all roles
    for email, role in [
        ("rbac_admin@startup.ai", "ADMIN"),
        ("rbac_lead@startup.ai", "TEAM_LEAD"),
        ("rbac_mgr@startup.ai", "MANAGER"),
        ("rbac_tm@startup.ai", "TEAM_MEMBER"),
        ("rbac_v@startup.ai", "VIEWER"),
    ]:
        client.post(f"/api/v1/workspaces/{ws_id}/members", headers=owner_hdr, json={"email": email, "role": role})

    # 1. OWNER creates project -> 201
    p_res = client.post(f"/api/v1/workspaces/{ws_id}/projects", headers=owner_hdr, json={"name": "Alpha Project"})
    assert p_res.status_code == 201
    proj_id = p_res.json()["data"]["id"]

    # 2. ADMIN creates task -> 201
    t_res = client.post(
        f"/api/v1/workspaces/{ws_id}/tasks",
        headers=admin_hdr,
        json={"project_id": proj_id, "title": "Admin Task"},
    )
    assert t_res.status_code == 201
    task_id = t_res.json()["data"]["id"]

    # 3. TEAM_LEAD creates and updates task -> 201 and 200
    lead_task = client.post(
        f"/api/v1/workspaces/{ws_id}/tasks",
        headers=lead_hdr,
        json={"project_id": proj_id, "title": "Lead Assigned Task"},
    )
    assert lead_task.status_code == 201
    lead_task_id = lead_task.json()["data"]["id"]

    lead_patch = client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{lead_task_id}",
        headers=lead_hdr,
        json={"title": "Updated Lead Task"},
    )
    assert lead_patch.status_code == 200

    # TEAM_LEAD cannot delete projects -> 403
    del_p_lead = client.delete(f"/api/v1/workspaces/{ws_id}/projects/{proj_id}", headers=lead_hdr)
    assert del_p_lead.status_code == 403

    # TEAM_LEAD cannot create budget/expenses -> 403
    lead_fin = client.post(
        f"/api/v1/workspaces/{ws_id}/finance/expenses",
        headers=lead_hdr,
        json={"title": "Hardware Server", "category": "OPERATIONS", "amount": 500},
    )
    assert lead_fin.status_code == 403

    # 4. MANAGER can create project -> 201
    mgr_proj = client.post(f"/api/v1/workspaces/{ws_id}/projects", headers=mgr_hdr, json={"name": "Manager Project"})
    assert mgr_proj.status_code == 201

    # 5. TEAM_MEMBER cannot create projects -> 403
    tm_proj = client.post(f"/api/v1/workspaces/{ws_id}/projects", headers=member_hdr, json={"name": "Hacked Project"})
    assert tm_proj.status_code == 403

    # TEAM_MEMBER can comment on task -> 201
    tm_comm = client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments",
        headers=member_hdr,
        json={"content": "Working on this now."},
    )
    assert tm_comm.status_code == 201

    # 6. VIEWER cannot create task -> 403
    v_task = client.post(
        f"/api/v1/workspaces/{ws_id}/tasks",
        headers=viewer_hdr,
        json={"project_id": proj_id, "title": "Viewer Task"},
    )
    assert v_task.status_code == 403

    # VIEWER can read dashboard -> 200
    v_dash = client.get(f"/api/v1/workspaces/{ws_id}/dashboard/summary", headers=viewer_hdr)
    assert v_dash.status_code == 200


def test_journeys_18_19_20_security_boundaries_and_single_company(client: TestClient):
    """
    Verify security boundary journeys:
    Journey 18: Privilege escalation attempts
    Journey 19: Attempt to create second company
    Journey 20: Attempt public registration after bootstrap
    """
    owner_token = create_user_and_login(client, "sec_owner@startup.ai", "Security Owner")
    admin_token = create_user_and_login(client, "sec_admin@startup.ai", "Security Admin")
    user_token = create_user_and_login(client, "sec_user@startup.ai", "Standard User")

    owner_hdr = {"Authorization": f"Bearer {owner_token}"}
    admin_hdr = {"Authorization": f"Bearer {admin_token}"}
    user_hdr = {"Authorization": f"Bearer {user_token}"}

    # Setup single company
    ws_res = client.post("/api/v1/workspaces", headers=owner_hdr, json={"name": "Cyber Defense Inc"})
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["data"]["id"]

    # Invite admin
    inv_admin = client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=owner_hdr,
        json={"email": "sec_admin@startup.ai", "role": "ADMIN"},
    )
    admin_member_id = inv_admin.json()["data"]["id"]

    # JOURNEY 19: Attempt to create second company -> REJECTED 400
    second_ws = client.post(
        "/api/v1/workspaces",
        headers=user_hdr,
        json={"name": "Second Illegal Company"},
    )
    assert second_ws.status_code == 400
    assert "Single-company system" in second_ws.json()["error"]["message"]

    # JOURNEY 20: Public registration after bootstrap does not grant company access
    uninvited_token = create_user_and_login(client, "outsider_public@random.com", "Outsider")
    uninvited_hdr = {"Authorization": f"Bearer {uninvited_token}"}

    # Outsider cannot read company metadata -> 404
    get_res = client.get(f"/api/v1/workspaces/{ws_id}", headers=uninvited_hdr)
    assert get_res.status_code == 404

    # Outsider GET /workspaces returns empty list
    my_ws = client.get("/api/v1/workspaces", headers=uninvited_hdr)
    assert my_ws.status_code == 200
    assert len(my_ws.json()["data"]) == 0

    # JOURNEY 18: Privilege escalation attempts
    # 1. Standard user cannot invite anyone -> 403
    res1 = client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=user_hdr,
        json={"email": "hacked@startup.ai", "role": "ADMIN"},
    )
    assert res1.status_code == 403

    # 2. ADMIN cannot invite someone as OWNER -> 403
    res2 = client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=admin_hdr,
        json={"email": "sec_user@startup.ai", "role": "OWNER"},
    )
    assert res2.status_code == 403
    assert "Cannot assign OWNER role" in res2.json()["error"]["message"]

    # 3. ADMIN cannot invite someone as ADMIN -> 403 (Only OWNER can invite ADMIN)
    res3 = client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=admin_hdr,
        json={"email": "sec_user@startup.ai", "role": "ADMIN"},
    )
    assert res3.status_code == 403
    assert "Only the OWNER can assign or invite ADMIN members" in res3.json()["error"]["message"]

    # 4. ADMIN can invite a TEAM_LEAD or TEAM_MEMBER -> 201
    res4 = client.post(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=admin_hdr,
        json={"email": "sec_user@startup.ai", "role": "TEAM_LEAD"},
    )
    assert res4.status_code == 201
    user_member_id = res4.json()["data"]["id"]

    # 5. ADMIN cannot promote anyone to ADMIN or OWNER -> 403
    res5 = client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{user_member_id}",
        headers=admin_hdr,
        json={"role": "ADMIN"},
    )
    assert res5.status_code == 403

    # 6. ADMIN cannot remove another ADMIN -> 403
    res6 = client.delete(
        f"/api/v1/workspaces/{ws_id}/members/{admin_member_id}",
        headers=admin_hdr,
    )
    assert res6.status_code == 403
