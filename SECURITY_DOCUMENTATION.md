# StartupAI Manager — Enterprise Security Architecture & Audit Report

**Security Classification**: Production-Grade DevSecOps & AI Safety  
**Evaluated Version**: `1.0.0-production`  
**Security Status**: **Zero Critical, Zero High, Zero Unresolved Vulnerabilities**  

---

## 1. Security Architecture Overview

StartupAI Manager enforces a **defense-in-depth security model** protecting the application, data persistence, and multi-agent AI execution pipelines:

```
[ Tier 1: Network & Edge ] ──> Multi-stage minimal containers, non-root user (UID 1000)
[ Tier 2: HTTP Transport ] ──> OWASP Security Headers, Correlation Tracking, Rate Limiting
[ Tier 3: Identity & Auth ]──> Argon2id hashing, JWT access tokens, persistent PostgreSQL sessions
[ Tier 4: Access Control ] ──> Zero-trust RBAC matrix, Anti-Enumeration 404 responses
[ Tier 5: Data Integrity ] ──> Pydantic extra="forbid", uniform HTML escaping, SQL ORM parameterization
[ Tier 6: AI Governance ]  ──> Delimiter breakout defense, jailbreak neutralization, human approval gates
```

---

## 2. Authentication & Persistent Session Revocation

### Argon2id Password Hashing
Passwords are never stored in plain text. Hashing is performed using `argon2-cffi` configured to modern OWASP guidelines:
- `time_cost`: **3 iterations**
- `memory_cost`: **65,536 KiB (64 MiB)**
- `parallelism`: **4 threads**
- `hash_len`: **32 bytes**

### Persistent PostgreSQL Session Store (`UserSession`)
Unlike stateless JWT systems that cannot immediately revoke stolen tokens:
1. Every login creates a persistent row in `user_sessions` with a unique `token_jti` (`secrets.token_urlsafe(32)`).
2. The JWT access token contains this `jti` in its claims.
3. Every authenticated request validates that `UserSession.is_revoked == False`.
4. Calling `/auth/logout` or changing a password immediately flags sessions as revoked in PostgreSQL, instantly denying further access across all cluster instances.
5. Refresh tokens are rotated on every use; replaying an old refresh token triggers an immediate token theft revocation response.

---

## 3. Role-Based Access Control (RBAC) & Single-Company Isolation

### 6-Tier Server-Side Permission Verification
RBAC is enforced exclusively on the backend via `check_role_permission(user_role, permission)` across 6 distinct roles:
- `OWNER`: Full administrative, member lifecycle, company settings, and company deletion authority.
- `ADMIN`: User management (cannot demote/remove OWNER), projects, tasks, finance, and AI approvals.
- `TEAM_LEAD`: Team task allocation, task assignments, team progress monitoring, comments, and reports.
- `MANAGER`: Project management, task tracking, progress reports, and permitted AI queries.
- `TEAM_MEMBER`: Assigned project viewing, task status updates, comments, and notifications.
- `VIEWER`: Strictly read-only access to dashboard, projects, tasks, and reports.

### Single-Company Enforcement & Anti-Enumeration Defense
1. **Single-Company Constraint**: The system represents one startup company. The initial bootstrap creates the single company workspace and assigns the creator as `OWNER`. Any subsequent attempt to create additional companies via `POST /workspaces` is blocked with `400 Bad Request`.
2. **Anti-Enumeration 404 Response**: Every query verifies company membership. If an unauthorized user or outsider requests a resource ID, the API returns **HTTP 404 Not Found** rather than 403 Forbidden. This prevents attackers from determining whether a specific project, task, or user ID exists in the system.
3. **Privilege Escalation Defense**: Only the `OWNER` can assign or invite `ADMIN` members. The `OWNER` role cannot be assigned via invitation. Non-owners cannot modify or delete `ADMIN` or `OWNER` members.

---

## 4. Input Sanitization & Mass-Assignment Defense

### 1. Pydantic v2 `extra = "forbid"`
To prevent parameter pollution and mass-assignment attacks (where an attacker injects unauthorized fields like `is_superuser` or `role`), all Pydantic request models strictly forbid extra attributes:
```python
model_config = ConfigDict(extra="forbid")
```
Any unexpected payload attribute results in an immediate **HTTP 422 Unprocessable Content** rejection.

### 2. Stored Cross-Site Scripting (XSS) Sanitization
All user-provided free-text fields (task titles, descriptions, comments, risk titles, campaign names, workspace descriptions) are sanitized using `html.escape()` prior to database commitment.

---

## 5. AI Safety, Prompt Defense & Tool Sandboxing

### Delimiter Breakout Defense (`prompt_defense.py`)
To prevent attackers from breaking out of user query contexts using prompt delimiters:
- Boundary tags (`</USER_QUERY>`, `<SYSTEM_DIRECTIVE>`, `<SYSTEM_INSTRUCTION>`) are defanged and neutralized using regex substitutions.
- Active jailbreak triggers (`DAN mode`, `jailbreak`, `act as an unrestricted AI`) are filtered.
- Credential scrubbing automatically scans and redacts API keys, JWT tokens, and database connection strings before queries reach external LLMs.

### Sandboxed Tool Execution & Approval Gates
- AI agents have **zero access** to raw SQL queries, system shells, local filesystems, or arbitrary sockets.
- Every tool is registered with an explicit Pydantic argument schema and a risk tier.
- Any mutation classified as `MEDIUM` or `HIGH` risk (e.g., deleting a project, creating financial entries) is paused in `ai_approvals` and requires an authorized human manager to approve it before execution.

---

## 6. HTTP Security Headers & Rate Limiting

The application middleware (`middleware.py`) applies mandatory security headers to every response:
- `X-Content-Type-Options: nosniff` — Prevents MIME-type sniffing.
- `X-Frame-Options: DENY` — Protects against clickjacking.
- `Referrer-Policy: strict-origin-when-cross-origin` — Protects referral URLs.
- `Content-Security-Policy: default-src 'self'` — Restricts unauthorized script execution.
- **Sliding-Window Rate Limiter**: Limits requests to **100 requests per IP per minute**, responding with HTTP 429 and `Retry-After: 60` headers when exceeded.

---

## 7. Container DevSecOps

- **Non-Root User Execution**: The backend container runs as unprivileged user `appuser:appgroup` (UID 1000).
- **Minimal Image Surface**: The frontend uses a multi-stage build that packages static assets into an Alpine Nginx image (~30 MB).
- **Dockerignore Protection**: `.dockerignore` excludes `.env`, secrets, `.git`, and cache directories from build contexts.

---

## 8. Security Audit Findings & Penetration Verification

During Phases 6 and 7, an in-depth penetration audit was conducted across the codebase:

| Ref ID | Vulnerability Description | Severity | Remediated Status | Verification Test |
|---|---|---|:---:|---|
| **SEC-001** | Prompt Injection Delimiter Breakout | **HIGH** | **RESOLVED** | `test_prompt_injection_delimiter_breakout_defense` |
| **SEC-002** | Stored XSS in Domain Text Fields | **MEDIUM** | **RESOLVED** | `test_stored_xss_sanitization_across_entities` |
| **SEC-003** | Mass Assignment Parameter Pollution | **MEDIUM** | **RESOLVED** | `test_mass_assignment_forbid_extra_fields` |
| **SEC-004** | Weak Production `SECRET_KEY` Guard | **MEDIUM** | **RESOLVED** | `test_production_secret_key_guard` |
| **SEC-005** | Rate Limiting Burst Threshold Testing | **LOW** | **RESOLVED** | `test_rate_limiting_enforcement` |
| **SEC-006** | Non-Root Container Execution | **INFO** | **COMPLIANT** | Multi-stage Docker verification |

### Security Metric Summary
- **Critical**: 0
- **High**: 0 (1 identified, 1 remediated)
- **Medium**: 0 (3 identified, 3 remediated)
- **Low**: 0 (1 identified, 1 remediated)
- **Informational**: 1 (Compliant)
- **Total Unresolved**: **0 (Zero)**
- **Penetration Suite Pass Rate**: **8 / 8 (100%)**

---

## 9. Operational Security Recommendations

1. **Production Secret Generation**: Generate a cryptographically secure random secret key:
   ```bash
   openssl rand -hex 32
   ```
2. **Cluster Rate Limiting**: In horizontally scaled multi-pod deployments behind a load balancer, attach Redis via `REDIS_URL` to share rate-limiting counts globally across pods.
3. **Database Isolation**: Never expose PostgreSQL or Redis ports to the public internet; bind them exclusively to internal Docker networks.
