# StartupAI Manager — Complete System Diagrams

**Version**: `1.0.0-production`  
**Diagram Format**: Mermaid Visual Graphs  

---

## 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Presentation"]
        BROWSER["Web Browser"]
        SPA["React 18 + TypeScript SPA"]
        BROWSER -->|HTTPS| SPA
    end

    subgraph Edge ["Edge & Reverse Proxy"]
        NGINX["Nginx Web Server / Reverse Proxy"]
        SPA -->|API Requests| NGINX
    end

    subgraph Backend ["FastAPI Application Backend (Port 8000)"]
        MID["Security Headers & Rate Limiter"]
        AUTH["JWT & DB Session Validator"]
        RBAC["Zero-Trust RBAC Gatekeeper"]
        ROUTER["API v1 Controllers"]

        NGINX --> MID
        MID --> AUTH
        AUTH --> RBAC
        RBAC --> ROUTER

        subgraph Core_Services ["Deterministic Business Services"]
            WS["Workspace & Project Service"]
            TASK["Task & Kanban Service"]
            FIN["Finance & Burn Rate Engine"]
            RISK["5x5 Risk Scoring Engine"]
            DASH["Startup Health Score Service"]
            NOTIF["Notification Engine"]
        end

        subgraph AI_Core ["Multi-Agent AI Subsystem"]
            MGR["Manager Agent Orchestrator"]
            PROMPT["Prompt Defense & Sanitizer"]
            SPEC["Specialist Agents (Finance, Mktg, Research, Risk)"]
            TOOLS["AI Tool Registry (Risk Tiered)"]
            APP["Human Approval Gatekeeper"]
        end

        ROUTER --> Core_Services
        ROUTER --> AI_Core
        MGR --> PROMPT
        MGR --> SPEC
        SPEC --> TOOLS
        TOOLS --> APP
        APP -->|Approved Mutation| Core_Services
    end

    subgraph Storage ["Persistence Layer"]
        PG[("PostgreSQL 16 Database")]
        REDIS[("Redis 7 Cache")]
        EXT_AI{"External AI Gateways"}
        MODELS["Gemini 1.5 / OpenAI GPT-4o / Local Mock"]

        Core_Services --> PG
        AUTH --> PG
        AUTH -.-> REDIS
        AI_Core --> PG
        AI_Core --> EXT_AI
        EXT_AI --> MODELS
    end
```

---

## 2. Frontend / Backend Architectural Layering

```mermaid
graph TB
    subgraph Frontend_App ["Frontend React SPA"]
        A[React UI Components] --> B[React Query Hooks]
        B --> C[Axios / Fetch API Client]
        C --> D[JWT Session Storage]
    end

    subgraph Backend_App ["Backend FastAPI Service"]
        E[Uvicorn ASGI Server] --> F[Middleware Pipeline]
        F --> G[FastAPI Router Endpoints]
        G --> H[Pydantic Request Schemas]
        H --> I[Business Services Layer]
        I --> J[SQLAlchemy 2.0 ORM]
        J --> K[Connection Pool]
    end

    C -->|HTTP REST JSON| E
    K -->|TCP 5432| L[(PostgreSQL Database)]
```

---

## 3. Database Entity Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o{ USER_SESSIONS : maintains
    USERS ||--o{ WORKSPACE_MEMBERS : holds
    USERS ||--o{ AUDIT_LOGS : generates
    
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : contains
    WORKSPACES ||--o{ PROJECTS : owns
    WORKSPACES ||--o{ TASKS : owns
    WORKSPACES ||--o{ EXPENSES : incurs
    WORKSPACES ||--o{ BUDGETS : establishes
    WORKSPACES ||--o{ FINANCIAL_ACCOUNTS : tracks
    WORKSPACES ||--o{ MARKETING_CAMPAIGNS : runs
    WORKSPACES ||--o{ RESEARCH_ITEMS : compiles
    WORKSPACES ||--o{ RISK_ITEMS : tracks
    WORKSPACES ||--o{ NOTIFICATIONS : receives
    WORKSPACES ||--o{ AI_CONVERSATIONS : stores
    WORKSPACES ||--o{ AI_AGENT_RUNS : executes
    WORKSPACES ||--o{ AI_APPROVALS : gates

    PROJECTS ||--o{ PROJECT_MEMBERS : assigns
    PROJECTS ||--o{ TASKS : contains

    TASKS ||--o{ TASK_COMMENTS : receives
    TASKS ||--o{ TASK_HISTORY : logs

    AI_AGENT_RUNS ||--o{ AI_TOOL_CALLS : triggers
    AI_TOOL_CALLS ||--o{ AI_APPROVALS : requires
```

---

## 4. Authentication & Persistent Session Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as React Client
    participant Auth as Auth Controller
    participant Sec as Security Core
    participant DB as PostgreSQL (UserSession)

    User->>Client: Enters Email & Password
    Client->>Auth: POST /api/v1/auth/login
    Auth->>Sec: Verify Argon2id Password Hash
    Sec-->>Auth: Password Valid
    Auth->>Sec: Generate Unique Session JTI & Tokens
    Auth->>DB: INSERT INTO user_sessions (token_jti, refresh_hash, is_revoked=False)
    DB-->>Auth: Session Committed
    Auth-->>Client: Return Access Token (JWT) & Refresh Token
    Client->>Client: Store Tokens in LocalStorage

    Note over Client,DB: Subsequent Authenticated Requests
    Client->>Auth: GET /api/v1/workspaces (Bearer JWT)
    Auth->>Sec: Decode JWT & Extract token_jti
    Auth->>DB: SELECT is_revoked FROM user_sessions WHERE token_jti = :jti
    alt Session is Valid (is_revoked == False)
        DB-->>Auth: Session Active
        Auth-->>Client: 200 OK with Data
    else Session is Revoked (is_revoked == True)
        DB-->>Auth: Revoked
        Auth-->>Client: 401 Unauthorized (SESSION_REVOKED)
    end
```

---

## 5. User Registration & Login Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Founder
    participant UI as Browser SPA
    participant API as FastAPI Backend
    participant DB as PostgreSQL

    Founder->>UI: Fills Registration Form
    UI->>API: POST /api/v1/auth/register
    API->>API: Validate Password (length >= 8)
    API->>API: Hash Password with Argon2id
    API->>DB: INSERT INTO users (email, hashed_password)
    DB-->>API: User Created
    API-->>UI: 201 Created (User Registered)

    Founder->>UI: Fills Login Form
    UI->>API: POST /api/v1/auth/login
    API->>DB: Query user by email
    API->>API: Verify Argon2id Hash
    API->>DB: Insert new active user_session
    API-->>UI: 200 OK (access_token + refresh_token)
    UI->>UI: Redirect to /dashboard
```

---

## 6. Manager Agent Orchestration Flow

```mermaid
flowchart TD
    START["User Submits Query via AI Chat"] --> DEFENSE["Prompt Defense Engine"]
    DEFENSE --> DEFANG["Neutralize Delimiters & Filter Jailbreaks"]
    DEFANG --> MGR["Manager Agent Orchestrator"]
    MGR --> INTENT{"Analyze Intent & Decompose"}
    
    INTENT -->|Financial Inquiry| FA["Finance Agent"]
    INTENT -->|Marketing Optimization| MA["Marketing Agent"]
    INTENT -->|Market Intelligence| RA["Research Agent"]
    INTENT -->|Operational Uncertainty| RK["Risk Agent"]
    INTENT -->|General Planning| PLAN["Synthesize Direct Plan"]

    FA --> TOOL_REQ["Request Domain Tool Execution"]
    MA --> TOOL_REQ
    RA --> TOOL_REQ
    RK --> TOOL_REQ
    PLAN --> RESP["Format Markdown Response"]

    TOOL_REQ --> REG["AI Tool Registry"]
    REG --> EXEC["Execute Tool Function"]
    EXEC --> RESP
    RESP --> CLIENT["Return Structured Response to User"]
```

---

## 7. AI Tool Execution & Human Approval Workflow

```mermaid
flowchart TD
    AGENT["AI Agent Proposes Tool Execution"] --> REG["AI Tool Registry Lookup"]
    REG --> VAL["Validate Pydantic Schema (extra='forbid')"]
    VAL --> PERM["Check User RBAC Permissions"]
    PERM --> RISK{"Check Tool Risk Classification"}

    RISK -->|LOW Risk (Read-Only)| EXEC["Execute Tool Service Immediately"]
    EXEC --> LOG["Record AIAgentRun & AIToolCall Telemetry"]
    LOG --> RESULT["Return Tool Result to Agent"]

    RISK -->|MEDIUM / HIGH Risk (Mutations)| STAGE["Create Record in ai_approvals (status='PENDING')"]
    STAGE --> NOTIF["Dispatch Notification to Workspace Managers"]
    NOTIF --> HUMAN{"Human Manager Decision"}

    HUMAN -->|APPROVE| RUN_APP["Execute Tool Function with Approver Context"]
    RUN_APP --> AUDIT["Commit Immutable AuditLog"]
    AUDIT --> STATUS_APP["Update Approval status='APPROVED'"]

    HUMAN -->|REJECT| REJ["Record Rejection Reason in ai_approvals"]
    REJ --> STATUS_REJ["Update Approval status='REJECTED'"]
```

---

## 8. Executive Dashboard Data Aggregation Flow

```mermaid
flowchart LR
    REQ["GET /dashboard/summary"] --> SERVICE["Dashboard Service"]
    
    SERVICE --> T1["Tasks Query: Total, Completed, Overdue"]
    SERVICE --> T2["Finance Query: 30-Day Burn Rate, Cash Balance"]
    SERVICE --> T3["Risks Query: 5x5 Matrix Likelihood x Impact"]
    SERVICE --> T4["Approvals Query: Pending AI Actions"]
    SERVICE --> T5["Notifications Query: Recent Alerts"]

    T1 --> D_SCORE["Calculate Delivery Health (40%)"]
    T2 --> R_SCORE["Calculate Runway Safety (35%)"]
    T3 --> K_SCORE["Calculate Risk Index (25%)"]

    D_SCORE --> COMPOSITE["Synthesize Composite Startup Health Score (0-100)"]
    R_SCORE --> COMPOSITE
    K_SCORE --> COMPOSITE

    COMPOSITE --> RES["Return Unified Dashboard Summary JSON"]
    T4 --> RES
    T5 --> RES
```

---

## 9. Notification Deduplication & Lifecycle

```mermaid
stateDiagram-v2
    [*] --> EventTriggered : System Event Occurs (e.g. Pending Approval)
    EventTriggered --> DeduplicationCheck : Generate event_key hash
    
    DeduplicationCheck --> DiscardDuplicate : Duplicate event_key found in last 24h
    DiscardDuplicate --> [*]
    
    DeduplicationCheck --> CreateNotification : Unique event_key
    CreateNotification --> Unread : Persist in notifications table (is_read=False)
    
    Unread --> UnreadCount : Increments top navigation badge count
    Unread --> Read : User clicks notification or calls /read-all
    
    Read --> Archived : is_read=True
    Archived --> [*]
```

---

## 10. Container Deployment Topology

```mermaid
graph TD
    CLIENT["Browser Client"] -->|Port 443 / HTTPS| HOST_NGINX["Edge Reverse Proxy (TLS 1.3)"]
    
    subgraph Docker_Network ["Docker Internal Bridge Network (startupai_network)"]
        HOST_NGINX -->|Port 80| FRONTEND["Frontend Container (Nginx Alpine)"]
        HOST_NGINX -->|Port 8000| BACKEND["Backend Container (FastAPI - Non-Root UID 1000)"]
        
        FRONTEND -.->|/api/ reverse proxy| BACKEND
        BACKEND -->|Port 5432| POSTGRES[("PostgreSQL 16 Alpine")]
        BACKEND -->|Port 6379| REDIS[("Redis 7 Alpine")]
    end

    POSTGRES --> VOL1[("Named Volume: postgres_data")]
    REDIS --> VOL2[("Named Volume: redis_data")]
```

---

## 11. Database Backup & Recovery Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Automated Cron Job
    participant PG as PostgreSQL Container
    participant Storage as Encrypted Backup Storage

    Note over Cron,Storage: Daily Backup Workflow
    Cron->>PG: docker compose exec postgres pg_dump -U postgres -F c startup_ai
    PG-->>Cron: Stream Compressed Binary Dump
    Cron->>Storage: Store with Timestamp (retention 30 days)

    Note over Cron,Storage: Disaster Recovery Workflow
    actor Admin as DevSecOps Admin
    Admin->>Storage: Retrieve Target Backup Archive
    Admin->>PG: docker compose stop backend
    Admin->>PG: docker compose exec postgres pg_restore -U postgres -d startup_ai --clean
    PG-->>Admin: Schema & Data Restored
    Admin->>PG: docker compose start backend
    Admin->>PG: curl http://localhost:8000/ready (Verify 200 OK)
```

---

## 12. Complete 10-Journey End-to-End User Flow

```mermaid
flowchart TD
    J1["1. Register Account (Argon2id Hashed)"] --> J2["2. Login & Create Persistent Session (JWT + JTI)"]
    J2 --> J3["3. Create Workspace & Invite Team (RBAC Role Assigned)"]
    J3 --> J4["4. Create Project & Manage Kanban Tasks (TODO -> IN_PROGRESS -> DONE)"]
    J4 --> J5["5. Interact with AI Manager Agent (Query & Specialist Routing)"]
    J5 --> J6["6. Specialized Agents Calculate Deterministic Metrics (Runway, SWOT, Risks)"]
    J6 --> J7["7. AI Approval Gate (Medium/High Risk Action Staged & Approved)"]
    J7 --> J8["8. View Executive Dashboard (Composite Startup Health Score Calculated)"]
    J8 --> J9["9. In-App Notifications (24h Deduplicated Alert Read Lifecycle)"]
    J9 --> J10["10. Logout (Immediate Persistent Session Revocation in Database)"]
```
