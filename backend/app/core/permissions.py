from enum import Enum
from typing import Dict, Set


class Role(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    TEAM_MEMBER = "TEAM_MEMBER"
    VIEWER = "VIEWER"


class Permission(str, Enum):
    # Workspace & Members
    WORKSPACE_READ = "workspace:read"
    WORKSPACE_UPDATE = "workspace:update"
    WORKSPACE_DELETE = "workspace:delete"
    MEMBER_INVITE = "member:invite"
    MEMBER_UPDATE_ROLE = "member:update_role"
    MEMBER_REMOVE = "member:remove"

    # Projects
    PROJECT_CREATE = "project:create"
    PROJECT_READ = "project:read"
    PROJECT_UPDATE = "project:update"
    PROJECT_DELETE = "project:delete"

    # Tasks
    TASK_CREATE = "task:create"
    TASK_READ = "task:read"
    TASK_UPDATE = "task:update"
    TASK_DELETE = "task:delete"
    TASK_COMMENT = "task:comment"

    # Finance
    FINANCE_READ = "finance:read"
    FINANCE_CREATE = "finance:create"
    FINANCE_UPDATE = "finance:update"
    FINANCE_DELETE = "finance:delete"

    # Marketing & Research
    MARKETING_READ = "marketing:read"
    MARKETING_MANAGE = "marketing:manage"
    RESEARCH_READ = "research:read"
    RESEARCH_MANAGE = "research:manage"

    # Risks & Reports
    RISK_READ = "risk:read"
    RISK_MANAGE = "risk:manage"
    REPORT_READ = "report:read"
    REPORT_GENERATE = "report:generate"

    # AI & Approvals
    AI_QUERY = "ai:query"
    AI_APPROVE_MEDIUM = "ai:approve_medium"
    AI_APPROVE_HIGH = "ai:approve_high"
    AI_MONITORING_READ = "ai:monitoring_read"

    # Notifications & Dashboard
    NOTIFICATION_READ = "notification:read"
    NOTIFICATION_MANAGE = "notification:manage"
    DASHBOARD_READ = "dashboard:read"

    # Audit & System
    AUDIT_READ = "audit:read"


# Strict Role-Based Permissions Matrix
ROLE_PERMISSIONS: Dict[Role, Set[Permission]] = {
    Role.OWNER: set(Permission),  # Owners have all permissions
    Role.ADMIN: {
        Permission.WORKSPACE_READ,
        Permission.WORKSPACE_UPDATE,
        Permission.MEMBER_INVITE,
        Permission.MEMBER_UPDATE_ROLE,
        Permission.MEMBER_REMOVE,
        Permission.PROJECT_CREATE,
        Permission.PROJECT_READ,
        Permission.PROJECT_UPDATE,
        Permission.PROJECT_DELETE,
        Permission.TASK_CREATE,
        Permission.TASK_READ,
        Permission.TASK_UPDATE,
        Permission.TASK_DELETE,
        Permission.TASK_COMMENT,
        Permission.FINANCE_READ,
        Permission.FINANCE_CREATE,
        Permission.FINANCE_UPDATE,
        Permission.MARKETING_READ,
        Permission.MARKETING_MANAGE,
        Permission.RESEARCH_READ,
        Permission.RESEARCH_MANAGE,
        Permission.RISK_READ,
        Permission.RISK_MANAGE,
        Permission.REPORT_READ,
        Permission.REPORT_GENERATE,
        Permission.AI_QUERY,
        Permission.AI_APPROVE_MEDIUM,
        Permission.AI_APPROVE_HIGH,
        Permission.AI_MONITORING_READ,
        Permission.NOTIFICATION_READ,
        Permission.NOTIFICATION_MANAGE,
        Permission.DASHBOARD_READ,
        Permission.AUDIT_READ,
    },
    Role.MANAGER: {
        Permission.WORKSPACE_READ,
        Permission.PROJECT_CREATE,
        Permission.PROJECT_READ,
        Permission.PROJECT_UPDATE,
        Permission.TASK_CREATE,
        Permission.TASK_READ,
        Permission.TASK_UPDATE,
        Permission.TASK_DELETE,
        Permission.TASK_COMMENT,
        Permission.FINANCE_READ,
        Permission.MARKETING_READ,
        Permission.MARKETING_MANAGE,
        Permission.RESEARCH_READ,
        Permission.RESEARCH_MANAGE,
        Permission.RISK_READ,
        Permission.RISK_MANAGE,
        Permission.REPORT_READ,
        Permission.REPORT_GENERATE,
        Permission.AI_QUERY,
        Permission.AI_APPROVE_MEDIUM,
        Permission.AI_MONITORING_READ,
        Permission.NOTIFICATION_READ,
        Permission.NOTIFICATION_MANAGE,
        Permission.DASHBOARD_READ,
    },
    Role.TEAM_MEMBER: {
        Permission.WORKSPACE_READ,
        Permission.PROJECT_READ,
        Permission.TASK_READ,
        Permission.TASK_UPDATE,
        Permission.TASK_COMMENT,
        Permission.FINANCE_READ,
        Permission.MARKETING_READ,
        Permission.RESEARCH_READ,
        Permission.RISK_READ,
        Permission.REPORT_READ,
        Permission.AI_QUERY,
        Permission.NOTIFICATION_READ,
        Permission.NOTIFICATION_MANAGE,
        Permission.DASHBOARD_READ,
    },
    Role.VIEWER: {
        Permission.WORKSPACE_READ,
        Permission.PROJECT_READ,
        Permission.TASK_READ,
        Permission.FINANCE_READ,
        Permission.MARKETING_READ,
        Permission.RESEARCH_READ,
        Permission.RISK_READ,
        Permission.REPORT_READ,
        Permission.NOTIFICATION_READ,
        Permission.DASHBOARD_READ,
    },
}


def check_role_permission(role: Role, permission: Permission) -> bool:
    """Verify if a given role has the requested permission."""
    perms = ROLE_PERMISSIONS.get(role, set())
    return permission in perms
