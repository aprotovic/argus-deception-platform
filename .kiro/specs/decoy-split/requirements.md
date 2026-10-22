# Requirements: Decoy split (decoy container without admin API or database)

## Problem
The public decoy container (port 8080) runs the same app as the backend (`app.main:app`). It therefore exposes the admin API (login, events, evidence download, export, audit, websocket, internal ingest) and also needs direct database access, which the compose file denies it (decoy is not on db-net). The decoy cannot record events in the compose layout, and attackers can reach admin endpoints.

## R1. Decoy surface isolation
1.1 WHEN the decoy container receives a request under /api/v1/auth, /api/v1/events, /api/v1/evidence, /api/v1/export, /api/v1/audit, /api/v1/metrics, /api/v1/ws, /api/v1/internal, /docs, /redoc or /openapi.json THEN it SHALL return the same 404 as for any unknown path.
1.2 The decoy SHALL still serve every existing decoy route: `/`, `/decoy`, `/robots.txt`, the root traps defined in main.py, and everything under `/api/v1/decoy/`.

## R2. No database in the decoy
2.1 The decoy container SHALL start and serve requests with no DATABASE_URL set, SHALL NOT connect to a database at import or startup, and SHALL NOT run `create_all`.
2.2 The compose file SHALL NOT give the decoy database credentials or the db-net network.

## R3. Event forwarding to the backend
3.1 WHEN a decoy route records a SecurityEvent (with its LoginAttempt or CapturedFile) THEN the decoy SHALL forward it to the backend at `POST /api/v1/internal/ingest-batch` with header `X-Argus-Internal-Token`, normally within 2 seconds.
3.2 The backend SHALL reject a missing or wrong token, reject batches over 100 events, and validate field lengths.
3.3 The ingest SHALL be idempotent per event id: a repeated event is ignored without error.
3.4 The backend SHALL persist each new event and broadcast the same WebSocket summary that `/internal/ingest` broadcasts today.
3.5 Events SHALL reference one fixed default DecoyService id, created by the backend on first ingest if missing.

## R4. Resilience
4.1 IF the backend is unreachable or returns 5xx THEN the decoy SHALL keep answering attackers normally, append events to a local JSONL spool file, and replay them in order when the backend returns (backoff 1s doubling up to 30s).
4.2 The spool SHALL be size-limited (default 100 MB). IF it is full THEN new events are dropped, counted, and an error is logged at most once per minute.
4.3 WHEN the decoy restarts THEN it SHALL replay any pending spool file.

## R5. Compatibility
5.1 `uvicorn app.main:app` (all-in-one local mode) SHALL behave exactly as before and the existing tests SHALL pass unchanged.
5.2 Uploaded file bytes are still written to the shared quarantine volume and `CapturedFile.internal_storage_path` stays valid for the backend.

## R6. Deployment
6.1 In compose, the decoy runs `app.decoy_main:app` with BACKEND_INGEST_URL, INTERNAL_INGESTION_TOKEN and ARGUS_PASSWORD_FINGERPRINT_SECRET (same value as the backend) and a decoy-only spool volume.
6.2 The decoy health check SHALL pass and `docker compose up` SHALL bring up all services.

## Out of scope (separate specs)
Plaintext password capture, client IP handling, rate limiting, secrets and defaults, firewall/egress rules, fake database decoy.
