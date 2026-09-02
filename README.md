# StartupAI Manager — AI Startup Operating System

A production-grade, secure, multi-tenant AI Startup Management Platform designed as an intelligent operating system for founders, startup leadership, and engineering teams.

---

## Key Features

* **Multi-Tenant Workspaces**: Zero-trust multi-tenancy with complete isolation across workspaces. Every single database query strictly filters by `workspace_id` to eliminate IDOR and data leakage. Unauthorized cross-tenant queries return `404 Not Found` to prevent resource enumeration.
* **Role-Based Access Control (RBAC)**: Enforced server-side with granular permissions across 5 roles: `OWNER`, `ADMIN`, `MANAGER`, `TEAM_MEMBER`, and `VIEWER`.
* **Persistent Session Revocation**: Session identifiers (`token_jti`), refresh token hashes, client IP, and revocation timestamps stored persistently in PostgreSQL (`UserSession`). Immediate multi-instance revocation without reliance on volatile memory.
* **Executive Command Center**: Centralized founder cockpit synthesizing Tasks, Burn Rate, Runway, CAC, SWOT, and active Risks into a single real-time dashboard.
* **Deterministic Startup Health Score**: Mathematical composite index (0–100) combining Delivery Health (40%), Runway Safety (35%), and Risk Index (25%) with transparent missing data limitations.
* **AI Telemetry & Observability Pipeline**: Granular tracking of multi-agent executions, token consumption, blended LLM cost, latency breakdowns (avg, min, max), and tool failure rates with indexed database aggregations.
* **In-App Notification Engine**: Idempotent alerts for pending AI approvals, critical risks, budget overruns, and task assignments with 24-hour duplicate prevention.
* **Human-in-the-Loop AI Approvals**: Dashboard action cards routing AI mutations strictly through role-verified approval gates.
* **Specialized Multi-Agent Core**: Coordinated domain agents for Finance (burn rate & runway calculations), Marketing (CTR, CVR, CAC), Research (SWOT matrix & prompt defense), and Risk Detection (Likelihood × Impact scoring & signal scanner).
* **Project Management & Kanban**: 4-column Kanban board, XSS-sanitized comments, and append-only audit history.

---

## Technology Stack

### Frontend
* **React 18** + **TypeScript**
* **Vite**
* **Tailwind CSS**
* **TanStack Query**
* **React Router 6**
* **Lucide React** Icons

### Backend
* **Python 3.13** + **FastAPI**
* **SQLAlchemy 2.0** + **Alembic**
* **Pydantic v2** (`extra="forbid"`)
* **Argon2-cffi** & **PyJWT**
* **PostgreSQL 16** (Production) / **SQLite** (Local & Tests)
* **Redis 7** (Optional Session Accelerator / Cache)

---

## Local Development Setup

### 1. Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run database migrations
python -m alembic upgrade head

# 5. Start development server
uvicorn app.main:app --reload --port 8000
```

- Backend API: `http://localhost:8000`
- Swagger Documentation: `http://localhost:8000/docs`
- Health Probe: `http://localhost:8000/health`
- Readiness Probe: `http://localhost:8000/ready`

### 2. Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

- Frontend Application: `http://localhost:5173`

---

## Docker Container Deployment

The platform provides a hardened container deployment via `docker-compose.yml`:

```bash
# 1. Configure environment variables
cp .env.example .env

# 2. Build and run containers in background
docker compose build
docker compose up -d

# 3. Check container logs
docker compose logs -f

# 4. Gracefully stop containers
docker compose down
```

### Persistent Volumes
- `postgres_data`: Persistent storage for PostgreSQL databases.
- `redis_data`: Persistent cache and session acceleration storage.

---

## Recommended Production Architecture

```
                      INTERNET
                         │
                         ▼
             ┌───────────────────────┐
             │ HTTPS / Reverse Proxy │ (Cloudflare / AWS ALB / Nginx)
             │ TLS 1.3 Termination   │
             └───────────┬───────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ Frontend (Nginx 1.27) │ (Static SPA Assets on Port 80)
             └───────────┬───────────┘
                         │ /api/ reverse proxy
                         ▼
             ┌───────────────────────┐
             │ FastAPI Backend App   │ (Non-root user, Port 8000)
             └───────┬───────┬───────┘
                     │       │
      Internal SQL   │       │ External HTTPS
                     ▼       ▼
       ┌────────────────┐ ┌───────────────────┐
       │ PostgreSQL 16  │ │ External AI LLMs  │
       │ Internal Net   │ │ (Gemini / OpenAI) │
       └────────────────┘ └───────────────────┘
```

> **DevSecOps Rules**:
> - Never expose PostgreSQL or Redis ports to the public internet.
> - Never include real API keys or database passwords in the frontend bundle.
> - Ensure `SECRET_KEY` in production is at least 32 characters long.

---

## Automated Testing & Security Verification

Run the complete test suite (Unit, Integration, Security, and 10-Journey E2E):

```powershell
python -m pytest backend/tests -v
```

### Test Coverage Highlights:
- **55 Total Tests (100% Passed)**
- **Authentication**: Argon2id hashing, short password rejection, token rotation, session revocation.
- **Security Penetration Suite**:
  - Prompt injection delimiter breakout (`</USER_QUERY>`, `<SYSTEM_DIRECTIVE>`).
  - Jailbreak neutralization (DAN mode, safety override triggers).
  - Stored XSS defense across 6 domain entities.
  - Mass assignment parameter pollution (`extra="forbid"` on schemas).
  - JWT `alg=none` and tampered signature rejection.
  - OWASP headers verification (`nosniff`, `DENY`, `strict-origin`, CSP).
  - Sliding-window rate limiting burst verification (HTTP 429 and `Retry-After: 60`).
  - Production secret entropy guard.
- **End-to-End User Journeys**: Full 10-journey test verifying registration, login, workspace creation, projects, Kanban tasks, AI chat, specialized domain agents, human approval gates, executive dashboard, in-app notifications, and logout.

---

## Operational Documentation

- **Final Project Report**: [`FINAL_PROJECT_REPORT.md`](file:///e:/StartupAI%20Manager/FINAL_PROJECT_REPORT.md)
- **Production Readiness Checklist**: [`PRODUCTION_READINESS.md`](file:///e:/StartupAI%20Manager/PRODUCTION_READINESS.md)
- **Backup & Disaster Recovery Runbook**: [`BACKUP_AND_RECOVERY.md`](file:///e:/StartupAI%20Manager/BACKUP_AND_RECOVERY.md)
- **Security Audit & Hardening Matrix**: [`SECURITY_AUDIT.md`](file:///e:/StartupAI%20Manager/SECURITY_AUDIT.md)
- **Architecture Walkthrough**: [`walkthrough.md`](file:///C:/Users/Hp/.gemini/antigravity/brain/1484265b-0fb9-4508-b474-93cf26f35510/walkthrough.md)
