# StartupAI Manager — Complete API Reference Manual

**Base URL**: `http://localhost:8000/api/v1`  
**API Documentation (Interactive OpenAPI)**: `http://localhost:8000/docs`  
**Standard Response Format**: JSON wrapped in a uniform envelope.

---

## 1. Response Envelope Formats

### Standard Success Envelope
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... }
}
```

### Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Descriptive human-readable error.",
    "details": []
  }
}
```

---

## 2. Health & System Probes

### Liveness Probe
- **Method**: `GET`
- **Path**: `/health` (or `/`)
- **Authentication**: None
- **Response Status**: `200 OK`
```json
{
  "status": "healthy",
  "project": "StartupAI Manager",
  "environment": "development",
  "version": "1.0.0"
}
```

### Readiness Probe
- **Method**: `GET`
- **Path**: `/ready`
- **Authentication**: None
- **Response Status**: `200 OK` (or `503 Service Unavailable` if database is unreachable)
```json
{
  "status": "ready",
  "database": "connected",
  "environment": "development"
}
```

---

## 3. Authentication Endpoints (`/api/v1/auth`)

### Register User
- **Method**: `POST /auth/register`
- **Request Body**:
```json
{
  "email": "founder@startup.io",
  "password": "SecurePassword2026!",
  "full_name": "Elena Rostova"
}
```
- **Response Status**: `201 Created`

### Login & Session Creation
- **Method**: `POST /auth/login`
- **Request Body**:
```json
{
  "email": "founder@startup.io",
  "password": "SecurePassword2026!"
}
```
- **Response Status**: `200 OK`
- **Response Data**:
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "c7a8b4...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": { "id": "uuid", "email": "founder@startup.io", "full_name": "Elena Rostova" }
}
```

### Refresh Token Rotation
- **Method**: `POST /auth/refresh`
- **Request Body**: `{ "refresh_token": "c7a8b4..." }`
- **Response Status**: `200 OK` (Rotates and invalidates previous session JTI).

### Logout Current Session
- **Method**: `POST /auth/logout`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Status**: `200 OK` (Marks session JTI as revoked in database).

### Logout All Sessions
- **Method**: `POST /auth/logout-all`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Status**: `200 OK` (Revokes all active sessions for current user).

### Get Current Profile
- **Method**: `GET /auth/me`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Status**: `200 OK`

---

## 4. Company Workspace Endpoints (`/api/v1/workspaces`)

### Get Current Company Workspace
- **Method**: `GET /workspaces/current`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Status**: `200 OK` (or `404 Not Found` if uninitialized or non-member)

### List User Workspaces
- **Method**: `GET /workspaces`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response Status**: `200 OK` (Returns the single active company if member, or empty list)

### Initialize Single Company Workspace (Bootstrap)
- **Method**: `POST /workspaces`
- **Headers**: `Authorization: Bearer <access_token>`
- **Behavior**: Initial user bootstrap creates the single company workspace and becomes `OWNER`. If a company workspace already exists, returns `400 Bad Request: "Single-company system: A company workspace already exists."`.
- **Request Body**:
```json
{
  "name": "Nexus AI",
  "industry": "Artificial Intelligence",
  "currency": "USD",
  "description": "Autonomous AI Startup Operating System"
}
```
- **Response Status**: `201 Created`

### List Company Members
- **Method**: `GET /workspaces/{workspace_id}/members`
- **Response Status**: `200 OK`

### Invite Company Member
- **Method**: `POST /workspaces/{workspace_id}/members`
- **Role Requirement**: `OWNER` or `ADMIN`
- **Privilege Guards**:
  - `OWNER` cannot be assigned via invite (initial user is the `OWNER`).
  - Only `OWNER` can assign or invite `ADMIN` role.
  - Allowed roles: `ADMIN`, `TEAM_LEAD`, `MANAGER`, `TEAM_MEMBER`, `VIEWER`.
- **Request Body**:
```json
{
  "email": "engineer@startup.io",
  "role": "TEAM_LEAD"
}
```
- **Response Status**: `201 Created`

---

## 5. Project Endpoints (`/api/v1/workspaces/{workspace_id}/projects`)

### List Projects
- **Method**: `GET /workspaces/{workspace_id}/projects`
- **Query Params**: `status` (optional), `search` (optional)
- **Response Status**: `200 OK`

### Create Project
- **Method**: `POST /workspaces/{workspace_id}/projects`
- **Role Requirement**: `OWNER`, `ADMIN`, or `MANAGER`
- **Request Body**:
```json
{
  "name": "Autonomous Inference Engine",
  "description": "Sub-50ms inference streaming API",
  "status": "ACTIVE",
  "priority": "HIGH",
  "budget": 50000.0,
  "deadline": "2026-12-31T00:00:00Z"
}
```
- **Response Status**: `201 Created`

### Delete Project
- **Method**: `DELETE /workspaces/{workspace_id}/projects/{project_id}`
- **Role Requirement**: `OWNER` or `ADMIN`
- **Response Status**: `200 OK`

---

## 6. Task & Kanban Endpoints (`/api/v1/workspaces/{workspace_id}/tasks`)

### List Tasks
- **Method**: `GET /workspaces/{workspace_id}/tasks`
- **Query Params**: `project_id` (optional), `status` (optional), `assignee_id` (optional)
- **Response Status**: `200 OK`

### Create Task
- **Method**: `POST /workspaces/{workspace_id}/tasks`
- **Role Requirement**: `TEAM_MEMBER` or above
- **Request Body**:
```json
{
  "project_id": "uuid",
  "title": "Benchmark streaming inference latency",
  "description": "Run load tests against WebSocket endpoint",
  "status": "TODO",
  "priority": "HIGH",
  "assignee_id": "uuid"
}
```
- **Response Status**: `201 Created`

### Transition Kanban Status
- **Method**: `PATCH /workspaces/{workspace_id}/tasks/{task_id}/status`
- **Request Body**: `{ "status": "IN_PROGRESS" }`
- **Valid Transitions**: `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`
- **Response Status**: `200 OK` (Generates automated `TaskHistory` audit log).

### Add Task Comment
- **Method**: `POST /workspaces/{workspace_id}/tasks/{task_id}/comments`
- **Request Body**: `{ "content": "Benchmark verified under 45ms P99." }`
- **Response Status**: `201 Created` (Input is sanitized via `html.escape`).

### Get Task Activity History
- **Method**: `GET /workspaces/{workspace_id}/tasks/{task_id}/history`
- **Response Status**: `200 OK`

---

## 7. AI Orchestration & Approvals (`/api/v1/workspaces/{workspace_id}/ai`)

### Chat with Manager Agent
- **Method**: `POST /workspaces/{workspace_id}/ai/chat`
- **Request Body**: `{ "message": "Summarize our financial runway and active operational risks." }`
- **Response Status**: `200 OK`
- **Response Data**:
```json
{
  "response": "Based on our latest metrics...",
  "agent_used": "MANAGER",
  "tools_executed": ["get_cash_runway", "list_risks"],
  "staged_approvals": []
}
```

### List Pending AI Approvals
- **Method**: `GET /workspaces/{workspace_id}/ai/approvals`
- **Role Requirement**: `MANAGER` or above
- **Response Status**: `200 OK`

### Approve AI Action
- **Method**: `POST /workspaces/{workspace_id}/ai/approvals/{approval_id}/approve`
- **Role Requirement**: `OWNER`, `ADMIN`, or `MANAGER`
- **Response Status**: `200 OK` (Executes the tool with approving user's context).

### Reject AI Action
- **Method**: `POST /workspaces/{workspace_id}/ai/approvals/{approval_id}/reject`
- **Role Requirement**: `OWNER`, `ADMIN`, or `MANAGER`
- **Request Body**: `{ "reason": "Not approved in current budget cycle." }`
- **Response Status**: `200 OK`

---

## 8. Finance Endpoints (`/api/v1/workspaces/{workspace_id}/finance`)

### Get Treasury Balance
- **Method**: `GET /workspaces/{workspace_id}/finance/account`
- **Response Status**: `200 OK`

### Update Cash Balance
- **Method**: `POST /workspaces/{workspace_id}/finance/account`
- **Role Requirement**: `OWNER` or `ADMIN`
- **Request Body**: `{ "balance": 350000.0, "currency": "USD" }`
- **Response Status**: `200 OK`

### Record Expense
- **Method**: `POST /workspaces/{workspace_id}/finance/expenses`
- **Request Body**:
```json
{
  "title": "Cloud Quantum Cluster Rental",
  "amount": 15000.0,
  "category": "R&D",
  "expense_date": "2026-09-01T00:00:00Z"
}
```
- **Response Status**: `201 Created`

### Calculate Cash Runway
- **Method**: `GET /workspaces/{workspace_id}/finance/runway`
- **Response Status**: `200 OK`
- **Response Data**:
```json
{
  "has_cash_data": true,
  "available_cash": 350000.0,
  "monthly_burn_rate": 15000.0,
  "runway_months": 23.3,
  "currency": "USD"
}
```

---

## 9. Risk Endpoints (`/api/v1/workspaces/{workspace_id}/risks`)

### Create Risk Item
- **Method**: `POST /workspaces/{workspace_id}/risks`
- **Request Body**:
```json
{
  "title": "GPU Cluster Quota Limitation",
  "likelihood": 4,
  "impact": 4,
  "category": "OPERATIONAL"
}
```
- **Response Status**: `201 Created`
- **Calculated Fields**: `risk_score: 16`, `severity: "HIGH"`.

### Run Automated Risk Scanner
- **Method**: `POST /workspaces/{workspace_id}/risks/scan`
- **Response Status**: `200 OK` (Scans task deadlines and budget overruns).

---

## 10. Dashboard & Notifications (`/api/v1/workspaces/{workspace_id}`)

### Executive Dashboard Summary
- **Method**: `GET /workspaces/{workspace_id}/dashboard/summary`
- **Response Status**: `200 OK`
- **Returns**: Composite Startup Health Score, Delivery Health, Runway Safety, and Risk Index.

### List In-App Notifications
- **Method**: `GET /workspaces/{workspace_id}/notifications`
- **Query Params**: `unread_only=true`, `limit=20`
- **Response Status**: `200 OK`

### Get Unread Badge Count
- **Method**: `GET /workspaces/{workspace_id}/notifications/unread-count`
- **Response Status**: `200 OK`
```json
{
  "unread_count": 3
}
```

### Mark All Notifications Read
- **Method**: `POST /workspaces/{workspace_id}/notifications/read-all`
- **Response Status**: `200 OK`
