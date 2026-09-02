import json
import logging
from typing import Any, Callable, Dict, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.permissions import Role, Permission, check_role_permission
from app.models.ai import RiskLevel, ApprovalStatus, Approval, AIToolCall
from app.models.workspace import WorkspaceMember
from app.services.workspace_service import get_member_membership, list_workspace_members
from app.services.project_service import list_workspace_projects
from app.services.task_service import list_workspace_tasks, create_task, update_task, delete_task
from app.schemas.task import TaskCreate, TaskUpdate

# Phase 4 Service Imports
from app.services.finance_service import (
    calculate_monthly_burn_rate,
    calculate_cash_runway,
    compare_budget_vs_actual,
    get_spending_trends,
    list_expenses,
    create_expense,
    list_budgets,
)
from app.services.marketing_service import (
    list_campaigns,
    analyze_campaign_performance,
    create_campaign,
    modify_campaign_budget,
)
from app.services.research_service import (
    list_research_items,
    get_swot_matrix,
    analyze_competitors,
    create_research_item,
)
from app.services.risk_service import (
    list_risk_items,
    scan_startup_risks,
    calculate_risk_score,
    create_risk_item,
)

logger = logging.getLogger("startupai_manager.tools")


# =========================================================================
# TOOL ARGUMENT SCHEMAS
# =========================================================================

# Phase 3 Schemas
class GetProjectsArgs(BaseModel):
    status_filter: Optional[str] = None
    search: Optional[str] = None


class GetTasksArgs(BaseModel):
    project_id: Optional[str] = None
    status_filter: Optional[str] = None
    priority_filter: Optional[str] = None
    search: Optional[str] = None


class GetTeamArgs(BaseModel):
    pass


class GenerateReportArgs(BaseModel):
    report_type: str = Field("HEALTH", description="Type of report: HEALTH, WEEKLY, PROGRESS")


class CreateTaskArgs(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"
    assignee_id: Optional[str] = None
    estimated_hours: Optional[float] = None


class UpdateTaskArgs(BaseModel):
    task_id: str
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None


class DeleteTaskArgs(BaseModel):
    task_id: str


# Phase 4 Schemas — Finance
class GetExpensesArgs(BaseModel):
    category: Optional[str] = None
    limit: int = 50


class CalculateBurnRateArgs(BaseModel):
    pass


class CalculateRunwayArgs(BaseModel):
    pass


class CompareBudgetActualArgs(BaseModel):
    pass


class GetSpendingTrendsArgs(BaseModel):
    pass


class CreateExpenseArgs(BaseModel):
    title: str
    amount: float = Field(..., gt=0)
    category: str = "OPERATIONS"
    notes: Optional[str] = None


# Phase 4 Schemas — Marketing
class GetCampaignsArgs(BaseModel):
    status_filter: Optional[str] = None


class GetCampaignMetricsArgs(BaseModel):
    pass


class CreateCampaignArgs(BaseModel):
    name: str
    channel: str = "SOCIAL_MEDIA"
    budget: float = Field(0.0, ge=0)
    target_audience: Optional[str] = None


class ModifyCampaignBudgetArgs(BaseModel):
    campaign_id: str
    new_budget: float = Field(..., ge=0)


# Phase 4 Schemas — Research
class GetResearchItemsArgs(BaseModel):
    topic: Optional[str] = None
    competitor: Optional[str] = None


class GenerateSwotMatrixArgs(BaseModel):
    pass


class AnalyzeCompetitorsArgs(BaseModel):
    pass


class AddResearchItemArgs(BaseModel):
    title: str
    topic: str = "COMPETITOR"
    source_name: str = "Internal Research"
    source_url: Optional[str] = None
    content: str
    key_findings: Optional[str] = None
    swot_category: str = "GENERAL"
    competitor_name: Optional[str] = None


# Phase 4 Schemas — Risk
class GetRisksArgs(BaseModel):
    category: Optional[str] = None
    severity: Optional[str] = None


class ScanStartupRisksArgs(BaseModel):
    pass


class CalculateRiskScoreArgs(BaseModel):
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)


class CreateRiskCandidateArgs(BaseModel):
    title: str
    category: str = "OPERATIONAL"
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)
    description: Optional[str] = None
    mitigation_plan: Optional[str] = None


# =========================================================================
# TOOL DEFINITIONS & REGISTRY
# =========================================================================

class ToolDefinition:
    def __init__(
        self,
        name: str,
        description: str,
        risk_level: RiskLevel,
        required_permission: Permission,
        args_schema: type[BaseModel],
        handler: Callable,
    ):
        self.name = name
        self.description = description
        self.risk_level = risk_level
        self.required_permission = required_permission
        self.args_schema = args_schema
        self.handler = handler


class AIToolRegistry:
    def __init__(self):
        self.tools: Dict[str, ToolDefinition] = {}
        self._register_default_tools()

    def register(self, tool: ToolDefinition):
        self.tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self.tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "risk_level": t.risk_level.value,
                "schema": t.args_schema.model_json_schema(),
            }
            for t in self.tools.values()
        ]

    def _register_default_tools(self):
        # ---------------- Phase 3 Tools ----------------
        self.register(ToolDefinition(
            name="get_projects",
            description="List all active projects in the startup workspace.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.PROJECT_READ,
            args_schema=GetProjectsArgs,
            handler=lambda db, ws, u, a: [
                {"id": p.id, "name": p.name, "status": p.status, "priority": p.priority, "budget": p.budget}
                for p in list_workspace_projects(db, ws, u, status_filter=a.status_filter, search=a.search)
            ],
        ))

        self.register(ToolDefinition(
            name="get_tasks",
            description="Retrieve tasks filtered by project, status (TODO, IN_PROGRESS, REVIEW, DONE), or priority.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.TASK_READ,
            args_schema=GetTasksArgs,
            handler=lambda db, ws, u, a: [
                {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority, "due_date": str(t.due_date) if t.due_date else None}
                for t in list_workspace_tasks(db, ws, u, project_id=a.project_id, status_filter=a.status_filter, priority_filter=a.priority_filter, search=a.search)
            ],
        ))

        self.register(ToolDefinition(
            name="get_team",
            description="List team members and their roles in the workspace.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.WORKSPACE_READ,
            args_schema=GetTeamArgs,
            handler=lambda db, ws, u, a: [
                {"id": m.id, "user_id": m.user_id, "name": m.user.full_name if m.user else "Member", "role": m.role}
                for m in list_workspace_members(db, ws, u)
            ],
        ))

        self.register(ToolDefinition(
            name="generate_report",
            description="Generate a synthesized startup health, weekly, or progress summary.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.REPORT_READ,
            args_schema=GenerateReportArgs,
            handler=self._handle_generate_report,
        ))

        self.register(ToolDefinition(
            name="create_task",
            description="Create a new task in a project. Requires human approval before execution.",
            risk_level=RiskLevel.MEDIUM,
            required_permission=Permission.TASK_CREATE,
            args_schema=CreateTaskArgs,
            handler=lambda db, ws, u, a: {"id": create_task(db, ws, u, TaskCreate(project_id=a.project_id, title=a.title, description=a.description, priority=a.priority, assignee_id=a.assignee_id, estimated_hours=a.estimated_hours)).id},
        ))

        self.register(ToolDefinition(
            name="update_task",
            description="Update an existing task status, priority, or assignee. Requires human approval.",
            risk_level=RiskLevel.MEDIUM,
            required_permission=Permission.TASK_UPDATE,
            args_schema=UpdateTaskArgs,
            handler=lambda db, ws, u, a: {"id": update_task(db, ws, a.task_id, u, TaskUpdate(title=a.title, status=a.status, priority=a.priority, assignee_id=a.assignee_id)).id},
        ))

        self.register(ToolDefinition(
            name="delete_task",
            description="Delete a task permanently. High impact action requiring explicit human confirmation.",
            risk_level=RiskLevel.HIGH,
            required_permission=Permission.TASK_DELETE,
            args_schema=DeleteTaskArgs,
            handler=lambda db, ws, u, a: {"deleted_task_id": a.task_id, "success": delete_task(db, ws, a.task_id, u)},
        ))

        # ---------------- Phase 4 Finance Tools ----------------
        self.register(ToolDefinition(
            name="get_expenses",
            description="Retrieve recorded workspace expenses.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.FINANCE_READ,
            args_schema=GetExpensesArgs,
            handler=lambda db, ws, u, a: [
                {"id": e.id, "title": e.title, "amount": e.amount, "category": e.category, "date": str(e.expense_date)}
                for e in list_expenses(db, ws, u, category=a.category, limit=a.limit)
            ],
        ))

        self.register(ToolDefinition(
            name="calculate_burn_rate",
            description="Deterministically calculate monthly operating expense burn rate.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.FINANCE_READ,
            args_schema=CalculateBurnRateArgs,
            handler=lambda db, ws, u, a: calculate_monthly_burn_rate(db, ws),
        ))

        self.register(ToolDefinition(
            name="calculate_runway",
            description="Deterministically calculate runway in months based on available cash and burn rate.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.FINANCE_READ,
            args_schema=CalculateRunwayArgs,
            handler=lambda db, ws, u, a: calculate_cash_runway(db, ws),
        ))

        self.register(ToolDefinition(
            name="compare_budget_actual",
            description="Compare allocated budgets against actual spending with variances.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.FINANCE_READ,
            args_schema=CompareBudgetActualArgs,
            handler=lambda db, ws, u, a: compare_budget_vs_actual(db, ws),
        ))

        self.register(ToolDefinition(
            name="get_spending_trends",
            description="Analyze category-wise spending distribution and top expenditure area.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.FINANCE_READ,
            args_schema=GetSpendingTrendsArgs,
            handler=lambda db, ws, u, a: get_spending_trends(db, ws),
        ))

        self.register(ToolDefinition(
            name="create_expense",
            description="Record a new expense. Staged for human approval.",
            risk_level=RiskLevel.MEDIUM,
            required_permission=Permission.FINANCE_CREATE,
            args_schema=CreateExpenseArgs,
            handler=lambda db, ws, u, a: {"id": create_expense(db, ws, u, title=a.title, amount=a.amount, category=a.category, notes=a.notes).id},
        ))

        # ---------------- Phase 4 Marketing Tools ----------------
        self.register(ToolDefinition(
            name="get_campaigns",
            description="List marketing campaigns and channel allocations.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.MARKETING_READ,
            args_schema=GetCampaignsArgs,
            handler=lambda db, ws, u, a: [
                {"id": c.id, "name": c.name, "channel": c.channel, "status": c.status, "budget": c.budget, "spend": c.spend}
                for c in list_campaigns(db, ws, u, status_filter=a.status_filter)
            ],
        ))

        self.register(ToolDefinition(
            name="get_campaign_metrics",
            description="Analyze campaign performance metrics (CTR, CVR, CAC, and underperforming campaigns).",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.MARKETING_READ,
            args_schema=GetCampaignMetricsArgs,
            handler=lambda db, ws, u, a: analyze_campaign_performance(db, ws),
        ))

        self.register(ToolDefinition(
            name="create_campaign",
            description="Create a new marketing campaign. Staged for human approval.",
            risk_level=RiskLevel.MEDIUM,
            required_permission=Permission.MARKETING_MANAGE,
            args_schema=CreateCampaignArgs,
            handler=lambda db, ws, u, a: {"id": create_campaign(db, ws, u, name=a.name, channel=a.channel, budget=a.budget, target_audience=a.target_audience).id},
        ))

        self.register(ToolDefinition(
            name="modify_campaign_budget",
            description="Modify campaign budget. High risk action requiring explicit human confirmation.",
            risk_level=RiskLevel.HIGH,
            required_permission=Permission.MARKETING_MANAGE,
            args_schema=ModifyCampaignBudgetArgs,
            handler=lambda db, ws, u, a: {"id": modify_campaign_budget(db, ws, u, a.campaign_id, a.new_budget).id},
        ))

        # ---------------- Phase 4 Research Tools ----------------
        self.register(ToolDefinition(
            name="get_research_items",
            description="Retrieve stored market and competitor research items.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.RESEARCH_READ,
            args_schema=GetResearchItemsArgs,
            handler=lambda db, ws, u, a: [
                {"id": r.id, "title": r.title, "topic": r.topic, "source": r.source_name, "swot": r.swot_category, "competitor": r.competitor_name, "findings": r.key_findings or r.content[:100]}
                for r in list_research_items(db, ws, u, topic=a.topic, competitor=a.competitor)
            ],
        ))

        self.register(ToolDefinition(
            name="generate_swot_matrix",
            description="Generate SWOT analysis matrix from verified research items.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.RESEARCH_READ,
            args_schema=GenerateSwotMatrixArgs,
            handler=lambda db, ws, u, a: get_swot_matrix(db, ws),
        ))

        self.register(ToolDefinition(
            name="analyze_competitors",
            description="Analyze competitor intelligence gathered in workspace.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.RESEARCH_READ,
            args_schema=AnalyzeCompetitorsArgs,
            handler=lambda db, ws, u, a: analyze_competitors(db, ws),
        ))

        self.register(ToolDefinition(
            name="add_research_item",
            description="Add a verified research item. Staged for human review.",
            risk_level=RiskLevel.MEDIUM,
            required_permission=Permission.RESEARCH_MANAGE,
            args_schema=AddResearchItemArgs,
            handler=lambda db, ws, u, a: {"id": create_research_item(db, ws, u, title=a.title, topic=a.topic, source_name=a.source_name, source_url=a.source_url, content=a.content, key_findings=a.key_findings, swot_category=a.swot_category, competitor_name=a.competitor_name).id},
        ))

        # ---------------- Phase 4 Risk Tools ----------------
        self.register(ToolDefinition(
            name="get_risks",
            description="List tracked startup risk items.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.RISK_READ,
            args_schema=GetRisksArgs,
            handler=lambda db, ws, u, a: [
                {"id": r.id, "title": r.title, "category": r.category, "score": r.risk_score, "severity": r.severity, "status": r.status}
                for r in list_risk_items(db, ws, u, category=a.category, severity=a.severity)
            ],
        ))

        self.register(ToolDefinition(
            name="scan_startup_risks",
            description="Scan operational, financial, and marketing signals for potential risk indicators.",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.RISK_READ,
            args_schema=ScanStartupRisksArgs,
            handler=lambda db, ws, u, a: scan_startup_risks(db, ws),
        ))

        self.register(ToolDefinition(
            name="calculate_risk_score",
            description="Deterministically calculate risk score and severity from likelihood (1-5) and impact (1-5).",
            risk_level=RiskLevel.LOW,
            required_permission=Permission.RISK_READ,
            args_schema=CalculateRiskScoreArgs,
            handler=lambda db, ws, u, a: {"score": calculate_risk_score(a.likelihood, a.impact)[0], "severity": calculate_risk_score(a.likelihood, a.impact)[1]},
        ))

        self.register(ToolDefinition(
            name="create_risk_candidate",
            description="Create a formal tracked risk item. Staged for human review.",
            risk_level=RiskLevel.MEDIUM,
            required_permission=Permission.RISK_MANAGE,
            args_schema=CreateRiskCandidateArgs,
            handler=lambda db, ws, u, a: {"id": create_risk_item(db, ws, u, title=a.title, category=a.category, likelihood=a.likelihood, impact=a.impact, description=a.description, mitigation_plan=a.mitigation_plan, detected_by="AI_AGENT").id},
        ))

    def _handle_generate_report(self, db: Session, workspace_id: str, user_id: str, args: GenerateReportArgs) -> Dict:
        projects = list_workspace_projects(db, workspace_id, user_id)
        tasks = list_workspace_tasks(db, workspace_id, user_id)
        completed_tasks = [t for t in tasks if t.status == "DONE"]
        in_progress_tasks = [t for t in tasks if t.status == "IN_PROGRESS"]
        todo_tasks = [t for t in tasks if t.status == "TODO"]
        return {
            "report_type": args.report_type,
            "total_projects": len(projects),
            "total_tasks": len(tasks),
            "completed_tasks": len(completed_tasks),
            "in_progress_tasks": len(in_progress_tasks),
            "todo_tasks": len(todo_tasks),
            "completion_rate": f"{(len(completed_tasks) / len(tasks) * 100):.1f}%" if tasks else "0.0%",
        }

    def execute_tool(
        self,
        db: Session,
        tool_name: str,
        arguments: Dict[str, Any],
        workspace_id: str,
        user_id: str,
        agent_run_id: str,
        requested_by_agent: str = "ManagerAgent",
    ) -> Dict[str, Any]:
        tool = self.get_tool(tool_name)
        if not tool:
            return {"error": f"Tool '{tool_name}' is not registered."}

        membership = get_member_membership(db, workspace_id, user_id)
        if not membership:
            return {"error": "Unauthorized: user does not belong to workspace."}

        user_role = Role(membership.role)
        if not check_role_permission(user_role, tool.required_permission):
            return {
                "error": f"Permission denied. Role '{user_role.value}' lacks permission '{tool.required_permission.value}'."
            }

        try:
            validated_args = tool.args_schema(**arguments)
        except Exception as e:
            return {"error": f"Invalid tool arguments: {str(e)}"}

        # APPROVAL GATE: Medium and High risk actions are staged as PENDING
        if tool.risk_level in [RiskLevel.MEDIUM, RiskLevel.HIGH]:
            approval = Approval(
                workspace_id=workspace_id,
                agent_run_id=agent_run_id,
                action_type=tool.name,
                action_payload=json.dumps(validated_args.model_dump()),
                risk_level=tool.risk_level.value,
                status=ApprovalStatus.PENDING.value,
                requested_by_agent=requested_by_agent,
                explanation=f"AI proposed action '{tool.name}' ({tool.risk_level.value} risk). Requires human authorization.",
            )
            db.add(approval)
            db.commit()
            db.refresh(approval)

            from app.services.notification_service import create_notification
            create_notification(
                db=db,
                workspace_id=workspace_id,
                type="AI_APPROVAL_PENDING",
                severity="WARNING" if tool.risk_level == RiskLevel.HIGH else "INFO",
                title=f"AI Action Requires Approval: {tool.name}",
                message=f"Agent '{requested_by_agent}' proposed '{tool.name}' ({tool.risk_level.value} risk).",
                link="/ai-manager",
                resource_type="approval",
                resource_id=approval.id,
                event_key=f"APPROVAL:{approval.id}",
            )

            tool_call = AIToolCall(
                agent_run_id=agent_run_id,
                tool_name=tool.name,
                arguments_json=json.dumps(validated_args.model_dump()),
                result_json=json.dumps({"approval_id": approval.id, "status": "AWAITING_APPROVAL"}),
                risk_level=tool.risk_level.value,
                is_error=False,
            )
            db.add(tool_call)
            db.commit()

            return {
                "requires_approval": True,
                "approval_id": approval.id,
                "risk_level": tool.risk_level.value,
                "action": tool.name,
                "payload": validated_args.model_dump(),
                "message": f"Action '{tool.name}' requires explicit human approval before execution.",
            }

        # LOW RISK -> Direct execution
        try:
            result = tool.handler(db, workspace_id, user_id, validated_args)
            tool_call = AIToolCall(
                agent_run_id=agent_run_id,
                tool_name=tool.name,
                arguments_json=json.dumps(validated_args.model_dump()),
                result_json=json.dumps(result),
                risk_level=tool.risk_level.value,
                is_error=False,
            )
            db.add(tool_call)
            db.commit()
            return {"success": True, "result": result}
        except Exception as err:
            logger.error(f"Error executing tool {tool.name}: {str(err)}", exc_info=True)
            tool_call = AIToolCall(
                agent_run_id=agent_run_id,
                tool_name=tool.name,
                arguments_json=json.dumps(validated_args.model_dump()),
                result_json=json.dumps({"error": str(err)}),
                risk_level=tool.risk_level.value,
                is_error=True,
            )
            db.add(tool_call)
            db.commit()
            return {"error": str(err)}


# Global Tool Registry Singleton
ai_tool_registry = AIToolRegistry()
