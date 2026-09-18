# StartupAI Manager — User Manual & Operations Guide

Welcome to **StartupAI Manager**, your intelligent operating system designed to run, monitor, and scale your startup.

---

## 1. Creating Your Account (Registration)

1. Open your browser and navigate to: **[http://localhost:5173/register](http://localhost:5173/register)**.
2. Complete the registration form:
   - **Full Name**: Enter your full name (e.g., `Alex Vance`).
   - **Work Email**: Enter your company email (e.g., `founder@nexusai.io`).
   - **Password**: Enter a secure password (must be at least **8 characters long**).
   - **Confirm Password**: Re-enter your password to confirm matching.
3. Click **Create Account**. Your credentials are encrypted immediately using Argon2id.

---

## 2. Signing In & Session Security

1. Go to the **Login** page (`/login`).
2. Enter your email and password.
3. Click **Sign In to Workspace**.
4. The system securely issues your access session. Your session is monitored in the database; you can see active sessions or log out from other devices at any time.

---

## 3. Initial Setup & Company Workspace Bootstrap

StartupAI Manager operates as a dedicated operating system for your company:

1. **First-Time Setup**: The first registered user bootstraps the company workspace and automatically assumes the **OWNER** role.
2. Complete your company profile:
   - **Company Name \***: The name of your venture (e.g., `Nexus AI Technologies`).
   - **Industry**: Sector (e.g., `Artificial Intelligence`, `SaaS`, `Fintech`).
   - **Base Currency**: Select your accounting currency (`USD`, `EUR`, `GBP`, `INR`, `CAD`).
   - **Description & Mission**: Company mission and core objectives.
3. Click **Create Company Workspace**. Your executive dashboard and operational navigation will activate immediately.
4. **Single-Company Policy**: Once initialized, the company workspace is locked to your organization. Multiple company creation is blocked to maintain strict operational focus and data integrity.

---

## 4. Inviting Team Members & Assigning Roles

To add colleagues or leadership to your company:

1. Click **Team** in the sidebar (`/team`).
2. Click **Invite Team Member**.
3. Enter their registered email address and select their **Role**:
   - **OWNER**: Full company ownership, system settings, member lifecycle, company deletion.
   - **ADMIN**: User management (cannot demote/remove OWNER), projects, tasks, finance, AI approvals.
   - **TEAM_LEAD**: Team task allocation, task assignments, team progress monitoring, comments, reports.
   - **MANAGER**: Project management, task tracking, progress reports, and permitted AI queries.
   - **TEAM_MEMBER**: Assigned project viewing, task status updates, comments, notifications.
   - **VIEWER**: Read-only visibility into executive health, projects, tasks, and company reports.
4. Click **Send Invitation**. Member permissions are strictly validated server-side.

---

## 5. Managing Projects & Milestones

1. Click **Projects** in the sidebar (`/projects`).
2. Click **Create Project**.
3. Enter the project details:
   - **Project Name \***: e.g., `Autonomous Inference API`.
   - **Description**: Key goals and deliverables.
   - **Initial Status**: `PLANNING`, `ACTIVE`, `ON_HOLD`, or `COMPLETED`.
   - **Priority**: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
   - **Budget (USD)**: e.g., `50000`.
   - **Deadline**: Target completion date.
4. Click **Create Project**.

---

## 6. Tasks & Interactive Kanban Board

1. Click **Tasks & Kanban** in the sidebar (`/tasks`).
2. **Create a Task**:
   - Click **New Task**.
   - Select the associated project, enter the title, description, priority, and due date.
   - Click **Create Task**.
3. **Move Tasks**:
   - Move cards across the 4 workflow columns: **To Do**, **In Progress**, **Review**, and **Done** using the arrow buttons on each card.
4. **Task Collaboration & History**:
   - Click on any task card to open the **Task Details Drawer**.
   - Under the **Comments** tab, post notes and feedback (all comments are sanitized for safety).
   - Under the **History** tab, view an immutable audit log of who moved the task, changed its priority, or updated its details.

---

## 7. Managing Startup Finances (Burn Rate & Runway)

1. Click **Finance & Burn** in the sidebar (`/finance`).
2. **Set Your Cash Balance**:
   - Click **Update Balance** and enter your company's available treasury cash (e.g., `$250,000`).
3. **Record Operating Expenses**:
   - Click **Record Expense**.
   - Enter the title, amount, category (`R&D`, `MARKETING`, `SALARIES`, `OPERATIONS`, `LEGAL`), and expense date.
4. **Understand the Numbers**:
   - **Monthly Burn Rate**: Shows your total spending over the trailing 30 days.
   - **Cash Runway**: Calculates how many months your business can operate before cash is exhausted.
   - **Budget Variance**: Visual progress bars show if any category has exceeded its allocated budget.

---

## 8. Marketing Campaigns & Acquisition Metrics

1. Click **Marketing** in the sidebar (`/marketing`).
2. Click **New Campaign** to record an initiative across `SOCIAL_MEDIA`, `SEARCH_ENGINE`, `EMAIL`, or `EVENTS`.
3. View aggregated key performance indicators:
   - **Click-Through Rate (CTR)**: $\text{Clicks} \div \text{Impressions}$.
   - **Conversion Rate (CVR)**: $\text{Conversions} \div \text{Clicks}$.
   - **Customer Acquisition Cost (CAC)**: $\text{Spend} \div \text{Conversions}$.

---

## 9. Market Research & SWOT Matrix

1. Click **Research** in the sidebar (`/research`).
2. Record competitor observations, customer interview findings, or industry trends.
3. The system automatically synthesizes your findings into a **4-Quadrant SWOT Matrix**:
   - **Strengths** & **Weaknesses** (Internal capabilities)
   - **Opportunities** & **Threats** (Market conditions)

---

## 10. Operational Risk Management

1. Click **Risks** in the sidebar (`/risks`).
2. Click **Add Risk** and select:
   - **Likelihood ($1–5$)**: Rare ($1$) to Almost Certain ($5$).
   - **Impact ($1–5$)**: Negligible ($1$) to Catastrophic ($5$).
3. The system computes your **Risk Score** ($1–25$) and classifies severity:
   - **CRITICAL** ($\ge 20$): Immediate mitigation required.
   - **HIGH** ($12–19$): Priority board-level attention.
   - **MEDIUM** ($6–11$): Tracked and managed.
   - **LOW** ($1–5$): Monitored routine risk.

---

## 11. Conversing with the AI Manager Agent

1. Click **AI Manager** in the sidebar (`/ai-manager`).
2. Type natural language instructions to your executive AI assistant. Examples:
   - *"Summarize our progress on current projects."*
   - *"Calculate our cash runway based on recent cloud expenses."*
   - *"What are the highest active risks right now?"*
   - *"Draft a high-priority task for performance benchmarking."*
3. The Manager Agent analyzes your request, queries the deterministic calculation engines, and provides concise, factual answers.

---

## 12. Reviewing Human AI Approvals

To protect your startup from unauthorized modifications, high-risk AI operations require human approval:

1. When the AI proposes an action like deleting a project or modifying financial records, it creates a **Pending Approval**.
2. Go to the **Dashboard** or open the **AI Approvals** drawer.
3. Review the proposed action, tool name, parameters, and rationale.
4. Click **Approve** to execute the change, or **Reject** to cancel it safely.

---

## 13. The Executive Dashboard & Startup Health Score

Click **Executive Health** in the sidebar (`/dashboard`) to view your high-level executive summary:

- **Startup Health Score ($0–100$)**:
  - **Delivery Health ($40\%$)**: Measures on-time task completion and flags project bottlenecks.
  - **Runway Safety ($35\%$)**: Evaluates your remaining months of cash runway.
  - **Risk Index ($25\%$)**: Penalizes the score for active critical and high-severity risks.
- **Grade**: Displays `EXCELLENT` ($\ge 90$), `HEALTHY` ($\ge 75$), `CAUTION` ($\ge 50$), or `CRITICAL` ($< 50$).

---

## 14. Notifications & Alerts

- Watch the **Notification Bell** in the top navigation bar for unread alert badges.
- Click the bell to view recent alerts for pending approvals, critical risks, or budget warnings.
- Click **View All Notifications** (`/notifications`) to manage your inbox or mark all alerts as read.

---

## 15. Logging Out & Device Management

- Click the **Log Out** button (door icon) in the top-right corner to securely terminate your current session.
- To revoke sessions from other computers or devices, go to **Settings & Audit** and click **Revoke Session** or **Log Out All Devices**.
