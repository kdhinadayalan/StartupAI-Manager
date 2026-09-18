# StartupAI Manager — Single-Company AI Management System Migration Plan

**System Target**: Single-Company AI-Powered Management System  
**Version**: `1.0.0-single-company`  
**Status**: Pre-Implementation Audit & Architecture Specification  

---

## 1. Executive Summary & Objective

The objective of this migration is to convert **StartupAI Manager** from a multi-tenant workspace platform into an **AI-Powered Management System for a Single Startup/Company**. 

The application represents **one company**:
```
                  ONE SYSTEM
                      ↓
                 ONE COMPANY
                      ↓
                MULTIPLE USERS
                      ↓
            ROLE-BASED ACCESS (6 ROLES)
                      ↓
             AI-POWERED MANAGEMENT
```

There is **no user-facing company creation or switching workflow** in the normal UI. All users belong to the single company, and access is governed by the 6-tier role hierarchy:
`OWNER > ADMIN > TEAM_LEAD > MANAGER > TEAM_MEMBER > VIEWER`

---

## 2. Architecture & Data Model Preservation

To ensure backward compatibility and avoid breaking database relationships:
- The existing `workspaces` table is retained internally as the single **Company** entity.
- The single company record is created during initial setup/bootstrap.
- Foreign keys (`workspace_id`) across `projects`, `tasks`, `expenses`, `budgets`, `risk_items`, `ai_agent_runs`, `notifications`, etc., remain intact and point to the single company.
- Normal users cannot create additional companies or switch companies.

---

## 3. Role Hierarchy & Permission Matrix

The 6-tier company role structure:

| Role | Hierarchy Level | Primary Responsibilities | Key Access Permissions |
|---|:---:|---|---|
| **`OWNER`** | 1 (Highest) | Founder / CEO with full company control | Full access: all modules, team role assignments, company settings, permanent deletion, AI approvals, audit vault. |
| **`ADMIN`** | 2 | Operations & Administration Lead | Project, task, finance, marketing, risk management, user invitations, AI approvals, reporting. Cannot delete company or demote Owner. |
| **`TEAM_LEAD`** | 3 (New) | Engineering / Functional Team Lead | Manage team tasks, assign tasks, monitor team progress, view projects, add comments, view team reports, AI Assistant. |
| **`MANAGER`** | 4 | Project / Milestone Manager | Manage projects and tasks, assign work, view operational reports, AI Assistant, review medium-risk approvals. |
| **`TEAM_MEMBER`**| 5 | Individual Contributor / Engineer | View assigned projects, create/update tasks, add comments, notifications, use permitted AI Assistant. |
| **`VIEWER`** | 6 | External Advisor / Read-Only Stakeholder | Read-only access: Executive Dashboard, projects, tasks, reports, analytics. No write, no user admin, no AI approval. |

---

## 4. Authentication & Bootstrap Flow

### Single Login Page
- All users log in via `/login` using **Email** and **Password**.
- The role is **never selected by the user**; it is resolved server-side from the user's company membership.

### Bootstrap / Initial Setup
1. **First-Time Setup**:
   - When the system is initialized and no company exists, the first registered user creates the single company and automatically becomes `OWNER`.
2. **Subsequent Registrations**:
   - Once the company is initialized, public registration cannot create new companies and cannot assign `OWNER`.
   - New users are added via company user invitations by `OWNER` or `ADMIN`, or assigned the default `TEAM_MEMBER` role.

---

## 5. Frontend Transformation

1. **Remove Multi-Company Dropdowns & Switchers**:
   - Remove `WorkspaceSelector` dropdown from `Navbar.tsx`.
   - Replace with a static, elegant company brand display:
     `[ Building2 icon ] {currentCompany.name} [ RoleBadge ({currentRole}) ]`
2. **Remove "Create Workspace" UI**:
   - Remove `CreateWorkspaceModal.tsx` from `AppLayout.tsx`.
   - Remove all empty-state prompts asking the user to "+ Create Startup Workspace".
3. **Role-Based Navigation (`Sidebar.tsx`)**:
   - Configure dynamic navigation filtering across all 6 roles (`OWNER`, `ADMIN`, `TEAM_LEAD`, `MANAGER`, `TEAM_MEMBER`, `VIEWER`).
4. **Team Management (`TeamPage.tsx`)**:
   - Add `TEAM_LEAD` to the invitation and role assignment interface.

---

## 6. Migration Sequence

```
Phase 1: Backend Roles & Permissions Update (Add TEAM_LEAD, update ROLE_PERMISSIONS)
   ↓
Phase 2: Single-Company Logic & Bootstrap Flow (workspace_service.py, auth_service.py)
   ↓
Phase 3: Frontend Types & Single-Company Context (auth.ts, WorkspaceContext.tsx)
   ↓
Phase 4: Navigation & UI Overhaul (Navbar.tsx, Sidebar.tsx, AppLayout.tsx, TeamPage.tsx)
   ↓
Phase 5: Automated Testing & Verification (Pytest 60+ tests, build check)
   ↓
Phase 6: Comprehensive Documentation Update (README, API reference, Architecture)
   ↓
Phase 7: Final Migration Report (SINGLE_COMPANY_MIGRATION_REPORT.md)
```
