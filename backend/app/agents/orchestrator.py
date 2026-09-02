import json
import time
import uuid
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.agents.provider import get_ai_provider
from app.agents.prompt_defense import sanitize_user_prompt, build_secure_agent_prompt, filter_sensitive_context
from app.agents.task_agent import TaskAgent
from app.agents.report_agent import ReportAgent
from app.agents.finance_agent import FinanceAgent
from app.agents.marketing_agent import MarketingAgent
from app.agents.research_agent import ResearchAgent
from app.agents.risk_agent import RiskAgent
from app.tools.registry import ai_tool_registry
from app.models.ai import AIAgentRun, AgentRunStatus, RiskLevel
from app.models.workspace import WorkspaceMember
from app.services.workspace_service import get_member_membership
from app.services.audit_service import log_audit_event

logger = logging.getLogger("startupai_manager.manager_agent")


class ManagerAgent:
    """
    Central Orchestrator of the Multi-Agent Startup Operating System.
    Coordinates:
      - FinanceAgent (Burn rate, Runway, Budgets, Expenses)
      - MarketingAgent (Campaign analysis, CTR, CVR, Spend)
      - ResearchAgent (Competitor intelligence, SWOT matrix)
      - RiskAgent (Deterministic risk scoring, automated signal scanning)
      - TaskAgent (Decomposition & task allocation)
      - ReportAgent (Executive health summaries)
    Enforces the Human Approval Gatekeeper on all mutating/high-risk actions.
    """

    SYSTEM_PROMPT = """You are the Central Manager Agent of the StartupAI Operating System.
Your purpose is to coordinate the specialized AI agents (Finance, Marketing, Research, Risk, Task, and Report)
to provide founders with actionable startup intelligence.

BEHAVIORAL DIRECTIVES:
1. When asked about finances (burn rate, runway, spending), synthesize verified data. Never invent cash balances or burn numbers.
2. When asked about marketing, report actual campaign metrics (CTR, CVR, CAC) and flag underperforming channels.
3. When asked about market research, clearly distinguish between [Verified Data], [External Research], and [AI Inference].
4. When asked about risks, use calibrated severity scores: LOW (1-4), MEDIUM (5-9), HIGH (10-16), CRITICAL (17-25).
5. Any action that creates, updates, or deletes startup data is staged for human review.
6. Present your answers clearly in GitHub Markdown with structured headers and bullet points."""

    def __init__(self):
        self.provider = get_ai_provider()
        self.task_agent = TaskAgent()
        self.report_agent = ReportAgent()
        self.finance_agent = FinanceAgent()
        self.marketing_agent = MarketingAgent()
        self.research_agent = ResearchAgent()
        self.risk_agent = RiskAgent()

    async def run(
        self,
        db: Session,
        workspace_id: str,
        user_id: str,
        conversation_id: str,
        user_query: str,
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        start_time = time.time()

        # Step 1: Sanitize input & protect against prompt injection
        clean_query = sanitize_user_prompt(user_query)

        # Step 2: Create execution trace record in DB
        agent_run = AIAgentRun(
            conversation_id=conversation_id,
            workspace_id=workspace_id,
            agent_name="ManagerAgent",
            user_query=clean_query,
            status=AgentRunStatus.SUCCESS.value,
        )
        db.add(agent_run)
        db.flush()

        # Step 3: Understand intent and synthesize multi-agent plan
        plan_steps = []
        tools_to_run = []
        query_lower = clean_query.lower()

        # Route A: Finance Domain
        if any(w in query_lower for w in ["burn", "runway", "expense", "expenses", "spend", "spending", "budget", "cash"]):
            plan_steps.append("• [Finance Agent] Calculate burn rate, runway, and budget variances.")
            tools_to_run.append(("calculate_burn_rate", {}))
            tools_to_run.append(("calculate_runway", {}))
            tools_to_run.append(("compare_budget_actual", {}))
            tools_to_run.append(("get_spending_trends", {}))

        # Route B: Marketing Domain
        if any(w in query_lower for w in ["campaign", "campaigns", "marketing", "ad spend", "cvr", "ctr", "acquisition"]):
            plan_steps.append("• [Marketing Agent] Analyze marketing campaigns and conversion efficiency.")
            tools_to_run.append(("get_campaigns", {}))
            tools_to_run.append(("get_campaign_metrics", {}))

        # Route C: Market Research Domain
        if any(w in query_lower for w in ["competitor", "competitors", "research", "swot", "market trend", "market analysis"]):
            plan_steps.append("• [Research Agent] Retrieve competitor intelligence and generate SWOT matrix.")
            tools_to_run.append(("get_research_items", {}))
            tools_to_run.append(("generate_swot_matrix", {}))
            tools_to_run.append(("analyze_competitors", {}))

        # Route D: Risk Detection Domain
        if any(w in query_lower for w in ["risk", "risks", "threat", "threats", "bottleneck", "vulnerability", "scan"]):
            plan_steps.append("• [Risk Agent] Scan operational, financial, and marketing signals for risks.")
            tools_to_run.append(("scan_startup_risks", {}))
            tools_to_run.append(("get_risks", {}))

        # Route E: Projects, Tasks, and Team
        if any(w in query_lower for w in ["project", "projects", "milestone"]):
            plan_steps.append("• [Project Domain] Inspect current workspace projects and milestones.")
            tools_to_run.append(("get_projects", {}))

        if any(w in query_lower for w in ["task", "tasks", "todo", "kanban", "backlog"]):
            plan_steps.append("• [Task Agent] Retrieve active tasks and Kanban status.")
            tools_to_run.append(("get_tasks", {}))

        if any(w in query_lower for w in ["team", "members", "who", "assignee"]):
            plan_steps.append("• [Team Domain] Review team roster and role allocations.")
            tools_to_run.append(("get_team", {}))

        if any(w in query_lower for w in ["report", "health", "summary", "progress", "metrics"]):
            plan_steps.append("• [Report Agent] Compile executive delivery and health snapshot.")
            tools_to_run.append(("generate_report", {"report_type": "HEALTH"}))

        # Mutation Proposals (Staged for Approval)
        if any(w in query_lower for w in ["create task", "add task", "new task"]):
            plan_steps.append("• [Action Gate] Stage new task proposal for human authorization.")
            tools_to_run.append((
                "create_task",
                {
                    "project_id": "auto_detect",
                    "title": clean_query.replace("create task", "").replace("add task", "").strip() or "New Startup Task",
                    "priority": "HIGH" if "urgent" in query_lower else "MEDIUM",
                },
            ))

        if any(w in query_lower for w in ["create expense", "record expense"]):
            plan_steps.append("• [Action Gate] Stage expense creation for human authorization.")
            tools_to_run.append((
                "create_expense",
                {
                    "title": "Proposed Operational Expense",
                    "amount": 500.0,
                    "category": "OPERATIONS",
                },
            ))

        if not plan_steps:
            plan_steps.append("• [Manager Agent] Review startup workspace status and answer founder inquiry.")

        agent_run.plan = "\n".join(plan_steps)

        # Step 4: Execute through AI Tool Gatekeeper
        tool_results = []
        pending_approvals = []
        context_data = {}

        for tool_name, args in tools_to_run:
            if tool_name == "create_task" and args.get("project_id") == "auto_detect":
                projects_res = ai_tool_registry.execute_tool(
                    db=db,
                    tool_name="get_projects",
                    arguments={},
                    workspace_id=workspace_id,
                    user_id=user_id,
                    agent_run_id=agent_run.id,
                )
                if projects_res.get("success") and projects_res.get("result"):
                    args["project_id"] = projects_res["result"][0]["id"]
                else:
                    tool_results.append({"error": "Cannot create task: no project exists in this workspace."})
                    continue

            result = ai_tool_registry.execute_tool(
                db=db,
                tool_name=tool_name,
                arguments=args,
                workspace_id=workspace_id,
                user_id=user_id,
                agent_run_id=agent_run.id,
                requested_by_agent="ManagerAgent",
            )

            if result.get("requires_approval"):
                pending_approvals.append(result)
                agent_run.status = AgentRunStatus.AWAITING_APPROVAL.value
            else:
                tool_results.append({tool_name: result})
                context_data[tool_name] = result.get("result")

        # Step 5: Consult AI Provider with verified backend data
        prompt = build_secure_agent_prompt(
            system_instructions=self.SYSTEM_PROMPT,
            user_query=clean_query,
            data_context=json.dumps(filter_sensitive_context(context_data)),
        )

        ai_response = await self.provider.generate(
            prompt=prompt,
            system_prompt=self.SYSTEM_PROMPT,
        )

        # Step 6: Format response with verified calculation highlights and pending approval cards
        response_sections = [ai_response.text]

        # Explicitly append deterministic runway message if present
        if "calculate_runway" in context_data and isinstance(context_data["calculate_runway"], dict):
            runway_msg = context_data["calculate_runway"].get("message")
            if runway_msg:
                response_sections.append(f"\n> **Financial Runway Notice**: {runway_msg}")

        # Explicitly append detected risk signals if present
        if "scan_startup_risks" in context_data and isinstance(context_data["scan_startup_risks"], list):
            signals = context_data["scan_startup_risks"]
            if signals:
                response_sections.append("\n\n### 🛡️ Detected Risk Indicators")
                for s in signals:
                    response_sections.append(
                        f"- **{s['title']}** (Severity: `{s['severity']}`, Score: `{s['risk_score']}/25`)\n"
                        f"  - *Observation*: {s['description']}\n"
                        f"  - *Indicator*: {s['indicator']}"
                    )

        if pending_approvals:
            response_sections.append(
                "\n\n---\n### ⚠️ Action Requires Human Authorization\n"
                "The following action has been classified as **MEDIUM/HIGH RISK** and has been staged in the Approval Queue:\n"
            )
            for appr in pending_approvals:
                response_sections.append(
                    f"- **Action**: `{appr['action']}` (Risk: `{appr['risk_level']}`)\n"
                    f"  - **Payload**: `{json.dumps(appr['payload'])}`\n"
                    f"  - **Approval ID**: `{appr['approval_id']}`\n"
                    f"  - *Please review and approve or reject this action using the Approval Card below or the Approvals dashboard.*"
                )

        final_text = "\n".join(response_sections)
        duration_ms = int((time.time() - start_time) * 1000)

        # Step 7: Update execution telemetry in DB
        agent_run.final_response = final_text
        agent_run.tokens_used = ai_response.tokens_used
        agent_run.cost_estimate = ai_response.cost_estimate
        agent_run.execution_time_ms = duration_ms
        db.commit()

        log_audit_event(
            db=db,
            action="AI_AGENT_RUN",
            user_id=user_id,
            workspace_id=workspace_id,
            resource_type="ai_agent_run",
            resource_id=agent_run.id,
            details={
                "tokens": agent_run.tokens_used,
                "duration_ms": duration_ms,
                "status": agent_run.status,
                "approvals_count": len(pending_approvals),
                "tools_invoked": [t[0] for t in tools_to_run],
            },
            correlation_id=correlation_id,
        )

        return {
            "run_id": agent_run.id,
            "status": agent_run.status,
            "plan": agent_run.plan,
            "response": final_text,
            "tool_calls_count": len(tools_to_run),
            "pending_approvals": pending_approvals,
            "tokens_used": agent_run.tokens_used,
            "execution_time_ms": duration_ms,
        }
