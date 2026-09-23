from abc import ABC, abstractmethod
import json
import logging
import time
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger("startupai_manager.ai")


class AIProviderResponse(BaseModel):
    text: str
    tokens_used: int = 0
    cost_estimate: float = 0.0
    model: str


class BaseAIProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2000,
    ) -> AIProviderResponse:
        pass


class LocalMockProvider(BaseAIProvider):
    """
    Deterministic Local AI Provider for offline development, testing, and CI.
    Generates intelligent reasoning, planning, and tool calls with zero external network dependency.
    """

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2000,
    ) -> AIProviderResponse:
        prompt_lower = prompt.lower()

        # Simulated token cost (e.g. 150 tokens)
        tokens_used = len(prompt.split()) + 150
        cost_estimate = (tokens_used / 1000) * 0.002

        if "break down" in prompt_lower or "create tasks" in prompt_lower or "breakdown" in prompt_lower:
            response_text = (
                "### Goal Decomposition Plan\n\n"
                "I have analyzed your objective and formulated the following operational task breakdown:\n\n"
                "1. **Architecture & Technical Design**\n"
                "   - Priority: HIGH\n"
                "   - Estimated Effort: 8 hours\n"
                "   - Objective: Define schemas, API contracts, and security boundaries.\n\n"
                "2. **Core Implementation & Security Integration**\n"
                "   - Priority: HIGH\n"
                "   - Estimated Effort: 16 hours\n"
                "   - Objective: Implement endpoints with RBAC and input sanitization.\n\n"
                "3. **Automated Testing & QA Verification**\n"
                "   - Priority: MEDIUM\n"
                "   - Estimated Effort: 6 hours\n"
                "   - Objective: Validate regression suites and tenant isolation.\n\n"
                "I recommend staging these tasks into your project backlog."
            )
        elif "risk" in prompt_lower:
            response_text = (
                "### Risk Assessment Report\n\n"
                "**Identified Risks:**\n"
                "1. **Deadline Proximity**: Key milestones scheduled within the next 7 days.\n"
                "   - *Severity*: HIGH\n"
                "   - *Impact*: Potential release delay if unassigned tasks are not prioritized.\n"
                "   - *Recommendation*: Allocate available team capacity immediately to active bottlenecks."
            )
        elif "report" in prompt_lower or "status" in prompt_lower:
            response_text = (
                "### Executive Startup Health Report\n\n"
                "- **Operational Velocity**: Steady progression across planned initiatives.\n"
                "- **Task Completion Rate**: High percentage on track.\n"
                "- **Key Action Items**: Review overdue items and finalize milestone goals."
            )
        else:
            response_text = (
                f"### AI Manager Analysis\n\n"
                f"I have reviewed your request regarding your startup operations. "
                f"Based on your workspace status, our coordinated multi-agent system is prepared to assist with project planning, "
                f"task allocation, risk detection, and performance reporting.\n\n"
                f"How would you like to proceed?"
            )

        return AIProviderResponse(
            text=response_text,
            tokens_used=tokens_used,
            cost_estimate=cost_estimate,
            model="startupai-mock-v1",
        )


class GeminiProvider(BaseAIProvider):
    """Google Gemini AI Provider."""

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model or "gemini-1.5-flash"
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2000,
    ) -> AIProviderResponse:
        if not self.api_key:
            return await LocalMockProvider().generate(prompt, system_prompt, max_tokens)

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_prompt}]} if system_prompt else None,
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.2},
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.api_url, json=payload)
            if resp.status_code != 200:
                logger.error(f"Gemini API error: {resp.text}")
                # Fallback to local mock on network or API key error
                return await LocalMockProvider().generate(prompt, system_prompt, max_tokens)

            data = resp.json()
            candidate = data.get("candidates", [{}])[0]
            text = candidate.get("content", {}).get("parts", [{}])[0].get("text", "")
            return AIProviderResponse(
                text=text,
                tokens_used=data.get("usageMetadata", {}).get("totalTokenCount", 0),
                cost_estimate=0.001,
                model=self.model,
            )


class OpenAIProvider(BaseAIProvider):
    """OpenAI Provider (GPT-4o / GPT-4o-mini)."""

    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model or "gpt-4o"
        self.api_url = "https://api.openai.com/v1/chat/completions"

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2000,
    ) -> AIProviderResponse:
        if not self.api_key:
            return await LocalMockProvider().generate(prompt, system_prompt, max_tokens)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self.api_url,
                headers=headers,
                json={"model": self.model, "messages": messages, "max_tokens": max_tokens},
            )
            if resp.status_code != 200:
                return await LocalMockProvider().generate(prompt, system_prompt, max_tokens)

            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            tokens = data.get("usage", {}).get("total_tokens", 0)
            return AIProviderResponse(
                text=text,
                tokens_used=tokens,
                cost_estimate=(tokens / 1000) * 0.005,
                model=self.model,
            )


class OllamaProvider(BaseAIProvider):
    """
    Local / Private Ollama Provider.
    Enables 100% air-gapped execution with zero external data transfer.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3:latest",
        temperature: float = 0.2,
    ):
        self.base_url = (base_url or "http://localhost:11434").rstrip("/")
        self.model = model or "llama3:latest"
        self.temperature = temperature

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2000,
    ) -> AIProviderResponse:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "num_predict": max_tokens,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(f"{self.base_url}/api/chat", json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("message", {}).get("content", "")
                    prompt_eval = data.get("prompt_eval_count", 0)
                    eval_count = data.get("eval_count", 0)
                    total_tokens = prompt_eval + eval_count or len(prompt.split()) + len(content.split())
                    return AIProviderResponse(
                        text=content,
                        tokens_used=total_tokens,
                        cost_estimate=0.0,  # 100% free / local
                        model=f"ollama/{self.model}",
                    )
                else:
                    logger.warning(
                        f"Ollama returned HTTP {resp.status_code}: {resp.text}. Falling back to LocalMockProvider."
                    )
        except Exception as e:
            logger.warning(
                f"Failed to communicate with local Ollama at {self.base_url}: {e}. Falling back to LocalMockProvider."
            )

        return await LocalMockProvider().generate(prompt, system_prompt, max_tokens)


class CustomOpenAICompatibleProvider(BaseAIProvider):
    """
    Universal OpenAI-Compatible LLM Provider.
    Enables connecting to ANY OpenAI-standard API endpoint:
    - DeepSeek (https://api.deepseek.com/v1)
    - Groq (https://api.groq.com/openai/v1)
    - Mistral AI (https://api.mistral.ai/v1)
    - OpenRouter (https://openrouter.ai/api/v1)
    - Self-hosted vLLM / LM Studio / LocalAI (http://localhost:1234/v1 or LAN IP)
    """

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        model: str = "default",
        temperature: float = 0.2,
    ):
        self.base_url = (base_url or "").rstrip("/")
        self.api_key = api_key or ""
        self.model = model or "default"
        self.temperature = temperature

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2000,
    ) -> AIProviderResponse:
        if not self.base_url:
            return await LocalMockProvider().generate(prompt, system_prompt, max_tokens)

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": self.temperature,
        }

        endpoint = f"{self.base_url}/chat/completions" if not self.base_url.endswith("/chat/completions") else self.base_url

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(endpoint, headers=headers, json=payload)
                if resp.status_code in [200, 201]:
                    data = resp.json()
                    choices = data.get("choices", [])
                    content = ""
                    if choices:
                        content = choices[0].get("message", {}).get("content", "")
                    usage = data.get("usage", {})
                    tokens_used = usage.get("total_tokens", len(prompt.split()) + len(content.split()))
                    is_local = any(h in self.base_url for h in ["localhost", "127.0.0.1", "192.168.", "10."])
                    cost_estimate = 0.0 if is_local else round(tokens_used * 0.000002, 6)

                    return AIProviderResponse(
                        text=content,
                        tokens_used=tokens_used,
                        cost_estimate=cost_estimate,
                        model=f"custom/{self.model}",
                    )
                else:
                    logger.warning(
                        f"Custom OpenAI-compatible provider ({self.base_url}) returned HTTP {resp.status_code}: {resp.text}. Falling back to LocalMockProvider."
                    )
        except Exception as e:
            logger.warning(
                f"Failed to communicate with custom provider at {self.base_url}: {e}. Falling back to LocalMockProvider."
            )

        return await LocalMockProvider().generate(prompt, system_prompt, max_tokens)


async def test_ai_provider_connection(
    provider: str,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    ollama_base_url: Optional[str] = None,
    custom_base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Tests live connection to the requested AI Provider and measures round-trip latency.
    """
    provider_upper = provider.upper()
    start_time = time.time()

    if provider_upper == "MOCK":
        return {
            "status": "connected",
            "latency_ms": 1,
            "provider": "MOCK",
            "model_name": model_name or "startupai-mock-v1",
            "message": "Offline Local Mock Engine is operational and ready.",
            "details": {"air_gapped": True, "cost": "$0.00"},
        }

    elif provider_upper == "OLLAMA":
        url = (ollama_base_url or "http://localhost:11434").rstrip("/")
        target_model = model_name or "llama3:latest"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{url}/api/tags")
                latency_ms = int((time.time() - start_time) * 1000)

                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name") for m in data.get("models", [])]
                    has_model = any(target_model in m for m in models)
                    msg = (
                        f"Connected to Ollama! Model '{target_model}' is verified and ready."
                        if has_model
                        else f"Connected to Ollama at {url}. Note: '{target_model}' not found in installed models. Run 'ollama pull {target_model}' if needed."
                    )
                    return {
                        "status": "connected",
                        "latency_ms": latency_ms,
                        "provider": "OLLAMA",
                        "model_name": target_model,
                        "message": msg,
                        "details": {"available_models": models[:5], "air_gapped": True},
                    }
                else:
                    return {
                        "status": "error",
                        "latency_ms": latency_ms,
                        "provider": "OLLAMA",
                        "model_name": target_model,
                        "message": f"Ollama returned HTTP {resp.status_code}: {resp.text}",
                    }
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "status": "error",
                "latency_ms": latency_ms,
                "provider": "OLLAMA",
                "model_name": target_model,
                "message": f"Could not reach Ollama at {url}. Ensure Ollama is installed and running ('ollama serve'). Error: {str(e)}",
            }

    elif provider_upper == "GEMINI":
        key = api_key or settings.GEMINI_API_KEY
        target_model = model_name or "gemini-1.5-flash"
        if not key:
            return {
                "status": "error",
                "latency_ms": 0,
                "provider": "GEMINI",
                "model_name": target_model,
                "message": "Missing Gemini API Key. Please provide a valid Google AI Studio key.",
            }
        test_url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={key}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    test_url,
                    json={"contents": [{"parts": [{"text": "ping"}]}], "generationConfig": {"maxOutputTokens": 5}},
                )
                latency_ms = int((time.time() - start_time) * 1000)
                if resp.status_code == 200:
                    return {
                        "status": "connected",
                        "latency_ms": latency_ms,
                        "provider": "GEMINI",
                        "model_name": target_model,
                        "message": f"Successfully connected to Google Gemini ({target_model})!",
                    }
                else:
                    return {
                        "status": "error",
                        "latency_ms": latency_ms,
                        "provider": "GEMINI",
                        "model_name": target_model,
                        "message": f"Gemini API returned HTTP {resp.status_code}: {resp.text}",
                    }
        except Exception as e:
            return {
                "status": "error",
                "latency_ms": int((time.time() - start_time) * 1000),
                "provider": "GEMINI",
                "model_name": target_model,
                "message": f"Failed to connect to Google Gemini: {str(e)}",
            }

    elif provider_upper == "OPENAI":
        key = api_key or settings.OPENAI_API_KEY
        target_model = model_name or "gpt-4o"
        if not key:
            return {
                "status": "error",
                "latency_ms": 0,
                "provider": "OPENAI",
                "model_name": target_model,
                "message": "Missing OpenAI API Key. Please provide a valid OpenAI key.",
            }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                latency_ms = int((time.time() - start_time) * 1000)
                if resp.status_code == 200:
                    return {
                        "status": "connected",
                        "latency_ms": latency_ms,
                        "provider": "OPENAI",
                        "model_name": target_model,
                        "message": f"Successfully authenticated with OpenAI API ({target_model})!",
                    }
                else:
                    return {
                        "status": "error",
                        "latency_ms": latency_ms,
                        "provider": "OPENAI",
                        "model_name": target_model,
                        "message": f"OpenAI API returned HTTP {resp.status_code}: {resp.text}",
                    }
        except Exception as e:
            return {
                "status": "error",
                "latency_ms": int((time.time() - start_time) * 1000),
                "provider": "OPENAI",
                "model_name": target_model,
                "message": f"Failed to connect to OpenAI: {str(e)}",
            }

    elif provider_upper == "CUSTOM":
        target_model = model_name or "default"
        url = (custom_base_url or "").rstrip("/")
        if not url:
            return {
                "status": "error",
                "latency_ms": 0,
                "provider": "CUSTOM",
                "model_name": target_model,
                "message": "Missing API Base URL. Please provide a valid endpoint (e.g. https://api.deepseek.com/v1).",
            }

        endpoint = f"{url}/chat/completions" if not url.endswith("/chat/completions") else url
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": target_model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(endpoint, headers=headers, json=payload)
                latency_ms = int((time.time() - start_time) * 1000)
                if resp.status_code in [200, 201]:
                    return {
                        "status": "connected",
                        "latency_ms": latency_ms,
                        "provider": "CUSTOM",
                        "model_name": target_model,
                        "message": f"Successfully connected to Custom Endpoint ({target_model})!",
                    }
                else:
                    return {
                        "status": "error",
                        "latency_ms": latency_ms,
                        "provider": "CUSTOM",
                        "model_name": target_model,
                        "message": f"Custom endpoint returned HTTP {resp.status_code}: {resp.text[:200]}",
                    }
        except Exception as e:
            return {
                "status": "error",
                "latency_ms": int((time.time() - start_time) * 1000),
                "provider": "CUSTOM",
                "model_name": target_model,
                "message": f"Failed to connect to Custom Endpoint at {url}: {str(e)}",
            }

    return {
        "status": "error",
        "latency_ms": 0,
        "provider": provider,
        "model_name": model_name or "unknown",
        "message": f"Unsupported provider: {provider}",
    }


def get_ai_provider() -> BaseAIProvider:
    """Default fallback factory returning configured AI Provider from settings."""
    provider_type = settings.AI_PROVIDER_DEFAULT.lower()

    if provider_type == "gemini" and settings.GEMINI_API_KEY:
        return GeminiProvider(settings.GEMINI_API_KEY)
    elif provider_type == "openai" and settings.OPENAI_API_KEY:
        return OpenAIProvider(settings.OPENAI_API_KEY)
    else:
        return LocalMockProvider()


def get_workspace_ai_provider(db: Session, workspace_id: str) -> BaseAIProvider:
    """
    Dynamically returns the configured AI Provider for a specific workspace.
    Supports Workspace-level BYOK, custom Ollama endpoints, and fallback.
    """
    from app.models.ai import WorkspaceAISettings

    ws_settings = (
        db.query(WorkspaceAISettings)
        .filter(WorkspaceAISettings.workspace_id == workspace_id)
        .first()
    )

    if not ws_settings:
        return get_ai_provider()

    provider_type = ws_settings.provider.upper()

    if provider_type == "OLLAMA":
        return OllamaProvider(
            base_url=ws_settings.ollama_base_url,
            model=ws_settings.model_name,
            temperature=ws_settings.temperature,
        )
    elif provider_type == "GEMINI":
        api_key = ws_settings.api_key or settings.GEMINI_API_KEY
        if api_key:
            return GeminiProvider(api_key=api_key, model=ws_settings.model_name)
    elif provider_type == "OPENAI":
        api_key = ws_settings.api_key or settings.OPENAI_API_KEY
        if api_key:
            return OpenAIProvider(api_key=api_key, model=ws_settings.model_name)
    elif provider_type == "CUSTOM":
        return CustomOpenAICompatibleProvider(
            base_url=ws_settings.custom_base_url or ws_settings.ollama_base_url,
            api_key=ws_settings.api_key,
            model=ws_settings.model_name,
            temperature=ws_settings.temperature,
        )
    elif provider_type == "MOCK":
        return LocalMockProvider()

    return get_ai_provider()

