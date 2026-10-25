"""Master orchestrator to start all ARGUS platform services for local evaluation.

Launches simultaneously:
1. Core Backend API & Ingestion Engine (Port 8000)
2. Geberew Bank Decoy Portal (Port 8081)
3. MySQL Protocol Honeypot (Port 3306)
4. SOC Operations Frontend Dashboard (Port 3000)

Usage:
    python scripts/run_all.py
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
PYTHON_EXEC = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable


def get_env():
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT_DIR / "backend")
    env["BACKEND_INGEST_URL"] = "http://127.0.0.1:8000"
    env["DATABASE_URL"] = env.get("DATABASE_URL", "sqlite+aiosqlite:///./data/argus_telemetry.db")
    env["ENVIRONMENT"] = "development"
    env["DECOY_SPOOL_DIR"] = "data/spool/decoy"
    env["MYSQL_DECOY_PORT"] = "3306"
    env["MYSQL_DECOY_SPOOL_DIR"] = "data/spool/mysql"
    env["INTERNAL_INGESTION_TOKEN"] = env.get(
        "INTERNAL_INGESTION_TOKEN", "argus_internal_decoy_token_secret_replace_in_prod"
    )
    return env


def main():
    print("=" * 70)
    print("  ARGUS Cyber Deception & Attack Monitoring Platform")
    print("  Graduation Project Evaluation Launcher")
    print("=" * 70)

    env = get_env()
    procs = []

    try:
        # 1. Backend
        print("[1/4] Starting Core Backend API on http://127.0.0.1:8000 ...")
        p_backend = subprocess.Popen(
            [PYTHON_EXEC, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=str(ROOT_DIR),
            env=env,
        )
        procs.append(("Backend API", p_backend))
        time.sleep(1)

        # 2. Decoy Portal
        print("[2/4] Starting Geberew Bank Decoy on http://127.0.0.1:8081 ...")
        p_decoy = subprocess.Popen(
            [PYTHON_EXEC, "-m", "uvicorn", "app.decoy_main:app", "--host", "0.0.0.0", "--port", "8081"],
            cwd=str(ROOT_DIR),
            env=env,
        )
        procs.append(("Decoy Portal", p_decoy))
        time.sleep(1)

        # 3. MySQL Decoy
        print("[3/4] Starting MySQL Decoy Honeypot on port 3306 ...")
        p_mysql = subprocess.Popen(
            [PYTHON_EXEC, "-m", "app.decoys.mysql.server"],
            cwd=str(ROOT_DIR),
            env=env,
        )
        procs.append(("MySQL Decoy", p_mysql))
        time.sleep(1)

        # 4. Frontend Dashboard
        print("[4/4] Starting SOC Operations Dashboard on http://127.0.0.1:3000 ...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        p_front = subprocess.Popen(
            [npm_cmd, "run", "dev", "--", "--host", "127.0.0.1"],
            cwd=str(ROOT_DIR / "frontend"),
            env=env,
        )
        procs.append(("SOC Dashboard", p_front))

        print("-" * 70)
        print("  ALL SERVICES RUNNING SUCCESSFULLY:")
        print("  - SOC Operations Dashboard : http://127.0.0.1:3000")
        print("  - Geberew Bank Decoy Portal : http://127.0.0.1:8081")
        print("  - Core Ingestion API       : http://127.0.0.1:8000")
        print("  - MySQL Protocol Honeypot  : 127.0.0.1:3306")
        print("  - API Swagger Docs         : http://127.0.0.1:8000/docs")
        print("-" * 70)
        print("  [!] Press Ctrl+C at any time to safely shut down all services.")
        print("=" * 70)

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[*] Shutting down ARGUS services...")
        for name, p in procs:
            print(f"    - Terminating {name}...")
            p.terminate()
        for _, p in procs:
            p.wait()
        print("[OK] All services stopped cleanly.")


if __name__ == "__main__":
    main()
