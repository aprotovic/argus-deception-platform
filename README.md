# ARGUS: Cyber Deception & Attack-Monitoring System

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18+](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Tests Passing](https://img.shields.io/badge/tests-372%20passed-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📌 Overview

**ARGUS** is an active cyber deception and threat-monitoring platform. It deploys isolated decoy services to attract, detect, and analyze unauthorized reconnaissance and attacks in real time without exposing production infrastructure.

### Key Capabilities
- **Isolated Decoys**: Decoy services have zero database access or ORM credentials.
- **Zero-Plaintext Policy**: Passwords are never logged in plaintext; only length and HMAC-SHA256 fingerprints are stored.
- **Retail Banking Decoy**: Realistic banking interface (**Geberew Bank — ገበሬው ባንክ**) with English/Amharic support and simulated 2FA challenges.
- **MySQL Protocol Decoy**: Low-interaction TCP service on port 3306 capturing unauthorized database queries and authentication attempts.
- **Live SOC Dashboard**: Real-time WebSocket event streaming, MITRE ATT&CK mapping, GeoIP threat map, and PDF export.

---

## 👥 Team Members

- **Goitom Shumey Gebremariam** — Backend & Core Ingestion
- **Muaz Muhammed** — Decoy Frontend Architecture
- **Zyad** — Security Engineering & Forensic Reporting
- **Bereket Worana** — Cyber Deception & Threat Intelligence

---

## 🚀 Quickstart

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

## 🌐 Services & Ports

| Service | Address | Description |
|---|---|---|
| **SOC Dashboard** | `http://127.0.0.1:3000` | Incident monitoring interface |
| **Geberew Bank Decoy** | `http://127.0.0.1:8081` | Web honeypot portal |
| **Backend API Docs** | `http://127.0.0.1:8000/docs` | OpenAPI documentation |
| **MySQL Decoy** | `127.0.0.1:3306` | Emulated MySQL TCP service |

> Default configuration and environment variables can be configured in `.env.example`.

---

## 🧪 Simulation & Automated Tests

Generate simulated attack traffic (scanner recon, SQL injection, credential stuffing, and MySQL probes):
```bash
python scripts/simulate_traffic.py --count 16
```

Run test suite:
```bash
pytest
```
*Result: 372 passed, 0 failed.*

---

## 📄 License
MIT License — Academic Graduation Capstone Project
