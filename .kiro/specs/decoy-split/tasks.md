# Tasks: Decoy split

Work on branch `feat/decoy-split`. Do the tasks in order, one commit per task, and run the full test suite after each.

- [ ] 1. Baseline: run the existing tests and note the result in the first commit message. (R5.1)
- [ ] 2. Extract the root traps and `record_root_trap` from main.py into `app/api/root_traps.py`; include the router in main.py. No behavior change. Tests still pass. (R5.1)
- [ ] 3. Add `app/core/event_sink.py` with `EventSink`, `DbEventSink`, accessors; switch `record_root_trap` to the sink. Default sink keeps current behavior. Add unit tests. (R5.1)
- [ ] 4. Add settings: BACKEND_INGEST_URL, DECOY_SPOOL_DIR, DECOY_SPOOL_MAX_BYTES, DEFAULT_DECOY_ID. (R3, R4)
- [ ] 5. Backend: `ingest-batch` endpoint, Pydantic models with limits, idempotency, default decoy creation, shared broadcast helper, `hmac.compare_digest` in the token check. Tests for token, size limit, idempotency, broadcast. (R3.2 to R3.5)
- [ ] 6. Serialization functions plus `ForwardingEventSink` with queue, worker, spool, backoff, replay on start. Unit tests with an httpx mock transport for success, 5xx, network error, spool cap, restart replay. (R3.1, R4)
- [ ] 7. `EventForwarderSession` adapter and the two-line change in `get_or_create_default_decoy`. Verify every call site in decoy.py (login, mfa, ping, query, honeytoken download, terminal, upload, scanner trap, honeytoken config) produces a correct forwarded event, including LoginAttempt and CapturedFile linked by event_id. (R3.1, R3.5)
- [ ] 8. Create `app/decoy_main.py`. Tests: every R1.1 path is 404, every R1.2 route works, the app starts with DATABASE_URL unset. (R1, R2)
- [ ] 9. Integration test: decoy app and backend app together, login and upload events arrive in the backend with correct data. (R3, R5.2)
- [ ] 10. Compose: decoy command, env, spool volume. Add `scripts/e2e_decoy_split.sh` that brings up the stack and checks: decoy login becomes visible in the backend API; `curl -i localhost:8080/api/v1/auth/login` is 404; stopping the backend and sending requests then restarting it delivers the spooled events. (R6)
- [ ] 11. Docs: update ARCHITECTURE and KNOWN_LIMITATIONS to describe the real flow. (R6)
- [ ] 12. Final: full test suite, then open a pull request into `develop` listing the R1 to R6 checks.
