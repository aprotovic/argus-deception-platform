# ARGUS: Automated Testing & Validation Guide

## 1. Testing Philosophy
The ARGUS platform enforces rigorous automated testing across all security-critical functions:
- Telemetry ingestion without data loss.
- Zero plaintext password leakage (length and HMAC fingerprint verification).
- Quarantine isolation (randomized UUID filenames, non-executable attributes, path traversal blocking).
- Accurate streaming SHA-256 calculation.
- Rate limiting and probe trap handling.
- JWT authentication, RBAC authorization, and tamper-evident audit logging.
- Distinguishing test events (`is_test_event=True`) from genuine in-the-wild interactions.

---

## 2. Test Execution & Verified Results

### 2.1 Backend Automated Suite (`pytest`)
Execute the full test suite with:
```bash
.venv\Scripts\pytest -v
```

### Verified Test Run Summary:
```
============================= test session starts =============================
platform win32 -- Python 3.13.14, pytest-8.4.2
rootdir: C:\Users\HP\Documents\edu\ARGUS Project
plugins: anyio-4.15.1, asyncio-0.25.3, cov-5.0.0
collected 14 items

tests/integration/test_dashboard_api.py::test_dashboard_auth_login_success_and_failure PASSED [  7%]
tests/integration/test_dashboard_api.py::test_dashboard_metrics_and_events_listing PASSED     [ 14%]
tests/integration/test_dashboard_api.py::test_evidence_download_rbac_and_audit_logging PASSED [ 21%]
tests/integration/test_decoy_endpoints.py::test_decoy_login_records_telemetry_without_plaintext_password PASSED [ 28%]
tests/integration/test_decoy_endpoints.py::test_decoy_safe_file_upload_quarantine_and_hashing PASSED [ 35%]
tests/integration/test_decoy_endpoints.py::test_decoy_scanner_probe_trap PASSED             [ 42%]
tests/unit/test_quarantine_storage.py::test_sanitize_filename_blocks_path_traversal PASSED    [ 50%]
tests/unit/test_quarantine_storage.py::test_detect_mime_type_magic_bytes PASSED               [ 57%]
tests/unit/test_quarantine_storage.py::test_store_quarantined_upload_success PASSED            [ 64%]
tests/unit/test_security_helpers.py::test_password_hashing_and_verification PASSED             [ 71%]
tests/unit/test_security_helpers.py::test_password_fingerprint_never_exposes_plaintext PASSED [ 78%]
tests/unit/test_security_helpers.py::test_jwt_access_token_creation_and_decode PASSED        [ 85%]
tests/unit/test_security_helpers.py::test_jwt_invalid_token_decode PASSED                     [ 92%]
tests/unit/test_security_helpers.py::test_header_sanitization_removes_sensitive_tokens PASSED [100%]

============================= 14 passed in 5.24s ==============================
```

---

## 3. Controlled Traffic Simulation Validation

To safely validate the end-to-end telemetry pipeline without relying on external attackers:
```bash
.venv\Scripts\python scripts/simulate_traffic.py --target http://localhost:8000 --count 15
```

The simulator verifies:
1. Recon probes (`/.env`, `/wp-login.php`, `/.git/config`, `/admin`).
2. Brute-force credential stuffing attempts (common usernames, varying password lengths).
3. Safe dummy file uploads (benign text/dump files) validating quarantine storage and streaming SHA-256 calculation.
4. Marking synthetic traffic with `is_test_event=True` so it can be filtered in the dashboard from genuine internet observations.
