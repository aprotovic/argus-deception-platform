"""ARGUS Cyber Deception & Attack Monitoring Platform - Main FastAPI Entrypoint."""

import sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from sqlalchemy import text
from app.api.v1 import api_v1_router
from app.config import settings
from app.database import Base, engine
from app.logging_config import logger, setup_logging
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager handling startup initialization and graceful shutdown."""
    # 1. Setup structured logging
    setup_logging(settings.LOG_LEVEL)
    logger.info(
        f"Starting ARGUS Platform in {settings.ENVIRONMENT} mode",
        extra={"event_type": "SYSTEM_STARTUP"},
    )

    # 2. Ensure quarantine directory exists with proper permissions
    q_dir = settings.quarantine_path
    logger.info(f"Quarantine storage initialized at: {q_dir}")

    # 3. Create tables if running in SQLite dev/test mode or initial verification
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema verification completed.")

    yield

    # Shutdown logic
    logger.info("Shutting down ARGUS Platform...", extra={"event_type": "SYSTEM_SHUTDOWN"})
    await engine.dispose()


app = FastAPI(
    title="ARGUS Cyber Deception Platform",
    description="Operational API for attack monitoring, cyber deception telemetry, and safe artifact quarantine.",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# Defensive Middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID", "Content-Disposition", "X-Evidence-SHA256"],
)

# Health Check Endpoints
@app.get("/health/live", tags=["Health"])
async def liveness_probe():
    """Liveness probe indicating application process is running."""
    return {"status": "alive", "service": "argus-core"}


@app.get("/health/ready", tags=["Health"])
async def readiness_probe():
    """Readiness probe verifying operational database connectivity."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        logger.error(f"Readiness probe failed database check: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "error": "Database unreachable"},
        )


# Serve Decoy Portal UI
@app.get("/", tags=["Decoy Interface"])
@app.get("/decoy", tags=["Decoy Interface"])
async def serve_decoy_portal():
    """Serves the authentic-looking decoy defense contractor portal."""
    template_path = Path(__file__).resolve().parent.parent.parent / "decoy" / "templates" / "index.html"
    if template_path.exists():
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=template_path.read_text(encoding="utf-8"))
    return {"message": "Nexis Defense Systems - Secure Portal"}


# Deceptive robots.txt breadcrumbs
@app.get("/robots.txt", tags=["Decoy Interface"])
async def serve_decoy_robots():
    """Serves deceptive robots.txt pointing to honeytoken endpoints."""
    from fastapi.responses import PlainTextResponse
    robots_content = (
        "# Nexis Tactical Defense Perimeter Gateway\n"
        "# Restricted System Notice: Automated indexing strictly forbidden.\n"
        "User-agent: *\n"
        "Disallow: /admin-console/\n"
        "Disallow: /internal/backups/\n"
        "Disallow: /api/v1/decoy/honeytoken/config\n"
        "Disallow: /firmware/releases/\n"
        "Disallow: /satcom/uplink-keys/\n"
    )
    return PlainTextResponse(content=robots_content)


# ============================================================================
# ROOT DOMAIN SCANNER TRAPS & HONEYTOKEN HONEYTRAPS
# ============================================================================
async def record_root_trap(
    request: Request,
    path: str,
    severity: str = "high",
    event_type: str = "recon_probe",
    summary: str = None,
    honeytoken_info: dict = None,
):
    """Captures direct scanner recon probes at the domain root into security telemetry."""
    try:
        from app.database import AsyncSessionLocal
        from app.models.security_event import SecurityEvent
        from app.core.security import extract_client_ip, sanitize_headers
        from app.core.websocket_manager import ws_manager
        import uuid
        from datetime import datetime, timezone

        client_ip = extract_client_ip(request)
        is_test = bool(request.headers.get("x-argus-test-token") or request.query_params.get("test") in ["1", "true"])
        event_id = uuid.uuid4()
        now_utc = datetime.now(timezone.utc)

        metadata = {"probed_path": path}
        if honeytoken_info:
            metadata.update(honeytoken_info)

        msg = summary or f"Scanner reconnaissance probe on '{path}'"

        async with AsyncSessionLocal() as session:
            sec_event = SecurityEvent(
                id=event_id,
                timestamp=now_utc,
                source_ip=client_ip,
                source_port=request.client.port if request.client else None,
                http_method=request.method,
                request_path=path,
                query_params=dict(request.query_params),
                headers_sanitized=sanitize_headers(dict(request.headers)),
                user_agent=request.headers.get("user-agent", "")[:500],
                event_type=event_type,
                severity=severity,
                is_test_event=is_test,
                correlation_id=str(uuid.uuid4())[:8],
                metadata_payload=metadata,
            )
            session.add(sec_event)
            await session.commit()

        await ws_manager.broadcast_event({
            "id": str(event_id),
            "timestamp": now_utc.isoformat(),
            "source_ip": client_ip,
            "event_type": event_type,
            "severity": severity,
            "request_path": path,
            "http_method": request.method,
            "user_agent": request.headers.get("user-agent", "")[:100],
            "is_test_event": is_test,
            "summary": msg,
        })
    except Exception as e:
        logger.error(f"Error recording root trap for {path}: {e}")


@app.get("/.env", tags=["Decoy Traps"])
async def trap_env(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/.env", severity="high", honeytoken_info={"canary_token": "CANARY-ENV-NX784912"})
    return PlainTextResponse(
        "DATABASE_URL=postgresql://nx_admin:CanaryP@ssword2026!@10.42.18.5:5432/defense_ops\n"
        "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE_NXCANARY\n"
        "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n"
        "JWT_SECRET=super_secret_defense_enclave_key_do_not_share\n"
    )


@app.get("/.git/HEAD", tags=["Decoy Traps"])
async def trap_git_head(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/.git/HEAD", severity="high")
    return PlainTextResponse("ref: refs/heads/main\n")


@app.get("/.git/config", tags=["Decoy Traps"])
async def trap_git_config(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/.git/config", severity="high")
    return PlainTextResponse(
        "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n"
        "[remote \"origin\"]\n\turl = git@git.defense.internal:nexis/tactical-portal.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n"
    )


@app.get("/.aws/credentials", tags=["Decoy Traps"])
async def trap_aws_credentials(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/.aws/credentials", severity="high", honeytoken_info={"canary_token": "NX-CANARY-AWS-CRED-01"})
    return PlainTextResponse(
        "[default]\n"
        "aws_access_key_id = AKIA4DEFENSE7CANARY1\n"
        "aws_secret_access_key = 9aF81k2m3L4p5Q6r7S8t9U0v1W2x3Y4z\n"
    )


@app.api_route("/wp-login.php", methods=["GET", "POST"], tags=["Decoy Traps"])
async def trap_wp_login(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/wp-login.php", severity="medium")
    return PlainTextResponse("WordPress 6.4.2 maintenance mode: database connection unavailable.", status_code=503)


@app.api_route("/actuator/{path:path}", methods=["GET", "POST"], tags=["Decoy Traps"])
async def trap_actuator(request: Request, path: str):
    await record_root_trap(request, f"/actuator/{path}", severity="medium")
    return JSONResponse(content={"status": "UP", "enclave": "defense-node-4", "canary_build": "v4.2.1-NX-CANARY"})


# ============================================================================
# ROBOTS.TXT DECEPTION HONEYTRAPS
# ============================================================================

ADMIN_CONSOLE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexis Defense Systems | Core Enclave Administration Gateway</title>
  <style>
    :root {
      --bg: #070b14;
      --card-bg: rgba(13, 20, 36, 0.95);
      --border: #1e293b;
      --accent-cyan: #06b6d4;
      --accent-amber: #f59e0b;
      --accent-red: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      position: relative;
      overflow-x: hidden;
    }
    body::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(circle at 50% 20%, rgba(6, 182, 212, 0.08) 0%, transparent 70%),
                  linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 32px 32px, 32px 32px;
      pointer-events: none;
    }
    .disa-banner {
      width: 100%;
      max-width: 580px;
      background: #7f1d1d;
      border: 1px solid var(--accent-red);
      color: #fef2f2;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-align: center;
      padding: 8px 12px;
      border-radius: 6px 6px 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .console-card {
      width: 100%;
      max-width: 580px;
      background: var(--card-bg);
      border: 1px solid #334155;
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(6, 182, 212, 0.1);
      position: relative;
      z-index: 10;
    }
    .header {
      margin-bottom: 24px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 20px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-family: monospace;
      color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 4px 10px;
      border-radius: 4px;
      margin-bottom: 12px;
      letter-spacing: 0.05em;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      background: var(--accent-cyan);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent-cyan);
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.02em;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .security-notice {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 6px;
      padding: 12px;
      font-size: 11px;
      color: #fbbf24;
      line-height: 1.5;
      margin-bottom: 24px;
      font-family: monospace;
    }
    .field {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #cbd5e1;
      margin-bottom: 6px;
    }
    input, select {
      width: 100%;
      background: #090e17;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 12px 14px;
      font-size: 13px;
      font-family: monospace;
      color: #f8fafc;
      transition: all 0.2s;
    }
    input:focus, select:focus {
      outline: none;
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
    }
    .status-panel {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 24px;
    }
    .status-item {
      font-size: 11px;
      font-family: monospace;
      color: var(--text-muted);
    }
    .status-item span {
      display: block;
      color: #38bdf8;
      font-weight: 600;
      margin-top: 2px;
    }
    .btn {
      width: 100%;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      border: 1px solid #38bdf8;
      color: #ffffff;
      padding: 13px 20px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.2s;
    }
    .btn:hover {
      background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
      box-shadow: 0 0 16px rgba(14, 165, 233, 0.4);
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error-box {
      display: none;
      margin-top: 20px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid var(--accent-red);
      border-radius: 6px;
      padding: 14px;
      color: #fca5a5;
      font-size: 12px;
      font-family: monospace;
      line-height: 1.5;
    }
    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 10px;
      color: #64748b;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="disa-banner">
    <span>&#9888; RESTRICTED DEFENSE ENCLAVE // LEVEL 5 PRIVILEGED ACCESS ONLY</span>
  </div>
  <div class="console-card">
    <div class="header">
      <div class="badge">
        <span class="badge-dot"></span>
        <span>HSM ROOT AUTHORITY: ONLINE &bull; DISA-STIG-ID: NX-7702</span>
      </div>
      <h1>NEXIS DEFENSE SYSTEMS</h1>
      <p class="subtitle">Core Tactical Enclave Administration &amp; Cryptographic Management Gateway</p>
    </div>

    <div class="security-notice">
      RESTRICTED SYSTEM: Access restricted to authorized DoD / Nexis personnel with validated Tier-1 clearances. Keystroke telemetry, biometric fingerprints, and hardware token IDs are continuously logged under 18 U.S.C. &sect; 1030.
    </div>

    <form id="authForm">
      <div class="field">
        <label for="username">Operator Clearance ID / Call-Sign</label>
        <input type="text" id="username" name="username" placeholder="e.g. ADM-VANCE-7740" required autocomplete="off" />
      </div>

      <div class="field">
        <label for="password">Hardware Security Module (HSM) Cryptographic PIN</label>
        <input type="password" id="password" name="password" placeholder="Enter hardware token PIN" required autocomplete="off" />
      </div>

      <div class="field">
        <label for="token_serial">Physical CAC / PIV Token Serial</label>
        <input type="text" id="token_serial" name="token_serial" placeholder="NX-CAC-9982-ALPHA" autocomplete="off" />
      </div>

      <div class="field">
        <label for="enclave">Target Cryptographic Enclave</label>
        <select id="enclave" name="enclave">
          <option value="alpha">Enclave Alpha-1: Core Tactical Network &amp; Telemetry</option>
          <option value="bravo">Enclave Bravo-4: Satcom Cryptographic Uplink Facility</option>
          <option value="gamma">Enclave Gamma-9: Kinetic Defense &amp; Countermeasure Control</option>
        </select>
      </div>

      <div class="status-panel">
        <div class="status-item">ENCLAVE CIPHER: <span>AES-256-GCM / SHA-384</span></div>
        <div class="status-item">MUTUAL TLS: <span>REQUIRED (FIPS 140-3)</span></div>
      </div>

      <button type="submit" id="submitBtn" class="btn">
        <span>Authenticate &amp; Decrypt Session</span>
      </button>

      <div id="errorBox" class="error-box"></div>
    </form>

    <div class="footer">
      NEXIS DEFENSE SYSTEMS &bull; CLASSIFIED TACTICAL OPERATIONS SUITE &bull; BUILD 2026.10-DISA
    </div>
  </div>

  <script>
    const form = document.getElementById('authForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorBox = document.getElementById('errorBox');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Verifying Cryptographic Challenge...</span>';

      const formData = new FormData(form);
      const username = formData.get('username');
      const password = formData.get('password');
      const tokenSerial = formData.get('token_serial');
      const enclave = formData.get('enclave');

      try {
        const resp = await fetch('/admin-console/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            password: password,
            token_serial: tokenSerial,
            enclave: enclave,
          }),
        });

        const data = await resp.json().catch(() => ({}));
        
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Authenticate &amp; Decrypt Session</span>';
          errorBox.style.display = 'block';
          errorBox.innerHTML = '<strong>[403 FORBIDDEN - HSM REJECTION]</strong><br>' + 
            (data.message || 'Cryptographic handshake failed. Hardware Security Module (HSM) challenge was rejected by Enclave Root Authority. Physical token mismatch. Incident dispatched to Defense Cyber Crime Center (DC3). Access revoked.');
        }, 800);
      } catch (err) {
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Authenticate &amp; Decrypt Session</span>';
          errorBox.style.display = 'block';
          errorBox.innerHTML = '<strong>[SECURITY HANDSHAKE FAILED]</strong><br>Terminal handshake rejected by enclave security boundary. Incident logged.';
        }, 800);
      }
    });
  </script>
</body>
</html>
"""

INTERNAL_BACKUPS_HTML = """<!DOCTYPE html>
<html>
<head><title>Index of /internal/backups/</title></head>
<body style="font-family: monospace; background: #fff; color: #222; padding: 24px;">
<h2>Index of /internal/backups/</h2>
<hr>
<pre style="line-height: 1.6; font-size: 13px;">
<a href="../">../</a>
<a href="/internal/backups/enclave_db_production_2026.sql.gz">enclave_db_production_2026.sql.gz</a>                  18-Oct-2026 03:14            44882104
<a href="/internal/backups/nexis_tacnet_credentials.tar.enc">nexis_tacnet_credentials.tar.enc</a>                  15-Oct-2026 21:05             1294812
<a href="/internal/backups/satcom_transponder_master_keys.bak">satcom_transponder_master_keys.bak</a>                 12-Oct-2026 09:42              862140
<a href="/internal/backups/root_ca_private_key_do_not_distribute.pem">root_ca_private_key_do_not_distribute.pem</a>          09-Oct-2026 14:18                3243
</pre>
<hr>
<address>Apache/2.4.52 (Ubuntu) Server at defense.internal Port 443</address>
</body>
</html>
"""

BACKUP_CANARY_FILES = {
    "enclave_db_production_2026.sql.gz": (
        "-- PostgreSQL Database Dump: defense_ops_production\n"
        "-- Enclave Alpha-1 Production Database Schema & Classified Table Dumps\n"
        "-- CANARY-TOKEN: NX-CANARY-SQL-BACKUP-994182-DO-NOT-USE\n"
        "-- DUMP_TIMESTAMP: 2026-10-18T03:14:22Z\n\n"
        "SET statement_timeout = 0;\n"
        "SET client_encoding = 'UTF8';\n\n"
        "CREATE TABLE public.classified_enclave_operators (\n"
        "    id uuid PRIMARY KEY,\n"
        "    callsign varchar(64) NOT NULL,\n"
        "    clearance_level integer DEFAULT 5,\n"
        "    hashed_cac_pin varchar(128),\n"
        "    canary_audit_tag varchar(64) DEFAULT 'CANARY-OP-NX77821'\n"
        ");\n\n"
        "INSERT INTO public.classified_enclave_operators VALUES\n"
        "('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'adm-vance-tac', 5, '$2b$12$eX4mP1eH4sH3dC4cPiN99841CanaryToken', 'NX-CANARY-OP-01'),\n"
        "('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'secops-miller', 4, '$2b$12$k8Y1p2Q3r4S5t6U7v8W9x0Y1z2A3b4C5d6E7f', 'NX-CANARY-OP-02');\n\n"
        "CREATE TABLE public.satcom_uplink_configurations (\n"
        "    transponder_id varchar(32),\n"
        "    frequency_ghz numeric(6,3),\n"
        "    encryption_key_canary varchar(128)\n"
        ");\n\n"
        "INSERT INTO public.satcom_uplink_configurations VALUES\n"
        "('MILSTAR-DFS-4', 44.150, 'CANARY-KEY-MILSTAR-NX9981-TRACKED-BY-ARGUS'),\n"
        "('WGS-11-EAST', 30.825, 'CANARY-KEY-WGS11-NX4421-TRACKED-BY-ARGUS');\n"
    ),
    "satcom_transponder_master_keys.bak": (
        "# NEXIS DEFENSE SYSTEMS - SATCOM CRYPTOGRAPHIC TRANSPONDER BACKUP\n"
        "# CREATED: 2026-10-15T19:44:00Z\n"
        "# CLEARANCE: TOP SECRET // SI-TK // CANARY TRACKED\n"
        "# CANARY_TOKEN=NX-CANARY-SATCOM-KEY-X992\n\n"
        "[TRANSPONDER_ALPHA]\n"
        "NODE_ID=SAT-MILSTAR-4\n"
        "FREQUENCY=44.150GHz\n"
        "SESSION_KEY=8f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a\n"
        "CANARY_SIGNATURE=NX-CANARY-UPLINK-AUTH-99124\n\n"
        "[TRANSPONDER_BRAVO]\n"
        "NODE_ID=SAT-WGS-11\n"
        "FREQUENCY=30.825GHz\n"
        "SESSION_KEY=1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b\n"
        "CANARY_SIGNATURE=NX-CANARY-WGS-AUTH-77182\n"
    ),
    "nexis_tacnet_credentials.tar.enc": (
        "-----BEGIN NEXIS DEFENSE ENCRYPTED ARCHIVE-----\n"
        "Archive-Format: TAR+AES256-CBC\n"
        "Enclave: Alpha-1 Core\n"
        "Canary-Tag: NX-CANARY-ARCHIVE-99104-TRACKED\n"
        "Salt: 9F1A4E8C2B3D5E6F7A8B9C0D1E2F3A4B\n"
        "Payload: 4b2f1a8c9e0d3f7b2a5c8e1d4f9a0b3c6e8f1a4b7d0c3e6f9a2b5d8e1f4a7c0d\n"
        "-----END NEXIS DEFENSE ENCRYPTED ARCHIVE-----\n"
    ),
    "root_ca_private_key_do_not_distribute.pem": (
        "-----BEGIN RSA PRIVATE KEY-----\n"
        "Proc-Type: 4,ENCRYPTED\n"
        "DEK-Info: AES-256-CBC,7E5B1A2C3D4E5F6A7B8C9D0E1F2A3B4C\n"
        "CANARY-ID: NX-CANARY-ROOTCA-KEY-8841-EXFILTRATION-ALERT\n\n"
        "MIIEowIBAAKCAQEA0w9F2K1z8l3j4h5g6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c\n"
        "2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a\n"
        "4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e\n"
        "-----END RSA PRIVATE KEY-----\n"
    ),
}

SATCOM_KEYS_CANARY = (
    "-----BEGIN NEXIS SATCOM TACTICAL UPLINK KEY BLOCK-----\n"
    "Classification: TOP SECRET // SI-TK // REL TO USA, FVEY\n"
    "Canary-Identifier: NX-SATCOM-CANARY-99841-TRACKED\n"
    "Crypto-Standard: MIL-STD-188-164B (EHF Band Dynamic Uplink)\n"
    "Transponder-Allocation: MILSTAR-DFS-4 / WGS-11-EAST\n"
    "Valid-Until: 2026-12-31T23:59:59Z\n"
    "Key-Checksum-SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n\n"
    "MIIEogIBAAKCAQEAz8n8hJ7h7A5k3l1m9n0o4p8q2r6s7t1u5v9w3x7y1z5a9b3c\n"
    "7d1e5f9a3b7c1d5e9f3a7b1c5d9e3f7a1b5c9d3e7f1a5b9c3d7e1f5a9b3c7d1e\n"
    "-----END NEXIS SATCOM TACTICAL UPLINK KEY BLOCK-----\n"
)

FIRMWARE_INDEX_HTML = """<!DOCTYPE html>
<html>
<head><title>Index of /firmware/releases/</title></head>
<body style="font-family: monospace; background: #fff; color: #222; padding: 24px;">
<h2>Index of /firmware/releases/</h2>
<hr>
<pre style="line-height: 1.6; font-size: 13px;">
<a href="../">../</a>
<a href="/firmware/releases/nexis-tactical-gateway-v4.11.0-secureboot.bin">nexis-tactical-gateway-v4.11.0-secureboot.bin</a>      14-Oct-2026 18:22            68149204
<a href="/firmware/releases/sha256sums.txt">sha256sums.txt</a>                                     14-Oct-2026 18:25                 512
<a href="/firmware/releases/README_FIRMWARE_SIGNING.txt">README_FIRMWARE_SIGNING.txt</a>                        10-Oct-2026 11:04                1840
</pre>
<hr>
<address>Apache/2.4.52 (Ubuntu) Server at defense.internal Port 443</address>
</body>
</html>
"""


# 1. /admin-console/ honeypot gateway
@app.get("/admin-console", tags=["Decoy Traps"])
@app.get("/admin-console/", tags=["Decoy Traps"])
async def trap_admin_console(request: Request):
    await record_root_trap(
        request,
        "/admin-console/",
        severity="critical",
        event_type="unauthorized_access",
        summary="CRITICAL: Adversary traversed forbidden '/admin-console/' path discovered via robots.txt",
        honeytoken_info={"recon_source": "robots.txt", "honeypot_target": "enclave_admin_console"},
    )
    return HTMLResponse(content=ADMIN_CONSOLE_HTML)


@app.post("/admin-console/auth", tags=["Decoy Traps"])
@app.post("/admin-console/auth/", tags=["Decoy Traps"])
async def trap_admin_auth(request: Request):
    from app.core.security import compute_password_fingerprint, extract_client_ip, sanitize_headers
    from app.database import AsyncSessionLocal
    from app.models.security_event import SecurityEvent
    from app.models.login_attempt import LoginAttempt
    from app.core.websocket_manager import ws_manager
    import uuid
    from datetime import datetime, timezone

    client_ip = extract_client_ip(request)
    is_test = bool(request.headers.get("x-argus-test-token") or request.query_params.get("test") in ["1", "true"])

    username = ""
    password = ""
    token_serial = ""
    enclave = "alpha"
    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            body = await request.json()
            username = str(body.get("username", ""))
            password = str(body.get("password", ""))
            token_serial = str(body.get("token_serial", ""))
            enclave = str(body.get("enclave", "alpha"))
        else:
            form = await request.form()
            username = str(form.get("username", ""))
            password = str(form.get("password", ""))
            token_serial = str(form.get("token_serial", ""))
            enclave = str(form.get("enclave", "alpha"))
    except Exception:
        pass

    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)
    pwd_len = len(password)
    pwd_fingerprint = compute_password_fingerprint(password) if password else "empty_pin"

    async with AsyncSessionLocal() as session:
        sec_event = SecurityEvent(
            id=event_id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path="/admin-console/auth",
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type="credential_stuffing",
            severity="critical",
            is_test_event=is_test,
            correlation_id=str(uuid.uuid4())[:8],
            metadata_payload={
                "honeypot": "enclave_admin_console",
                "submitted_callsign": username[:100],
                "token_serial": token_serial[:100],
                "target_enclave": enclave,
                "password_length": pwd_len,
                "outcome": "HSM_CHALLENGE_REJECTED",
            },
        )
        session.add(sec_event)

        login_attempt = LoginAttempt(
            id=uuid.uuid4(),
            event_id=event_id,
            submitted_username=username[:255] if username else "(blank)",
            password_length=pwd_len,
            password_hmac_fingerprint=pwd_fingerprint,
            is_flagged_credential=True,
            success=False,
            failure_reason="hsm_hardware_token_mismatch",
            client_ip=client_ip,
            user_agent=request.headers.get("user-agent", "")[:500],
        )
        session.add(login_attempt)
        await session.commit()

    await ws_manager.broadcast_event({
        "id": str(event_id),
        "timestamp": now_utc.isoformat(),
        "source_ip": client_ip,
        "event_type": "credential_stuffing",
        "severity": "critical",
        "request_path": "/admin-console/auth",
        "http_method": request.method,
        "user_agent": request.headers.get("user-agent", "")[:100],
        "is_test_event": is_test,
        "summary": f"CRITICAL: Attacker submitted unauthorized credentials to '/admin-console/auth' honeytrap (callsign: '{username or 'blank'}', pwd len: {pwd_len})",
    })

    return JSONResponse(
        status_code=403,
        content={
            "status": "error",
            "code": "HSM_CHALLENGE_REJECTED",
            "incident_id": f"NX-INC-{str(event_id)[:8].upper()}",
            "message": "HSM VALIDATION REJECTED: Cryptographic challenge failed. Physical hardware token signature mismatch. Incident dispatched to Defense Cyber Crime Center (DC3). Access revoked.",
        },
    )


# 2. /internal/backups/ directory index & canary file downloads
@app.get("/internal/backups", tags=["Decoy Traps"])
@app.get("/internal/backups/", tags=["Decoy Traps"])
async def trap_internal_backups_index(request: Request):
    await record_root_trap(
        request,
        "/internal/backups/",
        severity="critical",
        event_type="directory_traversal",
        summary="CRITICAL: Adversary traversed forbidden '/internal/backups/' directory discovered via robots.txt",
        honeytoken_info={"recon_source": "robots.txt", "honeypot_target": "internal_backups_directory"},
    )
    return HTMLResponse(content=INTERNAL_BACKUPS_HTML)


@app.get("/internal/backups/{filename}", tags=["Decoy Traps"])
async def trap_internal_backups_file(request: Request, filename: str):
    clean_filename = filename.strip()
    canary_content = BACKUP_CANARY_FILES.get(clean_filename)
    if not canary_content:
        canary_content = f"# Classified backup manifest: {clean_filename}\n# CANARY_TOKEN=NX-CANARY-GENERIC-BACKUP-{clean_filename.upper()}\n"

    await record_root_trap(
        request,
        f"/internal/backups/{clean_filename}",
        severity="critical",
        event_type="honeytoken_accessed",
        summary=f"CRITICAL: Attacker downloaded honeypot backup file '{clean_filename}' from /internal/backups/ (Canary Tripped!)",
        honeytoken_info={"downloaded_file": clean_filename, "canary_token": f"NX-CANARY-BACKUP-{clean_filename.upper()}"},
    )
    return PlainTextResponse(
        content=canary_content,
        headers={"Content-Disposition": f'attachment; filename="{clean_filename}"'},
    )


# 3. /satcom/uplink-keys/ canary key distribution
@app.get("/satcom/uplink-keys", tags=["Decoy Traps"])
@app.get("/satcom/uplink-keys/", tags=["Decoy Traps"])
@app.get("/satcom/uplink-keys/{path:path}", tags=["Decoy Traps"])
async def trap_satcom_uplink_keys(request: Request, path: str = ""):
    probed = f"/satcom/uplink-keys/{path}" if path else "/satcom/uplink-keys/"
    await record_root_trap(
        request,
        probed,
        severity="high",
        event_type="recon_probe",
        summary="HIGH: Adversary inspected classified SATCOM uplink keys directory from robots.txt",
        honeytoken_info={"canary_token": "NX-SATCOM-CANARY-99841-TRACKED", "source": "robots.txt"},
    )
    return PlainTextResponse(content=SATCOM_KEYS_CANARY)


# 4. /firmware/releases/ firmware release manifest
@app.get("/firmware/releases", tags=["Decoy Traps"])
@app.get("/firmware/releases/", tags=["Decoy Traps"])
async def trap_firmware_releases(request: Request):
    await record_root_trap(
        request,
        "/firmware/releases/",
        severity="high",
        event_type="recon_probe",
        summary="HIGH: Adversary probed classified firmware repository from robots.txt",
        honeytoken_info={"source": "robots.txt", "honeypot_target": "firmware_releases"},
    )
    return HTMLResponse(content=FIRMWARE_INDEX_HTML)


@app.get("/firmware/releases/{path:path}", tags=["Decoy Traps"])
async def trap_firmware_file(request: Request, path: str):
    await record_root_trap(
        request,
        f"/firmware/releases/{path}",
        severity="high",
        event_type="honeytoken_accessed",
        summary=f"HIGH: Adversary downloaded firmware asset '{path}' from /firmware/releases/",
        honeytoken_info={"downloaded_firmware": path, "canary_token": f"NX-CANARY-FW-{path.upper()}"},
    )
    return PlainTextResponse(
        content=f"# Nexis SecureBoot Firmware Asset: {path}\n# CANARY_TOKEN=NX-CANARY-FW-{path.upper()}\n# DISA STIG INTEGRITY CHECKSUM: VALID\n",
        headers={"Content-Disposition": f'attachment; filename="{path}"'},
    )


# Include API v1 Router
app.include_router(api_v1_router)


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    logger.error(
        f"Unhandled global exception: {str(exc)}",
        extra={"correlation_id": correlation_id},
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Incident has been recorded.",
            "correlation_id": correlation_id,
        },
    )
