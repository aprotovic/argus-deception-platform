# ARGUS: Cyber Deception & Attack-Monitoring System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18+](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

ARGUS is a cyber deception and telemetry capture platform designed as a Software Engineering graduation project. It deploys a vulnerable-looking, isolated decoy portal to safely divert unauthorized actors, capture tamper-evident security telemetry, quarantine uploaded artifacts, and visualize genuine interaction metrics in a live Security Operations Center (SOC) dashboard.

---

## Key Capabilities

- **Realistic Decoy Surface**: Convincing corporate portal interface ("Nexis Defense Core Portal") featuring simulated authentication, password recovery, and diagnostic payload upload endpoints.
- **Zero-Plaintext Credential Policy**: Attacker-submitted passwords are never stored in plaintext. ARGUS records password length and computes an HMAC-SHA256 fingerprint using a dedicated server-side secret key to identify coordinated credential stuffing attacks safely.
- **Safe Payload Quarantine**: Submitted files are captured via streaming I/O, stored in a non-executable directory with UUIDv4 filenames, assigned verifiable SHA-256 hashes, and isolated from standard OS parsers.
- **Real-time SOC Monitoring Dashboard**: Interactive React + TypeScript + Tailwind CSS monitoring interface connected via WebSockets for real-time attack stream visualization, deep event inspection, evidence management, and data export (CSV/JSON).
- **Hardened Architecture**: Full container isolation, unprivileged user execution, read-only root filesystems, strict network segmentation, JWT authentication, and comprehensive audit trails.

---

## Architectural Topology

```mermaid
flowchart LR
    Adversary[Adversary / Probe Scanner] -->|Port 8080| Decoy[ARGUS Decoy Service]
    Decoy -->|POST /api/v1/internal/ingest| Backend[ARGUS Core Backend API]
    Backend -->|SQLAlchemy| Postgres[(PostgreSQL 16)]
    Backend -->|Safe Quarantine Write| Storage[(Quarantine Storage)]
    
    Analyst[SOC Analyst / Admin] -->|Port 3000| Dashboard[ARGUS React Dashboard]
    Dashboard -->|REST / WebSocket (Port 8000)| Backend
```

---

## Quickstart (Development Mode)

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- Docker and Docker Compose (recommended)

### 1. Clone & Setup Environment
```bash
git clone <repo_url>
cd "ARGUS Project"
cp .env.example .env
```

### 2. Docker Compose (Full Stack)
```bash
docker compose up --build
```
- **Decoy Portal**: `http://localhost:8080`
- **SOC Operations Dashboard**: `http://localhost:3000`
- **Backend API & Swagger Docs**: `http://localhost:8000/docs`

---

## Documentation Index
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Security Architecture & Threat Model](docs/SECURITY_ARCHITECTURE.md)
- [Relational Data Model](docs/DATA_MODEL.md)
- [REST & WebSocket API Reference](docs/API.md)
- [Testing & Validation Guide](docs/TESTING.md)
- [Deployment & Operational Procedures](docs/DEPLOYMENT.md)
- [Known Limitations & Roadmap](docs/KNOWN_LIMITATIONS.md)

---

## License
Academic Graduation Project — Developed under the Software Engineering Department.
