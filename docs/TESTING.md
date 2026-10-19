# ARGUS: Automated Testing & Validation Guide

## 1. Testing Philosophy
The ARGUS platform requires comprehensive automated testing across all security-critical functions:
- Telemetry ingestion without data loss.
- Zero plaintext password leakage (length and HMAC fingerprint verification).
- Quarantine isolation (randomized filenames, non-executable attributes, path traversal blocking).
- Accurate SHA-256 calculation.
- Rate limiting and malformed request handling.
- JWT authentication, RBAC authorization, and tamper-evident audit logging.
- Distinguishing test events (`is_test_event=True`) from genuine in-the-wild interactions.

---

## 2. Test Suites

### 2.1 Backend Unit & Integration Tests (`pytest`)
The backend test suite is executed using `pytest` with asynchronous test fixtures (`pytest-asyncio`). Tests run against an isolated in-memory or ephemeral test database.

```bash
# Run complete test suite with coverage
pytest tests/ -v --cov=app --cov-report=term-missing
```

#### Test Structure
- `tests/unit/test_security_helpers.py`: Tests password HMAC fingerprinting, header sanitization, IP extraction, and token validation.
- `tests/unit/test_quarantine_storage.py`: Tests path traversal prevention, safe file hashing, storage limits, and file quarantine.
- `tests/integration/test_decoy_endpoints.py`: Tests `/api/v1/decoy/auth/login`, file upload, probe traps, and database persistence.
- `tests/integration/test_dashboard_api.py`: Tests JWT authentication, RBAC authorization, metrics calculation, and audit log generation.
- `tests/integration/test_websocket_stream.py`: Tests real-time event broadcasting over WebSockets.

---

## 3. Controlled Traffic Simulation Script

To safely validate the end-to-end telemetry pipeline without relying on external attackers:
```bash
# Generate safe, synthetic test traffic marked with is_test_event=True
python scripts/simulate_traffic.py --target http://localhost:8080 --count 25
```

The simulator triggers:
1. Recon probes (`/.env`, `/wp-login.php`, `/.git/config`, `/admin`).
2. Brute-force credential stuffing attempts (common usernames, varying password lengths).
3. Safe dummy file uploads (benign text/log files) to test quarantine and hashing.
4. Edge-case malformed HTTP requests.
