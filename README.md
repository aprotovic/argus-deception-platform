# ARGUS: Cyber Deception & Attack-Monitoring System

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18+](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Tests Passing](https://img.shields.io/badge/tests-372%20passed-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

ARGUS is a modern cyber deception and attack-monitoring platform built to detect, analyze, and respond to unauthorized reconnaissance and malicious activity in real time.

In Greek mythology, Argus Panoptes (meaning "All-seeing Argos") was a giant with a hundred eyes spread across his body, a fitting inspiration for a platform designed to observe and detect malicious activity from every angle.

It combines realistic decoy environments, attacker telemetry collection, and a live SOC dashboard to help security teams observe behavior, identify threats, and investigate incidents without exposing production systems.

---

Video Link

Muaz Muhammed :  https://drive.google.com/file/d/1TRa1Jj0W6da4-xxK-Usg0Du-ZD6oQ_d9/view?usp=sharing

---

## Why ARGUS?

Most organizations detect attacks too late. ARGUS helps you see the early signals:

- Reconnaissance and scanning activity before critical systems are touched
- Credential abuse and login attempts against deceptive services
- SQL injection and database probing against fake targets
- Attack behavior mapped to MITRE ATT&CK techniques
- High-signal investigation workflows for analysts and researchers

---

## Key Capabilities

- Isolated decoy services with no database access or ORM credentials
- Zero-plaintext security policy for sensitive data; credentials are logged only as length and HMAC-SHA256 fingerprints
- Realistic retail banking decoy environment with English and Amharic support, including simulated 2FA challenges
- Low-interaction MySQL TCP decoy for capturing unauthorized database queries and authentication attempts
- Real-time SOC dashboard with WebSocket event streaming, MITRE ATT&CK mapping, GeoIP visualization, and PDF reporting
- Simulated attack traffic generation for reconnaissance, SQL injection, credential stuffing, and MySQL probing

---

## Platform Overview

ARGUS brings together multiple components to create a convincing attacker trap and a powerful monitoring layer:

- SOC Dashboard — real-time incident monitoring and threat analysis
- Geberew Bank Decoy — deceptive banking portal designed to attract suspicious activity
- Backend API — event ingestion, processing, and dashboard data services
- MySQL Decoy — fake database service that captures probing and authentication attempts
- Reporting Layer — PDF and forensic summaries for investigations

---

## Quick Start

### Prerequisites

- Python 3.11+
- Docker and Docker Compose
- Node.js / React runtime for frontend services

### Option 1: Run with Windows Launcher

Double-click `start_argus.bat` or run:

```powershell
python scripts/run_all.py
```

### Option 2: Run with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

---

## Services and Ports

| Service | Address | Description |
|---|---|---|
| SOC Dashboard | `http://127.0.0.1:3000` | Incident monitoring interface |
| Geberew Bank Decoy | `http://127.0.0.1:8081` | Web honeypot portal |
| Backend API Docs | `http://127.0.0.1:8000/docs` | OpenAPI documentation |
| MySQL Decoy | `127.0.0.1:3306` | Emulated MySQL TCP service |

> Default configuration and environment variables are managed through `.env.example`.

---

## Simulated Attacks and Testing

Generate attack traffic to validate detection and monitoring workflows:

```bash
python scripts/simulate_traffic.py --count 16
```

Run the automated test suite:

```bash
pytest
```

Current status: 372 passed, 0 failed.

---

## Team

- Goitom Shumey — CTC-5128-26 | Backend & Core Ingestion
- Muaz Muhammed — CTC-3666-26 | Decoy Frontend Architecture
- Ziyad Seyoum — CTC-7694-26 | Security Engineering & Forensic Reporting
- Bereket Worana — CTC-5170-26 | Cyber Deception & Threat Intelligence

---

## License

This project is licensed under the [MIT License](LICENSE).

Academic Graduation Capstone Project.
