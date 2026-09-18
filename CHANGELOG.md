# StartupAI Manager — Engineering Changelog & Release History

All notable changes, architectural milestones, and security enhancements are documented in this file.

The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.1.0-single-company] — 2026-09-06

### Milestone Summary
Architectural conversion of StartupAI Manager to a **Single-Company AI Management System** with 6-tier Role-Based Access Control (`OWNER` > `ADMIN` > `TEAM_LEAD` > `MANAGER` > `TEAM_MEMBER` > `VIEWER`).

### Architectural & Security Changes
- **Single-Company Enforcement**: Enforced single company model across backend and frontend. `POST /workspaces` enforces that only the initial bootstrap creates the single company workspace; subsequent calls to create additional companies are blocked with HTTP 400.
- **6-Tier RBAC Architecture**:
  - Introduced `TEAM_LEAD` role into `Role` enum and `ROLE_PERMISSIONS` matrix in `backend/app/core/permissions.py`.
  - Configured explicit permissions: task creation, assignment, updates, progress monitoring, comments, and reports, while blocking project deletion and financial modifications.
- **Privilege Escalation Defense**:
  - Prevented arbitrary assignment or invitation of `OWNER` role.
  - Restricted `ADMIN` role assignment and removal strictly to the `OWNER`.
  - Prevented non-owners from modifying or demoting `ADMIN` or `OWNER` members.
- **Frontend Overhaul**:
  - Removed multi-workspace switcher dropdown, "Create Workspace", and "Switch Workspace" popups.
  - Introduced static company brand indicator in Navbar with dynamic role badge.
  - Updated `Sidebar.tsx` and `AppLayout.tsx` route guards to accommodate `TEAM_LEAD` role.
  - Enhanced `TeamPage.tsx` with `TEAM_LEAD` support and owner-only privilege controls.
- **Verification Suite**:
  - Added dedicated E2E security test suite (`backend/tests/security/test_single_company_and_roles.py`).
  - Total automated test suite expanded to **63 tests, 100% passing**.

---

## [v1.0.0-production] — 2026-09-03

### Milestone Summary
Complete release of the **StartupAI Manager Production-Grade AI Startup Operating System**, delivering full platform capabilities across 7 engineering phases and post-audit UX enhancements.

---

### Phase 1 — Foundation & Authentication
- **Added**:
  - Argon2id password hashing with memory-hard parameters (`time_cost=3, memory_cost=64MB, parallelism=4`).
  - PyJWT integration for HMAC-SHA256 access and refresh token signing.
  - Persistent `UserSession` model in PostgreSQL tracking cryptographically unique `token_jti` identifiers.
  - Immediate cluster-wide session revocation via `/auth/logout`, `/auth/logout-all`, and password updates.
  - Refresh token rotation with reuse detection.
  - Sliding-window in-memory rate limiting middleware (100 requests/min).
  - Security headers middleware (`nosniff`, `DENY`, strict referrer policy, CSP).

### Phase 2 — Workspaces, Projects & Core Management
- **Added**:
  - Multi-tenant workspace data model with discriminator column isolation (`workspace_id`).
  - Hierarchical Role-Based Access Control (RBAC) supporting `OWNER`, `ADMIN`, `MANAGER`, `TEAM_MEMBER`, and `VIEWER`.
  - Anti-enumeration protection returning HTTP 404 on cross-tenant resource requests.
  - Sole owner protection preventing the last workspace owner from demoting themselves.
  - Project management with status, priority, budget, and deadline tracking.
  - 4-column interactive Kanban task board (`TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`).
  - Immutable, append-only `TaskHistory` audit ledger.
  - HTML sanitization on task comments.

### Phase 3 — AI Core, Manager Agent & Tool Registry
- **Added**:
  - Multi-provider AI abstraction supporting `LocalMockProvider` (offline zero-cost), `GeminiProvider`, and `OpenAIProvider`.
  - `PromptDefenseEngine` filtering jailbreaks, scrubbing credentials, and defanging XML delimiter tags (`</USER_QUERY>`, `<SYSTEM_DIRECTIVE>`).
  - `ManagerAgent` orchestrator for intent decomposition and multi-step plan generation.
  - Sandboxed `AIToolRegistry` mapping tool permissions to user RBAC roles.
  - Risk classification tiers (`LOW`, `MEDIUM`, `HIGH`).
  - Human-in-the-loop approval gatekeeper (`ai_approvals` table) staging mutations for manager authorization.

### Phase 4 — Specialized Domain Agents
- **Added**:
  - `FinanceAgent`: Trailing 30-day burn rate and deterministic cash runway calculations.
  - `MarketingAgent`: Aggregates campaign metrics and computes CTR, CVR, and CAC.
  - `ResearchAgent`: Market intelligence capture and automated 4-quadrant SWOT matrix generation.
  - `RiskAgent`: Deterministic $5 \times 5$ Likelihood $\times$ Impact risk matrix scoring and heuristic deadline/budget scanners.

### Phase 5 — Dashboard, Telemetry & Notifications
- **Added**:
  - Executive Dashboard with composite **Startup Health Score** ($40\%$ Delivery, $35\%$ Runway, $25\%$ Risk).
  - Transparent partial-data resilience handling when financial balances are not yet provided.
  - Telemetry pipeline tracking LLM token counts, execution latency, and tool failure rates.
  - In-app notification engine with 24-hour event deduplication keys (`event_key`).
  - Real-time unread notification badge counter.

### Phase 6 — Security Hardening & Penetration Testing
- **Fixed & Verified**:
  - **SEC-001**: Neutralized prompt injection delimiter breakouts via regex sanitization (`test_prompt_injection_delimiter_breakout_defense`).
  - **SEC-002**: Uniform HTML escaping across descriptions, titles, and comments (`test_stored_xss_sanitization_across_entities`).
  - **SEC-003**: Enforced Pydantic v2 `ConfigDict(extra="forbid")` across all request schemas to block mass assignment (`test_mass_assignment_forbid_extra_fields`).
  - **SEC-004**: Added production startup validation enforcing $\ge 32$-character high-entropy `SECRET_KEY` (`test_production_secret_key_guard`).
  - **SEC-005**: Verified sliding-window rate limiting burst threshold responses (`test_rate_limiting_enforcement`).
  - **SEC-006**: Ensured non-root execution in Docker backend image (`appuser:appgroup` UID 1000).

### Phase 7 — Production Readiness & Deployment Verification
- **Added**:
  - Production-grade PostgreSQL connection pooling (`pool_size=20, max_overflow=10, pool_recycle=1800, pool_pre_ping=True`).
  - Independent `/ready` health probe executing active database connection validation.
  - Comprehensive `.dockerignore` excluding build artifacts, caches, and secrets.
  - Standardized `.env.example` categorized into clear operational sections.
  - Database backup, restore, and disaster recovery runbook (`BACKUP_AND_RECOVERY.md`).
  - Comprehensive 10-journey end-to-end integration test (`test_full_platform_e2e.py`).
  - Verification: **55/55 automated tests passed (100%) in 12.11 seconds**.

### Post-Phase 7 UX Enhancements
- **Enhanced**:
  - Prominent foreground empty-state cards (`EmptyWorkspaceState.tsx`) for workspaces and projects.
  - Lifted workspace and project creation modals to root DOM level with `z-[100]` and `backdrop-blur-md`.
  - Added responsive scroll safety (`overflow-y-auto`, `max-h-[90vh]`) preventing clipping on low-resolution laptop displays.
  - Real-time client validation banners displaying descriptive error messages on missing required fields.
