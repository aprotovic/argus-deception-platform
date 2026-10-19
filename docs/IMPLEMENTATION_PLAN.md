# ARGUS: Cyber Deception & Attack-Monitoring System
## Implementation Plan & Project Roadmap

### Project Overview
ARGUS is a production-grade cyber deception and attack-monitoring platform developed as a Software Engineering graduation project. It deploys an authentic-looking, deliberately isolated decoy portal ("Nexis Defense Core Portal") to trap unauthorized access attempts, record tamper-evident security telemetry, safely quarantine uploaded artifacts, and visualize high-fidelity telemetry in a live real-time Operations Dashboard.

---

### Phase 1: Inspection & Architectural Design (Current Phase)
- [x] Inspect local runtime environment (Python 3.13.14, Node v24.14.0, npm 11.9.0, Docker 29.6.1, Docker Compose v5.3.0).
- [x] Establish Git repository and project structure.
- [x] Formulate Threat Model, Network Segmentation, and Security Architecture.
- [x] Design normalized relational Data Model (PostgreSQL + SQLAlchemy + Alembic).
- [x] Define REST & WebSocket API specification.
- [x] Author comprehensive project documentation (`IMPLEMENTATION_PLAN.md`, `SECURITY_ARCHITECTURE.md`, `DATA_MODEL.md`, `API.md`).

---

### Phase 2: Foundational Infrastructure & Core Backend
- [ ] Initialize Python backend environment with `pyproject.toml` and lock/requirements.
- [ ] Configure structured JSON logging (`structlog` / python standard JSON formatter) with UTC timestamps and correlation IDs.
- [ ] Setup SQLAlchemy 2.0 async engine and session management.
- [ ] Implement database models (`User`, `SecurityEvent`, `LoginAttempt`, `CapturedFile`, `DecoyService`, `AuditLog`).
- [ ] Setup Alembic migration environment and generate baseline migration.
- [ ] Implement database seeding script for initial admin/analyst roles with bcrypt hashing.
- [ ] Implement JWT authentication, RBAC dependencies (`admin`, `analyst`, `auditor`), and security middleware.
- [ ] Implement health check endpoints (`/health/live`, `/health/ready`).

---

### Phase 3: Decoy Engine & Safe Payload Collection
- [ ] Implement realistic corporate Decoy portal ("Nexis Cloud Infrastructure & Defense Systems"):
  - Corporate login interface (`/login`, `/auth/signin`).
  - Password recovery simulation (`/forgot-password`).
  - Diagnostic / support payload upload portal (`/portal/diagnostics`, `/portal/support/upload`).
  - Dynamic honeypot probe traps for scanners (`/.env`, `/wp-login.php`, `/.git/HEAD`, `/admin`, `/api/v1/debug`, `/actuator/health`, etc.).
- [ ] Build Event Ingestion Pipeline:
  - Source IP extraction (handling trusted reverse proxy headers securely without spoofing vulnerabilities).
  - Sanitized header filtering (stripping sensitive auth/cookies while capturing user-agent, accept, referer).
  - Password redaction: records length and HMAC-SHA256 fingerprint using a secret key; **never** plain text.
  - Unique UUIDv4 event ID assignment.
  - Test traffic tagging (`is_test_event` flag via custom header `X-Argus-Test-Token` or test client flag).
- [ ] Build Controlled Quarantine Storage Engine:
  - Dedicated isolated quarantine directory outside the web root.
  - UUIDv4 internal filename generation with `.quarantine` extension (no direct execution).
  - Sanitization of user-supplied filenames.
  - Streaming SHA-256 calculation and file size verification during upload.
  - MIME type detection via magic bytes (`python-magic` / fallback pure-python magic checker).
  - Enforce upload limits (max 10 MB default), file quota limits, and timeouts.
  - Rejection logging for oversized or prohibited uploads.
- [ ] Backend test suite for Decoy & Quarantine:
  - Unit tests for password fingerprinting and redaction.
  - Tests for file quarantine, path traversal blocking, and hash accuracy.
  - Tests for probe trapping and rate-limiting.

---

### Phase 4: Administrative API & Real-time Live Stream
- [ ] Dashboard REST endpoints:
  - `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/refresh`.
  - `/api/v1/overview/metrics` (total events, 24h events, unique IPs, failed logins, captured files).
  - `/api/v1/events` (paginated, filtered by severity, event type, time range, IP, test flag).
  - `/api/v1/events/{id}` (deep event detail with correlated events from same IP).
  - `/api/v1/evidence` (captured file records with SHA-256, size, MIME type).
  - `/api/v1/evidence/{id}/download` (authenticated, role-authorized download with audit log entry).
  - `/api/v1/export/events` (CSV / JSON export).
  - `/api/v1/audit-logs` (administrative audit trail).
- [ ] WebSocket Live Stream Engine:
  - Connection manager supporting authenticated dashboard clients.
  - Event broadcasting whenever the decoy captures an interaction.
  - Heartbeat / ping-pong handling.

---

### Phase 5: Modern Security Operations Dashboard (Frontend)
- [ ] Initialize React + TypeScript + Vite project with Tailwind CSS.
- [ ] Implement modern, high-contrast dark SOC design system (slate/zinc palette, glassmorphism, accent cyan/amber/rose signals).
- [ ] Build Authentication View (secure JWT token storage in memory/secure cookie, login form).
- [ ] Build Navigation & Layout (Status bar with live WebSocket indicator, UTC clock, user profile, system health).
- [ ] Build **Overview Page**:
  - Live metric KPI cards (Total Events, 24h Activity, Unique Attacking IPs, Failed Auth Attempts, Quarantined Files).
  - Activity breakdown chart / event type distribution.
  - Recent high-severity detections feed.
- [ ] Build **Live Event Stream**:
  - Real-time tabular stream updating via WebSockets with pulse animations on incoming events.
  - Filters (Severity, Event Type, Date range, IP address, Genuine vs Test toggle).
  - Search input with debounced query.
  - Pagination controls.
- [ ] Build **Event Investigation Modal / Drawer**:
  - Full request metadata inspector (sanitized headers, query params, HTTP method, client fingerprint).
  - Correlated events from same source IP.
  - Associated file upload details (SHA-256 hash, MIME type, download link).
  - One-click raw JSON copy.
- [ ] Build **Evidence Locker**:
  - Quarantined file table with verified SHA-256 hashes, file sizes, timestamps, and source IP.
  - Authenticated evidence download with audit logging.
  - Export capabilities (CSV / JSON).
- [ ] Build **Audit Log Viewer**:
  - Complete tamper-evident record of administrator actions, evidence downloads, and exports.

---

### Phase 6: System Hardening, Docker Compose & Verification
- [ ] Build multi-stage Dockerfiles:
  - `Dockerfile.backend` (unprivileged `argus` user, read-only root, minimal base).
  - `Dockerfile.decoy` (isolated decoy process, unprivileged, no docker socket, minimal outbound egress).
  - `Dockerfile.frontend` (Nginx unprivileged serving production static assets).
- [ ] Docker Compose specification:
  - Network isolation: `decoy-net` (public ingress), `backend-internal` (decoy to backend event ingestion), `db-net` (backend to postgres only).
  - Resource constraints (`deploy.resources.limits.cpus`, `memory`).
  - Quarantine persistent volume mounted with restrictive permissions.
- [ ] Automated end-to-end and integration test suite:
  - Controlled traffic generator script (`scripts/test_traffic_generator.py`) simulating realistic scans, brute-force logins, and safe file uploads.
  - Pytest verification for all security guarantees.
- [ ] Final graduation project deliverables:
  - Verification checklist and demonstration protocol.
  - Architecture diagrams and final report documentation.
