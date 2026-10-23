# Tasks: MySQL decoy

Branch feat/mysql-decoy from the latest main. Order matters. One commit per task, run the full suite after each.

MILESTONE A = tasks 1 to 4 (handshake, credential capture, logging). Ship this at minimum.
MILESTONE B = tasks 5 to 7 (fake queries). CUT LINE: if milestone A is not working with the real mysql client by Sat Oct 24 12:00, stop and ship what exists.

- [ ] 1. protocol.py and tests: lenenc, packet read and write with size cap, handshake v10 builder, handshake response 41 parser, OK, ERR, EOF packets. (R1)
- [ ] 2. auth.py and tests: native-password scramble, constant-time verify, hashcat string. (R2.2, R3.1)
- [ ] 3. server.py: asyncio server, limits and timeouts, handshake, login with bait credentials, ERR 1045 on failure, close on malformed input; a raw-socket test client; a JSONL stub sink for local runs. (R1, R3.1, R4)
- [ ] 4. events.py and classifier.py: db_connection and db_login_attempt events with the stored salt, response and hashcat string, wired to ForwardingEventSink; settings added; per-IP aggregation. (R2.1, R2.2, R2.5, R4.3)
- [ ] 5. responses.py: command phase (QUIT, PING, INIT_DB, QUERY), fixed fake answers, result set encoder, ERR for everything else. (R3.3, R3.4)
- [ ] 6. db_query events with tags and severity. (R2.3, R2.4)
- [ ] 7. Lure rule (5 failures then root accepted) behind a setting. (R3.2)
- [ ] 8. Robustness tests: random garbage, connection cap, idle timeout, oversized packet. (R4)
- [ ] 9. Compose service block, spool volume, hardening, entry point; frontend label map for the three new event types. (R5)
- [ ] 10. scripts/e2e_mysql_decoy.sh and a manual check from a second machine with the mysql client, nmap and hydra. Update docs. Open a pull request into main.
