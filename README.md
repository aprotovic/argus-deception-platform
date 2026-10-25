# ARGUS: Cyber Deception & Attack-Monitoring System

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18+](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Tests Passing](https://img.shields.io/badge/tests-372%20passed-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

ARGUS is an active cyber deception and threat-monitoring platform designed to detect, analyze, and respond to unauthorized reconnaissance and attack activity in real time. The system deploys isolated decoy services to lure adversaries, collect telemetry, and surface high-value forensic signals without exposing production assets.

### Key Capabilities

- Isolated decoy services with no database access or ORM credentials.
- Zero-plaintext policy for sensitive data; credentials are logged only as length and HMAC-SHA256 fingerprints.
- Realistic retail banking decoy experience with English and Amharic support, including simulated 2FA challenges.
- Low-interaction MySQL TCP decoy for capturing unauthorized database queries and authentication attempts.
- Real-time SOC dashboard with WebSocket event streaming, MITRE ATT&CK mapping, GeoIP visualization, and PDF reporting.

---

## Team Members

- Goitom Shumey — CTC-5128-26 | Backend & Core Ingestion
- Muaz Muhammed — CTC-XXXX-XX | Decoy Frontend Architecture
- Zyad — CTC-XXXX-XX | Security Engineering & Forensic Reporting
- Bereket Worana — CTC-5170-26 | Cyber Deception & Threat Intelligence

---

## Quickstart

### 1. Run with Windows Launcher

Double-click `start_argus.bat` or run:

```powershell
python scripts/run_all.py
```

### 2. Run with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

---

## Services & Ports

| Service | Address | Description |
|---|---|---|
| SOC Dashboard | `http://127.0.0.1:3000` | Incident monitoring interface |
| Geberew Bank Decoy | `http://127.0.0.1:8081` | Web honeypot portal |
| Backend API Docs | `http://127.0.0.1:8000/docs` | OpenAPI documentation |
| MySQL Decoy | `127.0.0.1:3306` | Emulated MySQL TCP service |

> Default configuration and environment variables are managed through `.env.example`.

---

## Simulation & Automated Tests

Generate simulated attack traffic including scanner reconnaissance, SQL injection attempts, credential stuffing, and MySQL probes:

```bash
python scripts/simulate_traffic.py --count 16
```

Run the test suite:

```bash
pytest
```

Result: 372 passed, 0 failed.

---

## License

MIT License — Academic Graduation Capstone Project
