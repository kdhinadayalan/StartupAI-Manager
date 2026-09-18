# StartupAI Manager — Developer & Contributor Guide

**Target Version**: `1.0.0-production`  
**Audience**: Software Engineers, Technical Contributors, Security Reviewers  

---

## 1. Architectural Overview & Design Philosophy

StartupAI Manager is constructed around four core architectural tenets:

1. **Deterministic Backend Authority**: High-level semantic reasoning is handled by AI agents, but all critical business calculations (cash burn, runway estimation, risk scoring, health scores, and task state changes) are implemented mathematically in Python services.
2. **Zero-Trust Multi-Tenancy**: All domain tables contain a `workspace_id` foreign key. Cross-tenant access is blocked at the service layer and returns `404 Not Found` to eliminate resource enumeration.
3. **Persistent Session Revocation**: Session validity is tracked in a PostgreSQL `UserSession` table using cryptographically random JTI identifiers. Revocations apply immediately across all instances without reliance on memory.
4. **Sandboxed AI Tools with Human-in-the-Loop**: AI agents interact with the application strictly through validated tools registered in `registry.py`. High-risk mutations (deleting projects, altering finances) trigger human approval workflows.

---

## 2. Local Development Setup

### System Prerequisites
- **Python**: `3.13` or `3.11+`
- **Node.js**: `18.x` or `20.x` LTS
- **Git**: `2.30+`

### Step-by-Step Environment Initialization

```bash
# 1. Clone repository
git clone https://github.com/kdhinadayalan/StartupAI-Manager.git
cd StartupAI-Manager

# 2. Setup Backend Virtual Environment
cd backend
python -m venv venv

# Windows PowerShell:
venv\Scripts\activate
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run initial database migrations
python -m alembic upgrade head

# 3. Setup Frontend
cd ../frontend
npm install
```

---

## 3. Running Development Servers

### Terminal 1: FastAPI Backend
```powershell
cd "e:\StartupAI Manager\backend"
python -m uvicorn app.main:app --reload --port 8000
```
- API Base: `http://localhost:8000`
- Interactive OpenAPI / Swagger Docs: `http://localhost:8000/docs`
- Health Liveness: `http://localhost:8000/health`
- Database Readiness: `http://localhost:8000/ready`

### Terminal 2: React Frontend
```powershell
cd "e:\StartupAI Manager\frontend"
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 4. Backend Development Standards

### Folder Organization (`backend/app/`)
- `agents/`: AI agent implementations, Manager orchestrator, and prompt defense engine.
- `api/`: FastAPI route controllers (`api/v1/`) and dependency injection providers (`deps.py`).
- `core/`: Cross-cutting config, security utilities, permissions, and middleware.
- `database/`: SQLAlchemy engine, session maker, and declarative base.
- `models/`: SQLAlchemy database entity models.
- `schemas/`: Pydantic request/response validation schemas.
- `services/`: Transactional business logic and deterministic computation engines.
- `tools/`: AI tool registry and sandboxed executors.

### Coding Rules & Conventions
1. **Strict Request Schemas (`extra="forbid"`)**: All incoming Pydantic request models must specify:
   ```python
   model_config = ConfigDict(extra="forbid")
   ```
   This prevents mass-assignment and unexpected parameter injection attacks.
2. **HTML Sanitization on Stored Text**: All user-provided freeform strings (descriptions, titles, comments) must be sanitized before storage using `html.escape()` in the service layer:
   ```python
   import html
   clean_title = html.escape(title.strip())
   ```
3. **Explicit Workspace Filtering**: Every database query on multi-tenant tables must include `Model.workspace_id == workspace_id`.
4. **Anti-Enumeration Responses**: When a resource does not exist or belongs to another workspace, raise:
   ```python
   raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found or access denied.")
   ```

---

## 5. Database Development & Alembic Migrations

### Creating a New Database Model
1. Define model in `backend/app/models/<module>.py` inheriting from `app.database.base.Base`.
2. Register the model in `backend/app/models/__init__.py`.
3. Generate a new migration:
   ```bash
   python -m alembic revision --autogenerate -m "add_<module>_table"
   ```
4. Review the generated script in `backend/alembic/versions/`.
5. Apply the migration:
   ```bash
   python -m alembic upgrade head
   ```

### Rolling Back Migrations
```bash
python -m alembic downgrade -1
```

---

## 6. How to Add a New AI Specialist Agent

To add a new domain agent (e.g., `HR_AGENT`):

1. **Create the Agent File (`backend/app/agents/hr_agent.py`)**:
   ```python
   from typing import Any, Dict, List
   from app.agents.provider import AIProvider

   class HRAgent:
       def __init__(self, provider: AIProvider):
           self.provider = provider
           self.system_prompt = (
               "You are the StartupAI HR & Talent Specialist Agent. "
               "Analyze hiring pipelines and team capacity."
           )

       def analyze_capacity(self, team_data: Dict[str, Any]) -> str:
           return self.provider.generate(
               prompt=f"Assess hiring needs: {team_data}",
               system_instruction=self.system_prompt,
           )
   ```
2. **Register the Specialist in `backend/app/agents/orchestrator.py`**:
   - Instantiate `HRAgent` inside `AgentOrchestrator.__init__()`.
   - Add routing keyword rules in `_determine_plan()`.
3. **Expose Tools in `backend/app/tools/registry.py`** if the agent needs to query or mutate database state.

---

## 7. How to Add a New AI Tool

To register a new tool accessible to AI agents:

1. **Define the Tool Argument Schema in `backend/app/tools/registry.py`**:
   ```python
   class CreateJobOpeningSchema(BaseModel):
       model_config = ConfigDict(extra="forbid")
       title: str = Field(..., min_length=2)
       department: str = Field(..., min_length=2)
   ```
2. **Implement the Tool Function**:
   ```python
   def tool_create_job_opening(db: Session, workspace_id: str, user_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
       # Call underlying service function
       return {"job_id": "...", "status": "CREATED"}
   ```
3. **Register the Tool in `AIToolRegistry`**:
   ```python
   registry.register(
       name="create_job_opening",
       description="Create a new job opening for the startup.",
       schema=CreateJobOpeningSchema,
       required_permission=Permission.TEAM_MANAGE,
       risk_level="MEDIUM", # "LOW", "MEDIUM", or "HIGH"
       handler=tool_create_job_opening,
   )
   ```

---

## 8. Frontend Development Standards

### Adding a New Page View
1. Create page component in `frontend/src/pages/<module>/<Module>Page.tsx`.
2. Wrap workspace-dependent views with `<EmptyWorkspaceState />` when `!currentWorkspace`:
   ```tsx
   if (!currentWorkspace) {
     return <EmptyWorkspaceState title="No Workspace Active" description="..." />;
   }
   ```
3. Register the route in `frontend/src/App.tsx` inside the protected `<AppLayout />` parent:
   ```tsx
   <Route path="/talent" element={<TalentPage />} />
   ```
4. Add the navigation item in `frontend/src/components/layout/Sidebar.tsx`.

---

## 9. Automated Testing Guidelines

Run tests locally before submitting any pull request:

```powershell
# Run full test suite with verbose output
python -m pytest backend/tests -v

# Run only security penetration tests
python -m pytest backend/tests/security -v

# Run frontend production compile check
cd frontend
npm.cmd run build
```

### Pull Request Checklist
- [ ] All 55 existing tests pass with 0 errors.
- [ ] New service logic includes corresponding unit/integration tests in `backend/tests/`.
- [ ] Frontend compiles with 0 TypeScript errors (`tsc && vite build`).
- [ ] No hardcoded passwords, API keys, or secret tokens are present in any file.
- [ ] Modified database schemas include a clean Alembic migration.
