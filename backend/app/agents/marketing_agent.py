import json
from typing import Any, Dict
from app.agents.provider import get_ai_provider
from app.agents.prompt_defense import build_secure_agent_prompt


class MarketingAgent:
    """
    Specialized Marketing Campaign Agent.
    Evaluates campaign metrics (CTR, CVR, CAC), flags underperforming channels,
    and recommends data-backed optimization actions.
    Never modifies budgets or launches campaigns without human approval.
    """

    SYSTEM_PROMPT = """You are the Marketing Campaign Agent of StartupAI Manager.
Your role is to:
1. Analyze marketing campaign performance using real workspace metrics (impressions, clicks, conversions, spend).
2. Identify underperforming campaigns and efficiency bottlenecks.
3. Formulate optimization recommendations for ad channels and content.
4. Any budget modification, campaign pause, or new campaign launch MUST be proposed for human approval."""

    def __init__(self):
        self.provider = get_ai_provider()

    async def analyze_marketing(self, campaign_data: Dict[str, Any], user_query: str) -> str:
        prompt = build_secure_agent_prompt(
            system_instructions=self.SYSTEM_PROMPT,
            user_query=user_query,
            data_context=json.dumps(campaign_data),
        )
        response = await self.provider.generate(prompt=prompt, system_prompt=self.SYSTEM_PROMPT)
        return response.text
