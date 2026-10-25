# ARGUS: Graduation Project — Mentor Evaluation & Walkthrough Guide

**Project Title**: ARGUS: Cyber Deception & Attack-Monitoring System  
**Academic Year**: 2026  
**Target Audience**: Project Mentors, Academic Advisors, and Evaluation Committee  

---

## 📌 Executive Summary

Modern cybersecurity strategies increasingly recognize that perimeter defenses (firewalls, WAFs) are insufficient once an adversary achieves initial network access. **ARGUS** is an active cyber deception and threat telemetry platform engineered to tilt the asymmetric advantage in favor of defensive operations. 

By deploying believable, multi-layered decoy surfaces—including a consumer retail banking portal (**Geberew Bank — ገበሬው ባንክ**) and a low-interaction **MySQL 3306** protocol listener—ARGUS intercepts, slows down, and analyzes unauthorized reconnaissance and exploitation attempts before adversaries can locate genuine production assets.

---

## 🏆 Key Engineering Achievements

| Pillar | Engineering Solution | Academic & Practical Significance |
|---|---|---|
| **Architectural Isolation** | Decoy has **zero** database connection strings, credentials, or ORM engines. Events are buffered in-memory and dispatched over an authenticated mutual ingestion pipeline (`ForwardingEventSink`). | Completely prevents lateral movement or database compromise through decoy exploitation. |
| **Zero-Plaintext Policy** | Submitted passwords are never stored in plaintext. ARGUS stores only password length and an **HMAC-SHA256 fingerprint** salted with an isolated server key. | Protects privacy, prevents credential leakage, and enables mathematical clustering of coordinated credential-stuffing campaigns. |
| **High-Fidelity Web Decoy** | **Geberew Bank (ገበሬው ባንክ)**: Built using React 18, TypeScript, and Tailwind CSS. Features 3D card physics, Amharic (Ge'ez) localization, two-factor authentication (OTP) simulation, and statements download. | Maximizes attacker dwell time and psychological deception without disclosing honeypot markers. |
| **Multi-Vector Decoys** | Web Banking Decoy (Port 8081) + Web Recon Traps (`robots.txt`, `/.env`, `/.git`, `/wp-login.php`) + Raw TCP MySQL Decoy (Port 3306). | Catches diverse attacker profiles: automated web crawlers, manual web penetration testers, and database port scanners. |
| **Live SOC Dashboard** | Real-time monitoring interface connected via persistent WebSockets, featuring dynamic MITRE ATT&CK mapping, GeoIP global threat intelligence, and algorithmic risk scoring. | Delivers immediate operational visibility and actionable forensic evidence for SOC analysts. |
| **Out-of-Band Alerting** | Automatic push alerting via a dedicated Telegram bot (`@Deception_argusBot`). | Ensures real-time crisis notification without relying on web browser presence. |
| **Evidence Locker** | Quarantined file ingestion with streaming SHA-256 calculation and non-executable storage. Exportable forensic dossiers in PDF, CSV, and JSON. | Preserves chain of custody for post-incident reporting and academic compliance. |

---

## 🔑 Evaluator Credentials Quick Reference

| Role / Component | URL / Target | Credentials / Identifiers | Notes |
|---|---|---|---|
| **SOC Dashboard Operator** | [http://127.0.0.1:3000](http://127.0.0.1:3000) | **Username**: `argus_admin`<br>**Password**: `ArgusAdmin2026!ChangeMe` | Full administrative access to telemetry, maps, and export |
| **Bank Decoy (Bait User 1)** | [http://127.0.0.1:8081/bank/login](http://127.0.0.1:8081/bank/login) | **Username**: `j.hartwell`<br>**Password**: `Hartwell2024!` | Triggers realistic 2FA OTP escalation modal |
| **Bank Decoy (Bait User 2)** | [http://127.0.0.1:8081/bank/login](http://127.0.0.1:8081/bank/login) | **Username**: `m.chen`<br>**Password**: `Chen@Banking1` | Triggers secondary fake retail user profile |
| **Core Ingestion API Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Open Swagger UI | Comprehensive OpenAPI 3.0 documentation |
| **MySQL Decoy Port** | `127.0.0.1:3306` | Any MySQL client probe | Emulates MySQL 8.0 handshake |
| **Telegram Live Alert Bot** | [@Deception_argusBot](https://t.me/Deception_argusBot) | Public Telegram Bot | Dispatches instant push alerts for High/Critical events |

---

## ⏱️ 5-Minute Evaluation Walkthrough

Follow these 5 steps to test the full end-to-end platform capabilities:

### Step 1: Start the Platform
Choose **one** of the following:
- **Windows One-Click**: Double click `start_argus.bat` (or execute `python scripts\run_all.py`).
- **Linux / macOS**: Run `python scripts/run_all.py`.
- **Docker Compose**: Run `docker compose up --build`.

---

### Step 2: Open the SOC Monitoring Dashboard
1. Navigate to **[http://127.0.0.1:3000](http://127.0.0.1:3000)** in Chrome or Edge.
2. Sign in with:
   - **Username**: `argus_admin`
   - **Password**: `ArgusAdmin2026!ChangeMe`
3. Notice the live dashboard metrics: Total Interactions, Threat Score, Risk Level, and the Real-Time Event Stream connected via WebSockets.

---

### Step 3: Explore the Geberew Bank Decoy Portal
1. Open a new browser tab or incognito window to **[http://127.0.0.1:8081](http://127.0.0.1:8081)**.
2. Notice the high visual fidelity:
   - Click the language toggle to switch between **English** and **አማርኛ** (**ገበሬው ባንክ**).
   - Navigate to the **Cards** page to inspect interactive 3D card flips.
   - Note that no software identifiers or honeypot keywords (ARGUS, honeypot, decoy) exist anywhere in the source or asset bundles.

---

### Step 4: Execute Live Attack Scenarios

#### Scenario A — Credential Stuffing & 2FA Bait Escalation
1. On the bank decoy portal ([http://127.0.0.1:8081/bank/login](http://127.0.0.1:8081/bank/login)), sign in with bait credentials:
   - Username: `j.hartwell`
   - Password: `Hartwell2024!`
2. The portal displays a convincing 2FA challenge: *"Verification code sent to ••••••••47"*.
3. Switch back to your SOC Dashboard tab: notice the immediate arrival of a `credential_stuffing` or `login_attempt` event with an HMAC password fingerprint (plaintext is strictly omitted).

#### Scenario B — SQL Injection (SQLi)
1. On the login form, enter `' OR 1=1 --` into the username field and submit.
2. The SOC Dashboard instantly flags the attack, maps it to MITRE ATT&CK **T1190 (Exploit Public-Facing Application)**, and elevates the threat score.

#### Scenario C — Automated Multi-Vector Simulation
To demonstrate high-volume traffic analysis and live stress testing, open a terminal and run:
```bash
python scripts/simulate_traffic.py --count 16
```
This automatically executes:
- Scanner recon probes against `/.env`, `/.git`, and `/robots.txt`.
- MySQL TCP handshakes against port `3306`.
- File quarantine uploads with live SHA-256 calculation.
- Credential-stuffing attacks.

---

### Step 5: Verify Threat Intelligence & Evidence Export
1. On the SOC Dashboard, navigate to the **Intel Map** tab: view geographical clustering of incoming source IPs.
2. Inspect the **MITRE ATT&CK** matrix visualization: observe which tactics (Reconnaissance, Initial Access, Credential Access) have been triggered.
3. Click **Export Report** (top right) to download a comprehensive forensic dossier in PDF, CSV, or JSON format.

---

## 🧪 Automated Testing & Code Verification

ARGUS adheres to rigorous automated testing standards. Evaluators may verify all test suites by running:

```bash
# 1. Run all 372 automated unit & integration tests
pytest

# 2. Verify bundle security (confirms 0 honeypot keywords leak to the attacker)
node scripts/check-bundle.mjs

# 3. Verify Amharic (ገበሬው ባንክ) i18n translation coverage
node scripts/check-i18n.mjs
```

**Test Coverage Summary**:
- `tests/integration/test_bank_decoy.py`: 17 tests (Decoy routes, OTP challenges, rate limits).
- `tests/integration/test_decoy_main.py`: 23 tests (Decoy autonomy, isolated error handling).
- `tests/integration/test_mysql_decoy.py`: 10 tests (Raw TCP protocol handshake, packet framing).
- `tests/unit/test_security_helpers.py`: Password fingerprinting, header sanitization, IP extraction.
- `tests/unit/test_forwarding_sink.py`: Decoy event buffering and mutual token authentication.
- **Total**: **372 passed, 0 failed**.

---

## 🌐 Remote Deployment Guide (For Online Demonstrations)

If mentors wish to evaluate ARGUS remotely over the internet without local installation:

### Quick Cloudflare Tunnel (Free & Instant)
```bash
# Expose SOC Dashboard:
cloudflared tunnel --url http://localhost:3000

# Expose Geberew Bank Decoy:
cloudflared tunnel --url http://localhost:8081
```
Cloudflare will provide instant public HTTPS URLs that can be shared with mentors for live grading anywhere.

---

## 👥 Student Team & Contact
- **Muaz**: Decoy Frontend Architecture & Geberew Bank Single-Page Application
- **Zyad**: Evidence Locker, Email/Telegram Dispatchers, and Forensic Reporting
- **Goitom**: Core Ingestion Backend, MySQL Protocol Decoy, and Security Architecture
