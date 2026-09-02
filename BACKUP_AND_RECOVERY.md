# Database Backup, Disaster Recovery & Maintenance Guide

**Project**: StartupAI Manager  
**Target Engine**: PostgreSQL 16+ (Production) / SQLite (Local Dev)  
**Classification**: DevSecOps Operations Manual  

---

## 1. Overview & Recovery Objectives

For production deployments of StartupAI Manager, the database holds critical business data:
- User identities and Argon2id credentials
- Persistent user sessions and revocation logs
- Workspaces, projects, Kanban tasks, and immutable activity history
- Deterministic financial ledger (expenses, budgets, treasury accounts)
- Marketing campaigns and performance telemetry
- AI tool execution telemetry and human approval audit logs

### Operational Targets
- **Recovery Point Objective (RPO)**: $\le 1\,\text{hour}$ (maximum data loss window in severe disaster)
- **Recovery Time Objective (RTO)**: $\le 30\,\text{minutes}$ (target time to restore service after catastrophic failure)

---

## 2. Backup Procedures

### A. Logical Backup (pg_dump)
Perform daily compressed, custom-format logical backups using `pg_dump`. This allows selective table restoration and schema migration checks.

```bash
# Set secure permissions on backup destination
umask 077

# Backup active database container
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -F c \
  -b \
  -v \
  -f "/tmp/startupai_backup_$(date +%Y%m%d_%H%M%S).dump" \
  "${POSTGRES_DB}"

# Copy out of container to encrypted storage
docker compose cp postgres:/tmp/startupai_backup_*.dump /var/backups/startupai/
```

### B. Automated Daily Backup Script (`backup_db.sh`)
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/startupai"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/startupai_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting logical database backup..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than retention window
find "${BACKUP_DIR}" -type f -name "startupai_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Pruned backups older than ${RETENTION_DAYS} days."
```

---

## 3. Database Restore Procedures

### A. Full Restoration from Backup
In case of data corruption, accidental deletion, or host failure:

1. **Stop application backend traffic**:
   ```bash
   docker compose stop backend
   ```

2. **Terminate existing database connections**:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE datname = 'startup_ai' AND pid <> pg_backend_pid();
   ```

3. **Restore from compressed backup**:
   ```bash
   # Uncompress and pipe into psql
   gunzip -c /var/backups/startupai/startupai_20260902_120000.sql.gz | \
     docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
   ```

4. **Verify Database Integrity**:
   ```bash
   # Run verification checks
   docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c \
     "SELECT count(*) FROM users; SELECT count(*) FROM workspaces; SELECT count(*) FROM tasks;"
   ```

5. **Restart backend services**:
   ```bash
   docker compose start backend
   curl -f http://localhost:8000/ready
   ```

---

## 4. Alembic Migration Rollback Strategy

When a schema deployment requires rollback:

### 1. View Current Migration Status
```bash
python -m alembic current
```

### 2. Rollback One Migration Step
```bash
python -m alembic downgrade -1
```

### 3. Rollback to a Specific Revision ID
```bash
python -m alembic downgrade <revision_id>
```

### Pre-Migration Safety Rule
Always generate a pre-migration snapshot before applying new schema changes in production:
```bash
./scripts/backup_db.sh
python -m alembic upgrade head
```

---

## 5. Database Health Checks & Monitoring

The application includes automated health and readiness probes:
- `GET /health`: Fast liveness check (HTTP 200)
- `GET /ready`: Connectivity check running `SELECT 1` against the connection pool (HTTP 200 / HTTP 503)

### Periodic Maintenance Query
Run weekly to clean dead tuples and optimize query planner statistics:
```sql
VACUUM ANALYZE;
```
