import json
from typing import Any, Dict
from app.agents.provider import get_ai_provider
from app.agents.prompt_defense import build_secure_agent_prompt


class FinanceAgent:
    """
    Specialized Finance & Burn Rate Agent.
    Calculations are strictly computed deterministically by backend services.
    The agent synthesizes and explains the verified calculations without hallucinating numbers.
    """

    SYSTEM_PROMPT = """You are the Finance & Burn Rate Agent of StartupAI Manager.
Your role is to:
1. Provide accurate startup financial intelligence based ONLY on verified backend data.
2. Clearly explain monthly burn rate, cash runway, category expenses, and budget variances.
3. If cash balance or any required financial input is missing, NEVER GUESS OR INVENT DATA.
   Explicitly state: "I cannot calculate runway because available cash balance has not been provided."
4. Suggest cost optimization and highlight budget overruns objectively."""

    def __init__(self):
        self.provider = get_ai_provider()

    async def explain_financial_health(self, verified_data: Dict[str, Any], user_query: str) -> str:
        prompt = build_secure_agent_prompt(
            system_instructions=self.SYSTEM_PROMPT,
            user_query=user_query,
            data_context=json.dumps(verified_data),
        )
        response = await self.provider.generate(prompt=prompt, system_prompt=self.SYSTEM_PROMPT)
        return response.text
