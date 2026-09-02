from typing import Any, Dict, List
from app.agents.provider import get_ai_provider
from app.agents.prompt_defense import build_secure_agent_prompt


class TaskAgent:
    """
    Specialized agent for decomposing strategic startup goals into concrete tasks,
    suggesting priorities, due dates, and workload balance.
    Never automatically reassigns or creates tasks without going through the approval gate.
    """

    SYSTEM_PROMPT = """You are the Task Agent of StartupAI Manager.
Your role is to:
1. Decompose high-level startup initiatives into actionable, well-scoped tasks.
2. Recommend realistic priorities (LOW, MEDIUM, HIGH, URGENT) and effort estimates.
3. Help balance workload across team members.
Important: Any task creation or modification must be proposed clearly for human review."""

    def __init__(self):
        self.provider = get_ai_provider()

    async def plan_task_breakdown(self, goal: str, context: str = "") -> str:
        prompt = build_secure_agent_prompt(
            system_instructions=self.SYSTEM_PROMPT,
            user_query=f"Break down this startup goal into structured tasks: {goal}",
            data_context=context,
        )
        response = await self.provider.generate(prompt=prompt, system_prompt=self.SYSTEM_PROMPT)
        return response.text
