"""Controlled traffic simulator for validating the ARGUS cyber deception pipeline."""

import argparse
import io
import sys
import time
import httpx

PROBE_PATHS = [
    "/.env",
    "/wp-login.php",
    "/.git/config",
    "/admin",
    "/api/v1/debug",
    "/actuator/health",
    "/phpinfo.php",
    "/etc/passwd",
]

USERNAMES = [
    "admin",
    "root",
    "sysadmin",
    "secops_lead",
    "defense_contractor_84",
    "j.smith",
    "oracle",
]

PASSWORDS = [
    "Winter2026!Password",
    "Admin12345",
    "P@ssw0rdSecureEnclave",
    "SuperSecretKey99",
    "toor",
    "nexis_internal_operator_key",
]

SAMPLE_FILES = [
    ("kernel_crash.dmp", b"MEMORY DUMP HEADER: 0x89421A\n[STACKTRACE] simulated crash kernel 6.8", "application/octet-stream"),
    ("sysdiagnose_node4.log", b"LOG: 2026-10-19T14:00:00Z Node-4 active connections: 42\nError code: ERR_NET_CONN", "text/plain"),
    ("patch_update.sh", b"#!/bin/bash\n# Diagnostic validation probe script\necho 'Test probe active'", "text/x-shellscript"),
]


def run_simulation(target_url: str, count: int, test_mode: bool = True):
    print(f"[*] Connecting to ARGUS target: {target_url}")
    print(f"[*] Generating {count} simulated interactions (Test Flag: {test_mode})...\n")

    client = httpx.Client(timeout=10.0)
    headers = {"X-Argus-Test-Token": "controlled_evaluator_run"} if test_mode else {}

    success_count = 0

    for i in range(count):
        action_type = i % 3

        try:
            if action_type == 0:
                # 1. Recon Scanner Probe
                probe_path = PROBE_PATHS[i % len(PROBE_PATHS)]
                url = f"{target_url}/api/v1/decoy/probe{probe_path}"
                res = client.get(url, headers=headers, params={"test": "1"} if test_mode else {})
                print(f"[{i+1}/{count}] PROBE -> {probe_path} (HTTP {res.status_code})")
                success_count += 1

            elif action_type == 1:
                # 2. Credential Stuffing Attempt
                username = USERNAMES[i % len(USERNAMES)]
                password = PASSWORDS[i % len(PASSWORDS)]
                url = f"{target_url}/api/v1/decoy/auth/login"
                res = client.post(
                    url,
                    data={"username": username, "password": password},
                    headers=headers,
                    params={"test": "1"} if test_mode else {},
                )
                print(f"[{i+1}/{count}] LOGIN ATTEMPT -> user: '{username}' (pwd len: {len(password)}) -> HTTP {res.status_code}")
                success_count += 1

            else:
                # 3. Quarantined Diagnostic Upload
                fname, content, mime = SAMPLE_FILES[i % len(SAMPLE_FILES)]
                url = f"{target_url}/api/v1/decoy/upload/diagnostics"
                files = {"file": (fname, io.BytesIO(content), mime)}
                res = client.post(
                    url,
                    files=files,
                    headers=headers,
                    params={"test": "1"} if test_mode else {},
                )
                res_data = res.json() if res.status_code == 200 else {}
                sha = res_data.get("artifact_hash", "")[:12]
                print(f"[{i+1}/{count}] PAYLOAD UPLOAD -> file: '{fname}' (SHA: {sha}...) -> HTTP {res.status_code}")
                success_count += 1

        except Exception as e:
            print(f"[!] Error transmitting interaction #{i+1}: {str(e)}")

        time.sleep(0.1)

    print(f"\n[OK] Simulation completed. {success_count}/{count} interactions successfully ingested into ARGUS telemetry pipeline.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ARGUS Controlled Traffic Simulation Tool")
    parser.add_argument("--target", default="http://localhost:8000", help="Target URL for ARGUS service")
    parser.add_argument("--count", type=int, default=15, help="Number of interactions to simulate")
    parser.add_argument("--genuine", action="store_true", help="Simulate without test flag (genuine traffic simulation)")

    args = parser.parse_args()
    run_simulation(args.target, args.count, test_mode=not args.genuine)
