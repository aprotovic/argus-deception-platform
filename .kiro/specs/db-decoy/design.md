# Design: MySQL decoy

New files only. Branch: feat/mysql-decoy, created from the latest main.

## Layout
backend/app/decoys/__init__.py
backend/app/decoys/mysql/protocol.py   pure functions, no sockets
backend/app/decoys/mysql/auth.py       native-password scramble and hashcat string
backend/app/decoys/mysql/responses.py  fixed fake data and query matcher
backend/app/decoys/mysql/classifier.py tags and severity
backend/app/decoys/mysql/events.py     build SecurityEvent objects
backend/app/decoys/mysql/server.py     asyncio server, limits, entry point
backend/tests/unit/test_mysql_*.py, backend/tests/integration/test_mysql_decoy.py
Shared files touched: docker-compose.yml (one new service block), config.py (new settings in one block at the end), frontend event label map (one small edit).

Read first and copy patterns from: app/core/event_sink.py (ForwardingEventSink, how to persist events), app/api/root_traps.py (how SecurityEvent objects are built), app/models/security_event.py.

## Protocol notes (MySQL client/server protocol)
- Packet = 3-byte little-endian payload length + 1-byte sequence id + payload. The sequence id restarts at 0 for each command. Payload over 16 MB is split; here anything over the 1 MB cap closes the connection.
- Initial Handshake v10: protocol byte 10, version string NUL-terminated, 4-byte connection id, first 8 bytes of salt, filler, capability flags (lower 2 bytes), charset (45 = utf8mb4), status flags, capability flags (upper 2 bytes), auth data length (21), 10 reserved bytes, remaining salt bytes (12 plus NUL), plugin name "mysql_native_password" NUL-terminated.
- Handshake Response 41: capability flags (4), max packet (4), charset (1), 23 reserved bytes, username NUL-terminated, auth response (length-prefixed if CLIENT_SECURE_CONNECTION, or length-encoded), optional database NUL-terminated (if CLIENT_CONNECT_WITH_DB), optional plugin name. If the client sends a short 32-byte packet it is an SSL request: we never advertise SSL, so treat it as malformed and close.
- mysql_native_password: expected = SHA1(password) XOR SHA1(salt + SHA1(SHA1(password))). Compare with hmac.compare_digest.
- hashcat mode 11200 string: $mysqlna$<salt hex>*<client response hex>, using the 20-byte salt and the 20-byte client response exactly as captured. Check the example in the hashcat documentation to confirm the format before relying on it.
- OK packet: 0x00, affected rows (lenenc), last insert id (lenenc), status flags (2), warnings (2). ERR packet: 0xFF, error code (2), "#" + 5-char SQL state, message. EOF packet: 0xFE, warnings (2), status (2).
- Text result set: column count (lenenc), one column definition per column (catalog "def", schema, table, org table, name, org name, 0x0c, charset, length, type, flags, decimals, 2 filler bytes), EOF, then one row per result (each value a lenenc string, NULL = 0xFB), EOF.

## Server behavior
- asyncio.start_server with a semaphore for the connection cap. Each connection handler wraps everything in try/except and always closes cleanly. Use asyncio.wait_for on every read with the idle timeout, plus an overall deadline.
- Read packets with a helper that checks the 3-byte length against the cap BEFORE reading the payload.
- Events: build with the same SecurityEvent fields as the HTTP decoy; persist through the ForwardingEventSink started in the entry point (set_event_sink). Per-IP aggregation in a small dict with pruning.
- Source IP is the socket peer address. Verify from a second machine that real client IPs appear (Docker Desktop and some setups show the gateway address).

## Compose service (add, do not edit others)
argus-mysql-decoy: image argus-app:latest, pull_policy never, command python -m app.decoys.mysql.server, env BACKEND_INGEST_URL, INTERNAL_INGESTION_TOKEN, ARGUS_PASSWORD_FINGERPRINT_SECRET, spool dir pointing to a new volume mysql_spool, networks decoy-net and backend-internal, ports 127.0.0.1:3306:3306 for local use (public bind only on the deployment server), read_only, cap_drop ALL, no-new-privileges, tmpfs /tmp, resource limits, depends_on argus-backend.

## Test plan
- Unit: lenenc, packet framing, handshake builder output, handshake response parser (valid, truncated, oversized, garbage), scramble with a known vector, hashcat string format, classifier tags, query matcher.
- Integration: a small raw-socket MySQL client in the test (no new dependency) does the handshake with a bait credential, then SHOW DATABASES and a fake-table SELECT; and a wrong password gets ERR 1045. Assert the events that reached the sink.
- Robustness: 500 random byte sequences sent as first packet, then check the server still accepts a normal login. Test the connection cap and the idle timeout with short settings.
- Manual (scripts/e2e_mysql_decoy.sh): mysql -h HOST -P 3306 -u root -p (bad and good), nmap -sV -p3306 --script mysql-info, hydra mysql module, sqlmap against the personnel endpoint is separate. Confirm all appear in the dashboard.
