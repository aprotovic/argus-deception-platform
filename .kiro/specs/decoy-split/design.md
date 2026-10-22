# Design: Decoy split

## Key finding from the code
decoy.py uses the database session in only three ways: `db.add(obj)`, `await db.commit()`, and in `get_or_create_default_decoy` one `select(DecoyService)` plus `db.refresh`. main.py `record_root_trap` opens its own `AsyncSessionLocal`. So the decoy can be split with a small adapter instead of rewriting 1400 lines.

## Components

1. `app/core/event_sink.py` (new)
   - `EventSink` interface: `async persist(objs)`.
   - `DbEventSink`: current behavior (open session, add, commit). Default sink, so all-in-one mode is unchanged.
   - `ForwardingEventSink`: serializes objects, puts them in an in-memory queue, and a background worker POSTs batches to `BACKEND_INGEST_URL/api/v1/internal/ingest-batch` with httpx. On failure it appends to the spool file `DECOY_SPOOL_DIR/events.jsonl`, retries with backoff, replays the spool on start.
   - `EventForwarderSession`: adapter used as the `get_db` override in the decoy app. `add()` buffers objects, `commit()` hands them to the sink, `refresh()` and `rollback()` are no-ops. It also exposes `default_decoy` (see 4).
   - `get_event_sink()` / `set_event_sink()` module-level accessors.

2. Serialization (explicit, not `obj.__dict__`)
   SQLAlchemy applies column defaults at flush time, so objects built without a flush can have `id=None` or no timestamps. The adapter must fill `id` (uuid4), `created_at` and `timestamp` before serializing, and group a LoginAttempt or CapturedFile with its SecurityEvent through `event_id`. Check all ~10 call sites in decoy.py for how `event_id` is set.

   Wire format:
   ```
   {"events": [{
     "event": {id, decoy_service_id, timestamp, source_ip, source_port, http_method, request_path,
               query_params, headers_sanitized, user_agent, event_type, severity, is_test_event,
               correlation_id, metadata_payload},
     "login_attempt": {...LoginAttempt columns...} | null,
     "captured_file": {...CapturedFile columns...} | null
   }]}
   ```

3. Backend `POST /api/v1/internal/ingest-batch` (in api/v1/internal.py)
   - Pydantic models with max lengths and `max_length=100` on the list.
   - Token check through `verify_internal_ingestion_token`, changed to `hmac.compare_digest`.
   - Ensure the default DecoyService exists (fixed UUID `DEFAULT_DECOY_ID` from settings).
   - Select existing ids with `where id in (...)`, insert only the new events, plus their login_attempt and captured_file, one commit. Works on SQLite and Postgres.
   - After commit, broadcast the same summary dict as `/internal/ingest` (extract a shared helper).
   - Keep the existing `/internal/ingest` endpoint unchanged.

4. `get_or_create_default_decoy(db)` in decoy.py
   Add at the top: if `db` is an `EventForwarderSession`, return its `default_decoy` (a SimpleNamespace with the fixed id, name, banner_title, etc., matching the values in the existing function). Nothing else in decoy.py should change.

5. `app/api/root_traps.py` (new, moved from main.py)
   Move the root routes (`/`, `/decoy`, `/robots.txt`, `/.env`, `/.git/*`, `/.aws/credentials`, `/wp-login.php`, `/actuator/*`, `/admin-console*`, `/internal/backups*`, `/satcom/*`, `/firmware/*`) and `record_root_trap` into an APIRouter. main.py includes this router, so behavior is identical. `record_root_trap` calls `get_event_sink().persist([...])` instead of opening `AsyncSessionLocal`. Keep the template path logic working from the new location.
   Note: `/internal/backups` is a decoy trap path at the root and is different from `/api/v1/internal/*`. Test both.

6. `app/decoy_main.py` (new)
   FastAPI app with `docs_url=None, redoc_url=None, openapi_url=None`. Adds the security-headers and request-logging middleware. Includes the root_traps router and an `APIRouter(prefix="/api/v1")` that contains ONLY `decoy_router`. Adds `/health/live`. Lifespan: set the `ForwardingEventSink`, start the worker, stop it on shutdown. Sets `app.dependency_overrides[get_db] = <EventForwarderSession factory>`. No `create_all`, no DB import-time connection (creating the engine object is fine, it does not connect).

7. Settings (app/config.py)
   Add `BACKEND_INGEST_URL` (default `http://argus-backend:8000`), `DECOY_SPOOL_DIR`, `DECOY_SPOOL_MAX_BYTES` (100 MB), `DEFAULT_DECOY_ID` (fixed UUID).

8. docker-compose.yml
   Decoy: `command: ["uvicorn","app.decoy_main:app","--host","0.0.0.0","--port","8080"]`, env `BACKEND_INGEST_URL`, `ARGUS_PASSWORD_FINGERPRINT_SECRET` (same default expression as the backend), a new volume `decoy_spool` mounted at the spool dir. Keep the existing ports, networks and shared image.

## Risks and notes
- The `ForwardingEventSink` worker must never raise into request handling; a recording failure must not change the response the attacker sees.
- Do not log tokens or full request bodies.
- Event ids come from the decoy; the backend must treat them as untrusted (validate UUID format, length limits).
- `is_test_event` stays as is.

## Test plan
- Unit: serialization fills ids and timestamps; spool append and replay; spool size cap; backoff; idempotent ingest; bad token rejected; oversized batch rejected.
- Decoy app (httpx ASGITransport, no database configured): each R1.1 path returns 404; each R1.2 route returns its normal response; a decoy login produces an event on the sink.
- Integration: decoy app plus backend app wired together with an in-process transport; login event appears in the backend API and in the WebSocket summary.
- Regression: full existing suite against `app.main:app`.
