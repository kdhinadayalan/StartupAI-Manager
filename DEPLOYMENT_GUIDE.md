# StartupAI Manager — Production Deployment & Operations Runbook

**Release**: `v1.0.0-production`  
**Target Audience**: DevSecOps Engineers, Cloud Architects, System Administrators  

---

## 1. System Requirements & Prerequisites

### Minimum Hardware Specifications (Single-Host Production)
- **CPU**: 2 vCPUs (x86_64 or ARM64)
- **RAM**: 4 GB RAM (8 GB recommended for heavy LLM telemetry and concurrent users)
- **Disk**: 20 GB SSD storage (plus automated external backup volume)

### Software Requirements
- **Docker Engine**: Version `24.0+`
- **Docker Compose**: Version `2.20+`
- **Git**: Version `2.30+`
- **OpenSSL**: For cryptographic secret key generation

### Network Port Allocation
- `80/TCP`: HTTP traffic (redirected to HTTPS)
- `443/TCP`: Inbound HTTPS traffic (TLS 1.3)
- `8000/TCP`: FastAPI backend application (internal container network)
- `5432/TCP`: PostgreSQL 16 database (internal container network only)
- `6379/TCP`: Redis 7 cache (internal container network only)

---

## 2. Environment Configuration

1. Copy the production template:
   ```bash
   cp .env.example .env
   ```

2. Generate a cryptographically secure 64-character secret key:
   ```bash
   openssl rand -hex 32
   ```

3. Populate the required production variables in `.env`:
   ```ini
   ENVIRONMENT="production"
   DEBUG=False
   PROJECT_NAME="StartupAI Manager"
   API_V1_PREFIX="/api/v1"

   # Cryptographically secure random secret key (>= 32 chars)
   SECRET_KEY="<insert_generated_hex_key_here>"
   ALGORITHM="HS256"
   ACCESS_TOKEN_EXPIRE_MINUTES=15
   REFRESH_TOKEN_EXPIRE_DAYS=7

   # PostgreSQL Production Database
   DATABASE_URL="postgresql+psycopg2://postgres_user:STRONG_SECURE_PASSWORD@postgres:5432/startupai_prod"

   # Redis Configuration (Optional but recommended for multi-instance scaling)
   REDIS_URL="redis://:STRONG_REDIS_PASSWORD@redis:6379/0"

   # Allowed Web Origins (Must match your live domain)
   BACKEND_CORS_ORIGINS=["https://startupai.example.com"]

   # Rate Limiting
   RATE_LIMIT_PER_MINUTE=100

   # AI Provider Keys
   AI_PROVIDER_DEFAULT="gemini"
   GEMINI_API_KEY="<your_gemini_api_key>"
   ```

---

## 3. Containerized Deployment (Docker Compose)

The standard production deployment utilizes `docker-compose.yml` with 4 container services:

```bash
# 1. Build optimized images
docker compose build

# 2. Start containers in detached mode
docker compose up -d

# 3. View live service logs
docker compose logs -f

# 4. Check container status
docker compose ps
```

### Services Deployed:
1. `postgres`: PostgreSQL 16 Alpine database with health checks and persistent volume `postgres_data`.
2. `redis`: Redis 7 Alpine cache with password protection and persistent volume `redis_data`.
3. `backend`: Non-root FastAPI application container (`appuser:appgroup` UID 1000).
4. `frontend`: Multi-stage Alpine Nginx container serving compiled static assets and reverse-proxying `/api/` traffic.

---

## 4. Health & Readiness Verification

Verify deployment status using the built-in system probes:

```bash
# 1. Verify Liveness Probe (Expect HTTP 200)
curl -f http://localhost:8000/health

# 2. Verify Database Readiness Probe (Expect HTTP 200 with database: connected)
curl -f http://localhost:8000/ready
```

Expected response from `/ready`:
```json
{
  "status": "ready",
  "database": "connected",
  "environment": "production"
}
```

---

## 5. Reverse Proxy & HTTPS Configuration

In production, terminate TLS at your edge reverse proxy (Cloudflare, AWS ALB, or Nginx).

### Sample Host Nginx TLS Configuration
```nginx
server {
    listen 80;
    server_name startupai.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name startupai.example.com;

    ssl_certificate /etc/letsencrypt/live/startupai.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/startupai.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Forward to Frontend Container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Forward API requests directly to Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## 6. Backup & Disaster Recovery Procedures

### Automated Daily Database Backup
Execute via daily cron:
```bash
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -F c \
  "${POSTGRES_DB}" | gzip > "/var/backups/startupai_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Full Disaster Recovery Restore
```bash
# 1. Stop backend traffic
docker compose stop backend

# 2. Restore database from compressed dump
gunzip -c /var/backups/startupai_20260902_120000.sql.gz | \
  docker compose exec -T postgres pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean

# 3. Restart backend and verify readiness
docker compose start backend
curl -f http://localhost:8000/ready
```

---

## 7. Migration Rollback Strategy

When a schema deployment needs to be rolled back:

```bash
# Check current migration revision
docker compose exec backend python -m alembic current

# Rollback single step
docker compose exec backend python -m alembic downgrade -1

# Rollback to specific revision ID
docker compose exec backend python -m alembic downgrade <revision_id>
```

---

## 8. Troubleshooting Production Issues

| Symptom | Root Cause | Fix |
|---|---|---|
| **`/ready` probe returns 503** | Database connection failed or connection pool exhausted | Check `docker compose logs postgres`. Ensure credentials in `DATABASE_URL` match `POSTGRES_PASSWORD`. |
| **Backend crashes on startup with `ValueError`** | `SECRET_KEY` is below 32 chars or default key in production | Generate a high-entropy 64-char key via `openssl rand -hex 32` and assign it in `.env`. |
| **Rate limit 429 errors on load balancer** | Proxy not forwarding `X-Forwarded-For` | Configure host reverse proxy to pass `proxy_set_header X-Forwarded-For $remote_addr;`. |
| **Frontend assets fail to load** | Nginx mime-types or build failure | Rebuild frontend image with `docker compose build frontend --no-cache`. |
