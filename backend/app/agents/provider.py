from abc import ABC, abstractmethod
import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel

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

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"

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
                model="gemini-1.5-flash",
            )


class OpenAIProvider(BaseAIProvider):
    """OpenAI Provider (GPT-4o)."""

    def __init__(self, api_key: str):
        self.api_key = api_key
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
                json={"model": "gpt-4o", "messages": messages, "max_tokens": max_tokens},
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
                model="gpt-4o",
            )


def get_ai_provider() -> BaseAIProvider:
    """Factory returning configured AI Provider."""
    provider_type = settings.AI_PROVIDER_DEFAULT.lower()

    if provider_type == "gemini" and settings.GEMINI_API_KEY:
        return GeminiProvider(settings.GEMINI_API_KEY)
    elif provider_type == "openai" and settings.OPENAI_API_KEY:
        return OpenAIProvider(settings.OPENAI_API_KEY)
    else:
        return LocalMockProvider()
