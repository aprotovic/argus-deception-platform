---
inclusion: always
---

# ARGUS project rules (read before every task)

ARGUS is a honeypot (cyber deception) graduation project at INSA. The public decoy WILL be attacked by skilled testers, so safety and data integrity come before features.

## Safety rules (never break these)
- Never execute, import, render, evaluate or serve back anything attacker-supplied (uploads, headers, params, bodies). Simulate vulnerabilities; never implement real ones.
- The decoy container must never expose admin routes (auth, events, evidence, export, audit, metrics, websocket, internal, docs) and must never hold database credentials.
- No secrets, passwords or tokens in code, docs, frontend bundles or committed files. Never log passwords or tokens.
- Treat all request data as untrusted. Do not trust X-Forwarded-For unless the request comes from a configured trusted proxy.
- Compare secrets with hmac.compare_digest.

## Working rules
- Work only on the active spec in .kiro/specs/. Do not add features or refactor unrelated code.
- Keep diffs small. Keep `uvicorn app.main:app` all-in-one mode working exactly as before.
- Every behavior change needs a pytest test. Never delete or weaken existing tests. Run the full test suite before marking a task done.
- Never commit .venv, node_modules, data/, .env or uploaded samples.
- Stack: Python 3.13, FastAPI, async SQLAlchemy, pytest-asyncio, httpx. Follow existing code style and the existing logger.
- Never commit to main. Work on a feature branch and make small commits with clear messages.
