"""Controlled traffic simulator for validating the ARGUS cyber deception pipeline.

Generates realistic adversary interactions across all ARGUS surfaces:
1. Reconnaissance scanner probes (robots.txt, .env, .git, actuator, wp-login)
2. Geberew Bank credential stuffing & brute-force attempts
3. SQL Injection attacks targeting bank authentication
4. Honeytoken file access & quarantine uploads
5. MySQL protocol honeypot probes
"""

import argparse
import io
import socket
import sys
import time
import httpx

RECON_PATHS = [
    "/robots.txt",
    "/.env",
    "/.git/config",
    "/wp-login.php",
    "/actuator/health",
    "/admin-console",
    "/internal/backups/db.sql",
    "/satcom/uplink-keys/comm.key",
    "/firmware/releases/v2.1.bin",
]

BANK_USERS = [
    ("j.hartwell", "Hartwell2024!", True),    # Fake bait account (triggers OTP challenge)
    ("m.chen", "Chen@Banking1", True),        # Fake bait account
    ("admin", "Admin12345!", False),          # Brute-force
    ("root", "toor", False),                  # Brute-force
    ("operator_bank", "Winter2026!", False),   # Brute-force
    ("' OR 1=1 --", "password123", False),    # SQL Injection attempt
    ("test_user'; DROP TABLE accounts;--", "x", False), # SQLi
]

SAMPLE_FILES = [
    ("payroll_export_2026.xlsx", b"FAKE SPREADSHEET CONTENT: Employee,Salary\nJohn,5000", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("backup_config.conf", b"DB_HOST=10.0.0.1\nDB_PASS=SuperSecret123!", "text/plain"),
    ("patch_installer.sh", b"#!/bin/bash\necho 'Deploying mock patch'", "text/x-shellscript"),
]


def test_mysql_probe(host: str = "127.0.0.1", port: int = 3306):
    """Sends a raw handshake probe to the MySQL decoy honeypot."""
    try:
        s = socket.create_connection((host, port), timeout=3)
        banner = s.recv(100)
        s.close()
        return True, len(banner)
    except Exception as e:
        return False, str(e)


def run_simulation(
    backend_url: str = "http://127.0.0.1:8000",
    decoy_url: str = "http://127.0.0.1:8081",
    count: int = 15,
    test_mode: bool = True,
):
    print("=" * 70)
    print("  ARGUS Cyber Deception Platform - Automated Traffic Simulator")
    print("=" * 70)
    print(f"[*] Core Backend Ingestion Target : {backend_url}")
    print(f"[*] Public Decoy Target           : {decoy_url}")
    print(f"[*] Simulation Batch Size         : {count} events")
    print(f"[*] Evaluator Test Mode Flag       : {test_mode}")
    print("-" * 70)

    client = httpx.Client(timeout=10.0)
    headers = {"X-Argus-Test-Token": "controlled_evaluator_run"} if test_mode else {}
    success_count = 0

    # 1. Test MySQL Honeypot Probe
    print("\n--- [Phase 1: MySQL Honeypot Network Probe] ---")
    mysql_ok, banner_info = test_mysql_probe()
    if mysql_ok:
        print(f"[+] MySQL Decoy (Port 3306) Connected -> Captured Server Greeting ({banner_info} bytes)")
        success_count += 1
    else:
        print(f"[-] MySQL Decoy not reachable on 3306 ({banner_info}) — skipping TCP probe.")

    # 2. Main Simulation Loop
    print("\n--- [Phase 2: Web Reconnaissance & Bank Decoy Interactions] ---")
    for i in range(count):
        action = i % 4

        try:
            if action == 0:
                # Recon Probe on Decoy
                path = RECON_PATHS[i % len(RECON_PATHS)]
                target = f"{decoy_url}{path}"
                res = client.get(target, headers=headers)
                print(f"[{i+1}/{count}] RECON SCANNER -> GET {path} -> HTTP {res.status_code}")
                success_count += 1

            elif action == 1:
                # Bank Decoy Login
                user, pwd, is_bait = BANK_USERS[i % len(BANK_USERS)]
                res = client.post(
                    f"{decoy_url}/api/v1/bank/auth/login",
                    data={"username": user, "password": pwd},
                    headers=headers,
                )
                status = res.status_code
                payload = res.json() if status == 200 else {}
                requires_otp = payload.get("requires_otp", False)
                print(
                    f"[{i+1}/{count}] BANK LOGIN    -> user: '{user}' -> HTTP {status} "
                    f"(Bait OTP: {requires_otp})"
                )

                # If bait account triggered OTP, simulate attacker attempting OTP submission
                if requires_otp and "session_token" in payload:
                    time.sleep(0.1)
                    otp_res = client.post(
                        f"{decoy_url}/api/v1/bank/auth/otp",
                        data={"session_token": payload["session_token"], "otp": "999999"},
                        headers=headers,
                    )
                    print(f"      -> BANK OTP      -> submitted '999999' -> HTTP {otp_res.status_code}")

                success_count += 1

            elif action == 2:
                # SQL Injection Probe
                sqli_payload = "sensor_id = 'RADAR-01' OR '1'='1'"
                res = client.post(
                    f"{backend_url}/api/v1/decoy/query/telemetry",
                    data={"query_filter": sqli_payload},
                    headers=headers,
                )
                print(f"[{i+1}/{count}] SQL INJECTION -> POST /decoy/query/telemetry -> HTTP {res.status_code}")
                success_count += 1

            else:
                # Quarantined Upload
                fname, content, mime = SAMPLE_FILES[i % len(SAMPLE_FILES)]
                files = {"file": (fname, io.BytesIO(content), mime)}
                res = client.post(
                    f"{backend_url}/api/v1/decoy/upload/diagnostics",
                    files=files,
                    headers=headers,
                )
                res_data = res.json() if res.status_code == 200 else {}
                sha = res_data.get("artifact_hash", "none")[:12]
                print(f"[{i+1}/{count}] FILE UPLOAD   -> '{fname}' -> HTTP {res.status_code} (Quarantine SHA: {sha}...)")
                success_count += 1

        except Exception as e:
            print(f"[!] Error simulating action #{i+1}: {e}")

        time.sleep(0.15)

    print("-" * 70)
    print(f"[OK] Simulation completed: {success_count}/{count + 1} interactions recorded.")
    print("[*] Open the SOC Dashboard (http://127.0.0.1:3000) to view live ingested telemetry!")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ARGUS Controlled Traffic Simulation Tool")
    parser.add_argument("--backend", default="http://127.0.0.1:8000", help="Core Backend URL")
    parser.add_argument("--decoy", default="http://127.0.0.1:8081", help="Decoy Portal URL")
    parser.add_argument("--count", type=int, default=16, help="Number of interactions to simulate")
    parser.add_argument("--genuine", action="store_true", help="Simulate without test flag (live SOC alert)")

    args = parser.parse_args()
    run_simulation(args.backend, args.decoy, args.count, test_mode=not args.genuine)
