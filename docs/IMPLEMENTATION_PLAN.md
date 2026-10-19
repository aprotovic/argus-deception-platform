# ARGUS: Cyber Deception & Attack-Monitoring System
## Implementation Plan & Project Roadmap (Status: COMPLETE)

### Project Overview
ARGUS is a production-grade cyber deception and attack-monitoring platform developed as a Software Engineering graduation project. It deploys an authentic-looking, deliberately isolated decoy portal ("Nexis Defense Core Portal") to trap unauthorized access attempts, record tamper-evident security telemetry, safely quarantine uploaded artifacts, and visualize high-fidelity telemetry in a live real-time Operations Dashboard.

---

### Phase 1: Inspection & Architectural Design (Completed)
- [x] Inspect local runtime environment (Python 3.13.14, Node v24.14.0, npm 11.9.0, Docker 29.6.1, Docker Compose v5.3.0).
- [x] Establish Git repository and project structure.
- [x] Formulate Threat Model, Network Segmentation, and Security Architecture.
- [x] Design normalized relational Data Model (PostgreSQL + SQLAlchemy + Alembic).
- [x] Define REST & WebSocket API specification.
- [x] Author comprehensive project documentation (`IMPLEMENTATION_PLAN.md`, `SECURITY_ARCHITECTURE.md`, `DATA_MODEL.md`, `API.md`, `DEPLOYMENT.md`, `TESTING.md`, `KNOWN_LIMITATIONS.md`).

---

### Phase 2: Foundational Infrastructure & Core Backend (Completed)
- [x] Initialize Python backend environment with `backend/requirements.txt` and virtualenv.
- [x] Configure structured JSON logging with UTC timestamps and correlation IDs (`backend/app/logging_config.py`).
- [x] Setup SQLAlchemy 2.0 async engine and session management supporting both PostgreSQL and SQLite (`backend/app/database.py`).
- [x] Implement database models (`User`, `SecurityEvent`, `LoginAttempt`, `CapturedFile`, `DecoyService`, `AuditLog`).
- [x] Setup Alembic migration environment and generate baseline migration (`465bd29329f0_initial_schema.py`).
- [x] Implement database seeding script for initial admin/analyst roles with bcrypt hashing (`scripts/seed_db.py`).
- [x] Implement JWT authentication, RBAC dependencies (`admin`, `analyst`, `auditor`), and security middleware.
- [x] Implement health check endpoints (`/health/live`, `/health/ready`).

---

### Phase 3: Decoy Engine & Safe Payload Collection (Completed)
- [x] Implement realistic corporate Decoy portal ("Nexis Defense Systems"):
  - Corporate login interface (`/login`, `/auth/signin`).
  - Diagnostic payload upload portal (`/upload/diagnostics`).
  - Dynamic honeypot probe traps for scanners (`/.env`, `/wp-login.php`, `/.git/config`, `/admin`, etc.).
- [x] Build Event Ingestion Pipeline:
  - Source IP extraction handling reverse proxies safely.
  - Sanitized header filtering (stripping sensitive auth/cookies while capturing analytical headers).
  - Password redaction: records length and HMAC-SHA256 fingerprint using server secret key; **never** plain text.
  - Unique UUIDv4 event ID assignment.
  - Test traffic tagging (`is_test_event` flag via `X-Argus-Test-Token` or query parameter).
- [x] Build Controlled Quarantine Storage Engine:
  - Dedicated isolated quarantine directory outside the web root (`./data/quarantine`).
  - UUIDv4 internal filename generation with `.quarantine` extension (no direct execution).
  - Sanitization of user-supplied filenames.
  - Streaming SHA-256 calculation and file size verification during upload.
  - MIME type detection via magic bytes.
  - Enforce upload limits (max 10 MB default), storage quotas, and timeouts.
  - Rejection logging for oversized or prohibited uploads.
- [x] Automated backend test suite for Decoy & Quarantine:
  - 14/14 automated tests passing across unit and integration suites.

---

### Phase 4: Administrative API & Real-time Live Stream (Completed)
- [x] Dashboard REST endpoints:
  - `/api/v1/auth/login`, `/api/v1/auth/me`.
  - `/api/v1/overview/metrics` (total events, 24h events, unique IPs, failed logins, captured files).
  - `/api/v1/events` (paginated, filtered by severity, event type, IP, test flag, search).
  - `/api/v1/events/{id}` (deep event detail with correlated events from same IP).
  - `/api/v1/evidence` (captured file records with SHA-256, size, MIME type).
  - `/api/v1/evidence/{id}/download` (authenticated, role-authorized download with audit log entry).
  - `/api/v1/export/events` (CSV / JSON export).
  - `/api/v1/audit-logs` (administrative audit trail).
- [x] WebSocket Live Stream Engine:
  - `/api/v1/ws/events` broadcasting incoming events in real time.

---

### Phase 5: Modern Security Operations Dashboard (Completed)
- [x] React + TypeScript + Vite project with tactical dark SOC aesthetic.
- [x] Authentication View (`LoginView.tsx`) with quick-connect preset buttons for evaluator demonstration.
- [x] Navigation & Layout: Header with live radar indicator, live UTC clock, decoy quick-launch link.
- [x] **Overview View (`OverviewView.tsx`)**:
  - Live metric KPI cards (Total Events, 24h Activity, Unique IPs, Trapped Logins, Quarantined Files).
  - Threat Severity Distribution.
  - Interaction Classification breakdown.
  - Recent Observational Activity trend chart.
  - Quick action to run controlled test traffic simulation.
- [x] **Live Event Stream (`LiveStreamView.tsx`)**:
  - Real-time tabular stream with pulse animations on incoming events.
  - Full filtering (Severity, Event Type, Traffic Origin [Genuine vs Test], Search).
  - Pagination controls.
- [x] **Event Investigation Modal (`EventInvestigationModal.tsx`)**:
  - Full request metadata inspector (sanitized headers, method, path, client details).
  - Trapped credential inspection (username, password length, HMAC fingerprint disclaimer).
  - Quarantined payload details (SHA-256 checksum, size, MIME type, download link).
  - Correlated events from same source IP.
  - One-click raw JSON copy.
- [x] **Evidence Locker (`EvidenceLockerView.tsx`)**:
  - Quarantined file table with verified SHA-256 hashes, sizes, timestamps, and source IP.
  - Authenticated evidence download with audit logging and warning confirmation.
- [x] **Audit Log Viewer (`AuditLogView.tsx`)**:
  - Complete tamper-evident record of administrator actions, evidence downloads, and exports.

---

### Phase 6: System Hardening, Docker Compose & Verification (Completed)
- [x] Multi-stage and hardened container specifications:
  - `backend/Dockerfile` (unprivileged `argus` user, UID 10001, restrictive permissions).
  - `frontend/Dockerfile` (multi-stage build, unprivileged Nginx).
  - `frontend/nginx.conf` (hardened reverse proxy).
  - `docker-compose.yml` (network isolation: `decoy-net`, `backend-internal`, `db-net`).
- [x] Controlled traffic generator script (`scripts/simulate_traffic.py`).
- [x] End-to-end verification via Browser Automation Subagent:
  - Decoy portal verified at `/decoy`.
  - Dashboard login verified at `/`.
  - Overview metrics verified with genuine telemetry.
  - Live stream and filter verified.
  - Investigation modal verified with forensics and correlated events.
  - Evidence locker verified with quarantined file hashes.
