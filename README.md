# ARGUS: Cyber Deception & Attack-Monitoring System

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18+](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Tests Passing](https://img.shields.io/badge/tests-372%20passed-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎓 INSA Cyber Talent Center (CTC) — Submission Details

| Requirement | Project Submission Details |
|---|---|
| **Project Title** | **ARGUS: Cyber Deception & Attack-Monitoring System** |
| **GitHub Repository** | `https://github.com/aprotovic/argus-deception-platform` |
| **Team Members** | • **Goitom Shumey Gebremariam** (Team Lead / Backend)<br>• **Muaz Muhammed** (Frontend / Decoy UI)<br>• **Zyad** (Security Engineer / Forensics)<br>• **Bereket Worana** (Cyber Deception / Security Analyst) |
| **Video Presentation** | • **Full HD 1080p Video**: [`output/argus_presentation_demo.mp4`](output/argus_presentation_demo.mp4)<br>• **Voice Script**: [`docs/DEMO_VIDEO_VOICE_SCRIPT.md`](docs/DEMO_VIDEO_VOICE_SCRIPT.md) |
| **Mentor Guide** | [`docs/MENTOR_GUIDE.md`](docs/MENTOR_GUIDE.md) |

---

## 📌 Overview

**ARGUS** is an enterprise-grade cyber deception platform that deploys high-fidelity decoy surfaces—including a realistic retail banking portal (**Geberew Bank — ገበሬው ባንክ**) and a low-interaction **MySQL 3306** protocol listener—to divert attackers away from real infrastructure, quarantine malicious uploads, and visualize real-time attack telemetry in a live SOC dashboard.

### Core Features
- **Zero Database Access**: Decoys have no database connection or ORM access.
- **Zero-Plaintext Policy**: Passwords are never logged in plaintext; only lengths and HMAC-SHA256 fingerprints are stored.
- **High-Fidelity Banking Decoy**: Built with React + TypeScript + Tailwind, featuring 3D cards, bilingual Amharic localization, and simulated 2FA OTP challenges.
- **Real-Time SOC Dashboard**: Live WebSocket streaming, MITRE ATT&CK mapping, GeoIP threat map, and PDF evidence export.
- **Out-of-Band Alerts**: Instant push alerts to Telegram ([@Deception_argusBot](https://t.me/Deception_argusBot)).

---

## 🚀 Quickstart

### Option 1: One-Click Local Launcher (Windows)
Double-click `start_argus.bat` (or run `python scripts/run_all.py`).

### Option 2: Docker Compose (Linux / macOS / Production)
```bash
cp .env.example .env
docker compose up --build
```

### Services & URLs
| Service | URL / Port | Description |
|---|---|---|
| **SOC Dashboard** | [http://127.0.0.1:3000](http://127.0.0.1:3000) | Live incident monitoring |
| **Geberew Bank Decoy** | [http://127.0.0.1:8081](http://127.0.0.1:8081) | Public banking honeypot |
| **Backend API Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | OpenAPI / Swagger docs |
| **MySQL Decoy** | `127.0.0.1:3306` | Emulated MySQL TCP port |

---

## 🔑 Default Credentials

- **SOC Dashboard** (`http://127.0.0.1:3000`):
  - **Username**: `argus_admin`
  - **Password**: `ArgusAdmin2026!ChangeMe`

- **Bank Decoy Bait Accounts** (`http://127.0.0.1:8081/bank/login`):
  - **User 1**: `j.hartwell` / `Hartwell2024!` *(Triggers 2FA OTP modal)*
  - **User 2**: `m.chen` / `Chen@Banking1`
  - **SQL Injection**: `' OR 1=1 --`

---

## 🧪 Live Attack Simulation

To populate the SOC dashboard with simulated attacks (SQLi, scanner recon, credential stuffing, file uploads, MySQL probes):

```bash
python scripts/simulate_traffic.py --count 16
```

---

## 📚 Documentation

- 📋 [**Mentor Evaluation & Walkthrough Guide**](docs/MENTOR_GUIDE.md)
- 🎙️ [**5-Minute Video Voice Script**](docs/DEMO_VIDEO_VOICE_SCRIPT.md)
- 🛡️ [Security Architecture](docs/SECURITY_ARCHITECTURE.md)
- 🔌 [API Reference](docs/API.md)
- 🗄️ [Data Model](docs/DATA_MODEL.md)

---

## 🧪 Automated Tests

Run the test suite:
```bash
pytest
```
*Result: 372 / 372 passed (100%).*

---

## 📄 License
Academic Graduation Capstone Project — MIT License
