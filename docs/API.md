# ARGUS: REST & WebSocket API Specification

## 1. Overview
The ARGUS platform exposes two functional API surfaces:
1. **Decoy Interface**: Public-facing, unauthenticated deceptive endpoints intended to attract, capture, and safely divert attackers.
2. **Operations Dashboard API**: Private, JWT-authenticated management and monitoring REST endpoints alongside a real-time WebSocket event broadcaster.

---

## 2. Decoy Endpoints (Public Surface)

### 2.1 Decoy Authentication
- **`POST /api/v1/decoy/auth/login`**
  - **Purpose**: Accepts simulated login credentials.
  - **Security Guarantee**: Never authenticates. Redacts passwords, computes length and HMAC-SHA256 fingerprint, emits `login_attempt` event, and returns a realistic authentication failure response (`401 Unauthorized` with generic error message after intentional slight timing delay).
  - **Request Body**:
    ```json
    {
      "username": "admin",
      "password": "SuperSecretPassword123!"
    }
    ```
  - **Response (401 Unauthorized)**:
    ```json
    {
      "status": "error",
      "code": "AUTH_FAILED",
      "message": "Invalid operator credentials or account inactive. Incident logged."
    }
    ```

### 2.2 Decoy Diagnostic File Upload
- **`POST /api/v1/decoy/upload/diagnostics`**
  - **Purpose**: Enticing diagnostic / support payload upload portal.
  - **Security Guarantee**: Streams payload into isolated quarantine folder, generates UUIDv4 filename, computes SHA-256 hash, validates file size (<= 10MB), sets non-executable permissions (`0600`), emits `file_upload` security event.
  - **Content-Type**: `multipart/form-data` (field: `file`)
  - **Response (200 OK)**:
    ```json
    {
      "status": "received",
      "ticket_id": "TICKET-8942-SEC",
      "message": "Diagnostic package submitted for automated security review."
    }
    ```

### 2.3 Recon Probe Traps
- **`GET /api/v1/decoy/probe/{probe_path:path}`** or generic catch-all for scanner traps:
  - Traps probes to `/.env`, `/wp-login.php`, `/.git/config`, `/admin`, `/actuator/health`, etc.
  - Emits `recon_probe` security event with `severity: medium`.
  - Returns decoy 404 or realistic simulated error.

---

## 3. Administrative Dashboard Endpoints (Private Surface)

### 3.1 Authentication & Session
- **`POST /api/v1/auth/login`**: Authenticates admin/analyst, returns JWT access token.
- **`GET /api/v1/auth/me`**: Returns current authenticated user and role.

### 3.2 Security Overview & Metrics
- **`GET /api/v1/overview/metrics`**:
  - Returns real-time aggregate statistics.
  - **Response**:
    ```json
    {
      "total_events": 1420,
      "events_last_24h": 312,
      "unique_ips": 48,
      "failed_logins": 184,
      "quarantined_files": 12,
      "rejected_uploads": 3,
      "events_by_severity": {
        "critical": 14,
        "high": 68,
        "medium": 240,
        "low": 1098
      },
      "events_by_type": {
        "login_attempt": 184,
        "file_upload": 15,
        "recon_probe": 1150,
        "unauthorized_access": 71
      }
    }
    ```

### 3.3 Security Events Stream & Filter
- **`GET /api/v1/events`**:
  - Query Parameters: `page` (int), `limit` (int), `severity` (string), `event_type` (string), `source_ip` (string), `is_test_event` (bool), `search` (string), `start_date` (ISO8601), `end_date` (ISO8601).
  - Returns paginated list of telemetry records.
- **`GET /api/v1/events/{id}`**:
  - Returns full metadata for a specific security event, along with correlated events from the same source IP and associated file or login attempt records.

### 3.4 Evidence Locker
- **`GET /api/v1/evidence`**:
  - Paginated list of captured artifacts (`sha256_hash`, `file_size_bytes`, `detected_mime_type`, `original_filename_sanitized`, `source_ip`, `upload_timestamp`).
- **`GET /api/v1/evidence/{id}/download`**:
  - Requires `admin` role.
  - Verifies presence in quarantine storage.
  - Logs `EVIDENCE_DOWNLOAD` in `audit_logs` table.
  - Streams quarantined file as an attachment with safe content disposition.

### 3.5 Export & Audit Trail
- **`GET /api/v1/export/events`**:
  - Query parameters: format (`csv` or `json`), plus all standard event filters.
  - Logs `EVENT_EXPORT` action in `audit_logs`.
- **`GET /api/v1/audit-logs`**:
  - Returns immutable record of administrative actions.

---

## 4. Real-time Live Telemetry (WebSocket)

### Endpoint: `ws://localhost:8000/api/v1/ws/events`
- **Authentication**: JWT token sent via query param (`?token=<JWT>`) or initial handshake frame.
- **Protocol**:
  - On connection: Server sends `connection_established` with server UTC time.
  - On new event ingested: Server broadcasts:
    ```json
    {
      "type": "NEW_SECURITY_EVENT",
      "data": {
        "id": "c1f7b822-7f3e-4361-9c60-07e15bf9ec05",
        "timestamp": "2026-10-19T14:30:00Z",
        "source_ip": "198.51.100.42",
        "event_type": "login_attempt",
        "severity": "high",
        "request_path": "/api/v1/decoy/auth/login",
        "http_method": "POST",
        "user_agent": "Mozilla/5.0 ...",
        "is_test_event": false,
        "summary": "Decoy login attempt for username 'root'"
      }
    }
    ```
  - Periodic ping/pong heartbeat to maintain connection.
