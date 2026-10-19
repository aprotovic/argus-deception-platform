# ARGUS: Relational Data Model Specification

## 1. Overview
ARGUS utilizes a normalized PostgreSQL relational database schema managed via SQLAlchemy 2.0 (Async) and Alembic migrations. All timestamps are strictly stored in UTC (`TIMESTAMP WITH TIME ZONE`). UUIDv4 primary keys are utilized across security-sensitive tables to prevent sequential enumeration attacks.

---

## 2. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ AUDIT_LOGS : performs
    SECURITY_EVENTS ||--o| LOGIN_ATTEMPTS : contains
    SECURITY_EVENTS ||--o| CAPTURED_FILES : captures
    DECOY_SERVICES ||--o{ SECURITY_EVENTS : generates

    USERS {
        uuid id PK
        string username UK
        string email UK
        string hashed_password
        string role
        boolean is_active
        timestamp created_at
        timestamp updated_at
        timestamp last_login_at
    }

    DECOY_SERVICES {
        uuid id PK
        string name
        string portal_type
        string description
        boolean is_active
        integer port
        string banner_title
        jsonb config_metadata
        timestamp created_at
        timestamp updated_at
    }

    SECURITY_EVENTS {
        uuid id PK
        uuid decoy_service_id FK
        timestamp timestamp
        string source_ip
        integer source_port
        string http_method
        string request_path
        jsonb query_params
        jsonb headers_sanitized
        string user_agent
        string event_type
        string severity
        boolean is_test_event
        string correlation_id
        jsonb metadata_payload
        timestamp created_at
    }

    LOGIN_ATTEMPTS {
        uuid id PK
        uuid event_id FK, UK
        string submitted_username
        integer password_length
        string password_hmac_fingerprint
        boolean is_flagged_credential
        boolean success
        string failure_reason
        string client_ip
        string user_agent
        timestamp created_at
    }

    CAPTURED_FILES {
        uuid id PK
        uuid event_id FK, UK
        string original_filename_sanitized
        string internal_storage_path
        string sha256_hash
        bigint file_size_bytes
        string declared_mime_type
        string detected_mime_type
        string quarantine_status
        string rejection_reason
        string source_ip
        timestamp upload_timestamp
        timestamp created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        string action
        string target_type
        string target_id
        string ip_address
        string user_agent
        jsonb details
        timestamp timestamp
    }
```

---

## 3. Entity Definitions

### 3.1 `users`
Represents SOC analysts, administrators, and auditors authorized to monitor ARGUS.
- `id` (UUID, Primary Key, default `uuid4`)
- `username` (VARCHAR(64), Unique, Indexed)
- `email` (VARCHAR(255), Unique, Indexed)
- `hashed_password` (VARCHAR(255), Bcrypt hash)
- `role` (VARCHAR(32), Enum: `admin`, `analyst`, `auditor`, default `analyst`)
- `is_active` (BOOLEAN, default `true`)
- `created_at` (TIMESTAMPTZ, default UTC now)
- `updated_at` (TIMESTAMPTZ, default UTC now)
- `last_login_at` (TIMESTAMPTZ, nullable)

### 3.2 `decoy_services`
Tracks decoy configurations and honeypot profiles deployed across the organization.
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100), e.g., "Nexis Defense Core Portal")
- `portal_type` (VARCHAR(50), e.g., `defense_contractor_portal`)
- `description` (TEXT)
- `is_active` (BOOLEAN, default `true`)
- `port` (INTEGER, e.g., 8080)
- `banner_title` (VARCHAR(255))
- `config_metadata` (JSONB, default `{}`)
- `created_at` / `updated_at` (TIMESTAMPTZ)

### 3.3 `security_events`
The central immutable security telemetry record for every interaction captured by the decoy.
- `id` (UUID, Primary Key, indexed)
- `decoy_service_id` (UUID, Foreign Key to `decoy_services.id`, nullable)
- `timestamp` (TIMESTAMPTZ, indexed, UTC time when interaction occurred)
- `source_ip` (VARCHAR(45), indexed, IPv4 or IPv6)
- `source_port` (INTEGER, nullable)
- `http_method` (VARCHAR(10), e.g., `POST`, `GET`)
- `request_path` (VARCHAR(1024), indexed, e.g., `/login`, `/portal/support/upload`, `/.env`)
- `query_params` (JSONB)
- `headers_sanitized` (JSONB, cookies/tokens removed)
- `user_agent` (TEXT, indexed)
- `event_type` (VARCHAR(50), indexed, Enum: `login_attempt`, `file_upload`, `recon_probe`, `unauthorized_access`, `malformed_request`)
- `severity` (VARCHAR(20), indexed, Enum: `low`, `medium`, `high`, `critical`)
- `is_test_event` (BOOLEAN, indexed, default `false`, enables clean separation of test vs real attacks)
- `correlation_id` (VARCHAR(64), indexed, links multi-step actions from same session)
- `metadata_payload` (JSONB, extensible event metadata)
- `created_at` (TIMESTAMPTZ, default UTC now)

### 3.4 `login_attempts`
Decoy-specific credential capture record. Plaintext passwords are never retained.
- `id` (UUID, Primary Key)
- `event_id` (UUID, Foreign Key to `security_events.id`, Unique, Indexed)
- `submitted_username` (VARCHAR(255), indexed)
- `password_length` (INTEGER)
- `password_hmac_fingerprint` (VARCHAR(64), HMAC-SHA256 of submitted password using server key)
- `is_flagged_credential` (BOOLEAN, default `false`)
- `success` (BOOLEAN, default `false`, decoys never grant real access)
- `failure_reason` (VARCHAR(100), e.g., `invalid_credentials_simulated`)
- `client_ip` (VARCHAR(45))
- `user_agent` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 3.5 `captured_files`
Secure quarantine inventory for files submitted to the decoy upload interface.
- `id` (UUID, Primary Key)
- `event_id` (UUID, Foreign Key to `security_events.id`, Unique, Indexed)
- `original_filename_sanitized` (VARCHAR(255))
- `internal_storage_path` (VARCHAR(512), isolated file path on disk)
- `sha256_hash` (CHAR(64), indexed, verifiable cryptographic checksum)
- `file_size_bytes` (BIGINT)
- `declared_mime_type` (VARCHAR(100))
- `detected_mime_type` (VARCHAR(100))
- `quarantine_status` (VARCHAR(30), Enum: `quarantined`, `analyzed`, `archived`, `rejected`)
- `rejection_reason` (VARCHAR(255), nullable)
- `source_ip` (VARCHAR(45), indexed)
- `upload_timestamp` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

### 3.6 `audit_logs`
Tamper-evident log of administrative dashboard activities.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to `users.id`, nullable)
- `action` (VARCHAR(100), e.g., `EVIDENCE_DOWNLOAD`, `EVENT_EXPORT`, `AUTH_LOGIN`)
- `target_type` (VARCHAR(50), e.g., `captured_file`, `security_event`)
- `target_id` (VARCHAR(64), target identifier)
- `ip_address` (VARCHAR(45))
- `user_agent` (TEXT)
- `details` (JSONB)
- `timestamp` (TIMESTAMPTZ, default UTC now, indexed)
