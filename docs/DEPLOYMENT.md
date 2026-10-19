# ARGUS: Secure Deployment & Operational Procedures

## 1. Deployment Philosophy
ARGUS is designed for deployment on an isolated Virtual Private Server (VPS) or cloud instance (e.g., AWS, Hetzner, DigitalOcean) with strict firewall boundaries. Because the decoy is intentionally exposed to the open internet, it must be isolated from any internal enterprise network or private cloud VPC peering.

---

## 2. Network Topology & Firewall Configuration

```mermaid
flowchart LR
    Internet(("Public Internet"))
    Firewall["Host Firewall / UFW / Cloud SG"]
    ReverseProxy["Nginx TLS Reverse Proxy"]
    Decoy["ARGUS Decoy Container :8080"]
    Backend["ARGUS Core Backend :8000"]
    Postgres[("PostgreSQL :5432")]

    Internet -->|"Port 443 / 80"| Firewall
    Firewall -->|"Forward 443"| ReverseProxy
    ReverseProxy -->|"Proxy / and decoy paths"| Decoy
    ReverseProxy -->|"Proxy /admin and /api (VPN Protected)"| Backend
    Decoy -->|"Internal Ingestion Only"| Backend
    Backend -->|"Internal DB Net Only"| Postgres

    Firewall -.->|"BLOCK direct 5432"| Postgres
    Firewall -.->|"BLOCK direct 8000"| Backend
```

### 2.1 Firewall Rules (UFW / Linux)
```bash
# Default deny all incoming
ufw default deny incoming
ufw default allow outgoing

# Allow SSH from trusted operator IPs only
ufw allow from <OPERATOR_IP> to any port 22 proto tcp

# Allow HTTP and HTTPS for Decoy and Dashboard
ufw allow 80/tcp
ufw allow 443/tcp

# Explicitly ensure Database & Internal API ports are NOT accessible externally
ufw deny 5432/tcp
ufw deny 8000/tcp

ufw enable
```

---

## 3. Environment Variables Configuration

Copy `.env.example` to `.env` and configure production secrets. **Never commit `.env` to source control.**

```bash
# Core Environment
ENVIRONMENT=production
LOG_LEVEL=INFO
SECRET_KEY=generate_with_openssl_rand_hex_32
ARGUS_PASSWORD_FINGERPRINT_SECRET=generate_strong_hmac_secret_32_bytes

# Database Configuration (PostgreSQL)
POSTGRES_USER=argus_user
POSTGRES_PASSWORD=strong_random_db_password
POSTGRES_DB=argus_telemetry
DATABASE_URL=postgresql+asyncpg://argus_user:strong_random_db_password@argus-db:5432/argus_telemetry

# Decoy Ingestion Mutual Token
INTERNAL_INGESTION_TOKEN=generate_secure_token_between_decoy_and_backend

# Evidence Quarantine Directory (Volume mount)
QUARANTINE_STORAGE_DIR=/var/lib/argus/quarantine
MAX_UPLOAD_SIZE_BYTES=10485760 # 10 MB

# Initial Admin Account (Seeded on first migration)
ADMIN_USERNAME=argus_admin
ADMIN_EMAIL=admin@defense.local
ADMIN_PASSWORD=change_this_immediately_on_first_boot
```

---

## 4. Docker Compose Deployment Procedure

1. **Clone repository to VPS**:
   ```bash
   git clone <repo_url> /opt/argus
   cd /opt/argus
   ```

2. **Configure environment & file permissions**:
   ```bash
   cp .env.example .env
   # Edit .env with strong secrets
   chmod 600 .env
   mkdir -p ./data/quarantine ./data/postgres
   chmod 700 ./data/quarantine
   ```

3. **Build and start the container stack**:
   ```bash
   docker compose build --pull
   docker compose up -d
   ```

4. **Verify container health**:
   ```bash
   docker compose ps
   docker compose logs -f argus-backend
   ```

5. **Run Database Migrations & Initial Seed**:
   ```bash
   docker compose exec argus-backend alembic upgrade head
   docker compose exec argus-backend python scripts/seed_db.py
   ```

---

## 5. Evidence Retrieval & Safe Takedown Procedure

In the event of an investigation or when decommissioning the decoy:
1. **Quarantine Freeze**:
   ```bash
   # Halt incoming traffic to decoy immediately
   docker compose stop argus-decoy
   ```
2. **Export Telemetry & Evidence Manifest**:
   ```bash
   docker compose exec argus-backend python scripts/export_evidence_archive.py --output /opt/argus/evidence_package_$(date +%Y%m%d).tar.gz
   ```
3. **Verify Integrity**:
   Compare the SHA-256 hashes generated in the manifest against the database records.
