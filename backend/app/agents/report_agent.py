from typing import Any, Dict
from app.agents.provider import get_ai_provider
from app.agents.prompt_defense import build_secure_agent_prompt


class ReportAgent:
    """
    Specialized agent for synthesizing executive summaries, progress metrics,
    and milestone delivery health.
    """

    SYSTEM_PROMPT = """You are the Report Agent of StartupAI Manager.
Your role is to:
1. Synthesize startup health reports, sprint summaries, and completion velocity.
2. Highlight blockers, critical deadlines, and resource utilization.
3. Be clear, objective, and executive-ready."""

    def __init__(self):
        self.provider = get_ai_provider()

    async def generate_summary(self, metrics: Dict[str, Any]) -> str:
        context_str = f"Current Metrics: {metrics}"
        prompt = build_secure_agent_prompt(
            system_instructions=self.SYSTEM_PROMPT,
            user_query="Generate an executive startup progress report based on these metrics.",
            data_context=context_str,
        )
        response = await self.provider.generate(prompt=prompt, system_prompt=self.SYSTEM_PROMPT)
        return response.text
