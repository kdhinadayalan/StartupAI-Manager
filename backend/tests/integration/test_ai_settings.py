import pytest
from fastapi.testclient import TestClient
from tests.integration.test_workspaces import create_user_and_login


def test_ai_settings_lifecycle_and_rbac(client: TestClient):
    # 1. Setup Owner and Workspace
    owner_token = create_user_and_login(client, "ai_owner@startup.io", "AI Owner")
    viewer_token = create_user_and_login(client, "ai_member_viewer@startup.io", "AI Viewer")

    owner_header = {"Authorization": f"Bearer {owner_token}"}
    viewer_header = {"Authorization": f"Bearer {viewer_token}"}

    ws_res = client.post(
        "/api/v1/workspaces",
        headers=owner_header,
        json={"name": "Neural Dynamics", "industry": "AI & Robotics"},
    )
    assert ws_res.status_code == 201
    workspace_id = ws_res.json()["data"]["id"]

    # Add viewer to workspace
    client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=owner_header,
        json={"email": "ai_member_viewer@startup.io", "role": "VIEWER"},
    )

    # 2. GET Default AI Settings (both Owner and Viewer can read)
    get_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/ai/settings",
        headers=owner_header,
    )
    assert get_res.status_code == 200
    settings = get_res.json()["data"]
    assert settings["provider"] in ["MOCK", "mock"]
    assert settings["masked_api_key"] is None
    assert settings["pii_masking_enabled"] is True

    # Viewer can also read settings
    viewer_get_res = client.get(
        f"/api/v1/workspaces/{workspace_id}/ai/settings",
        headers=viewer_header,
    )
    assert viewer_get_res.status_code == 200

    # 3. RBAC Enforcement: Viewer cannot update settings (403 Forbidden)
    forbidden_update = client.put(
        f"/api/v1/workspaces/{workspace_id}/ai/settings",
        headers=viewer_header,
        json={
            "provider": "OLLAMA",
            "model_name": "llama3:latest",
        },
    )
    assert forbidden_update.status_code == 403

    # 4. RBAC Enforcement: Viewer cannot trigger connection tests (403 Forbidden)
    forbidden_test = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/settings/test-connection",
        headers=viewer_header,
        json={
            "provider": "MOCK",
        },
    )
    assert forbidden_test.status_code == 403

    # 5. Owner updates settings to Local Ollama (Air-Gapped Private)
    update_ollama_res = client.put(
        f"/api/v1/workspaces/{workspace_id}/ai/settings",
        headers=owner_header,
        json={
            "provider": "OLLAMA",
            "model_name": "llama3:8b-instruct",
            "ollama_base_url": "http://localhost:11434",
            "pii_masking_enabled": True,
        },
    )
    assert update_ollama_res.status_code == 200
    ollama_data = update_ollama_res.json()["data"]
    assert ollama_data["provider"] == "OLLAMA"
    assert ollama_data["model_name"] == "llama3:8b-instruct"
    assert ollama_data["ollama_base_url"] == "http://localhost:11434"

    # 6. Owner updates settings with BYOK API key (Gemini) -> Verify Key Masking
    update_cloud_res = client.put(
        f"/api/v1/workspaces/{workspace_id}/ai/settings",
        headers=owner_header,
        json={
            "provider": "GEMINI",
            "model_name": "gemini-1.5-pro",
            "api_key": "AIzaSySecretTestingApiKey1234567890",
            "pii_masking_enabled": True,
        },
    )
    assert update_cloud_res.status_code == 200
    cloud_data = update_cloud_res.json()["data"]
    assert cloud_data["provider"] == "GEMINI"
    assert cloud_data["model_name"] == "gemini-1.5-pro"
    # Never leak plain API key in response
    assert "SecretTestingApiKey" not in cloud_data["masked_api_key"]
    assert cloud_data["masked_api_key"].startswith("AIz")
    assert cloud_data["masked_api_key"].endswith("7890")

    # 7. Test Diagnostic Connection for Mock Provider
    test_mock_res = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/settings/test-connection",
        headers=owner_header,
        json={
            "provider": "MOCK",
            "model_name": "startupai-mock-v1",
        },
    )
    assert test_mock_res.status_code == 200
    test_data = test_mock_res.json()["data"]
    assert test_data["status"] == "connected"
    assert test_data["latency_ms"] >= 0
    assert "Offline Local Mock Engine" in test_data["message"]

    # 8. Owner updates settings to Universal CUSTOM Provider (e.g. DeepSeek or Groq)
    update_custom_res = client.put(
        f"/api/v1/workspaces/{workspace_id}/ai/settings",
        headers=owner_header,
        json={
            "provider": "CUSTOM",
            "model_name": "deepseek-chat",
            "custom_base_url": "https://api.deepseek.com/v1",
            "api_key": "sk-deepseek-custom-test-key-9999",
            "pii_masking_enabled": True,
        },
    )
    assert update_custom_res.status_code == 200
    custom_data = update_custom_res.json()["data"]
    assert custom_data["provider"] == "CUSTOM"
    assert custom_data["model_name"] == "deepseek-chat"
    assert custom_data["custom_base_url"] == "https://api.deepseek.com/v1"
    assert custom_data["masked_api_key"].startswith("sk-")
    assert custom_data["masked_api_key"].endswith("9999")

    # 9. Test Diagnostic Connection for Custom Provider without URL -> Expect clean validation message
    test_custom_fail = client.post(
        f"/api/v1/workspaces/{workspace_id}/ai/settings/test-connection",
        headers=owner_header,
        json={
            "provider": "CUSTOM",
            "model_name": "deepseek-chat",
            "custom_base_url": "",
        },
    )
    assert test_custom_fail.status_code == 200
    fail_data = test_custom_fail.json()["data"]
    assert fail_data["status"] == "error"
    assert "Missing API Base URL" in fail_data["message"]
