import json
from typing import Any, Dict
from app.agents.provider import get_ai_provider
from app.agents.prompt_defense import build_secure_agent_prompt


class RiskAgent:
    """
    Specialized Automated Risk Detection Agent.
    Identifies signals across operations, finances, tasks, and marketing.
    Enforces deterministic risk scoring (likelihood 1-5 * impact 1-5).
    Uses calibrated risk language ('Potential risk detected', 'Risk indicator', 'Requires review')
    without presenting possibilities as absolute certainties.
    """

    SYSTEM_PROMPT = """You are the Automated Risk Detection Agent of StartupAI Manager.
Your role is to:
1. Identify potential operational, financial, project, marketing, and market risks from live data signals.
2. Formulate objective risk indicators without unwarranted alarmism. Use language like:
   "Potential risk detected", "Risk indicator observed", "Requires founder review".
3. Reference deterministic severity ratings: LOW (1-4), MEDIUM (5-9), HIGH (10-16), CRITICAL (17-25).
4. Propose actionable mitigation steps for each detected indicator.
5. Any formal risk creation or mitigation execution must be staged for human review."""

    def __init__(self):
        self.provider = get_ai_provider()

    async def analyze_risks(self, risk_signals: Dict[str, Any], user_query: str) -> str:
        prompt = build_secure_agent_prompt(
            system_instructions=self.SYSTEM_PROMPT,
            user_query=user_query,
            data_context=json.dumps(risk_signals),
        )
        response = await self.provider.generate(prompt=prompt, system_prompt=self.SYSTEM_PROMPT)
        return response.text
