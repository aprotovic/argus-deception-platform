# Requirements: MySQL decoy (low interaction)

## Purpose
A second decoy: a fake MySQL server on port 3306. Scanners and attackers connect, try credentials and run queries. Everything is logged as ARGUS events. Nothing the attacker sends is ever executed.

## Safety rules (apply to every requirement)
- No real database engine. All answers come from a fixed table of fake responses.
- NEVER advertise or use LOCAL INFILE (client file reading) and never send any packet that asks the client to read a file.
- No outbound connections, no file reads or writes except the event spool.
- Every size, count and time must be capped (see R4). A length field from the attacker is never trusted for allocation.

## R1. Protocol presence
1.1 The service SHALL listen on a configurable TCP port (default 3306) and complete the MySQL handshake with the mysql command-line client, the nmap script mysql-info, and a Python client.
1.2 The service SHALL send an initial handshake with a realistic version string (setting, default "8.0.36-0ubuntu0.22.04.1"), plugin mysql_native_password and a random 20-byte salt per connection. It SHALL NOT advertise SSL, compression, LOCAL INFILE or DEPRECATE_EOF capabilities.

## R2. Logging (existing SecurityEvent schema, no migration)
2.1 Every connection SHALL log event_type db_connection (source ip and port, start, duration, bytes in and out at close).
2.2 Every login attempt SHALL log db_login_attempt with: username, requested database, auth plugin, capability flags, charset, the salt (hex) and the client auth response (hex), the result (accepted or denied). Also store the hashcat-ready string $mysqlna$<salt hex>*<response hex> so captured attempts can be cracked offline.
2.3 Every command after login SHALL log db_query with the command type, the query text (truncated to 4 KB with a truncated flag) and the response sent.
2.4 Queries SHALL be tagged: sqli (UNION, OR 1=1, comment tricks, SLEEP, BENCHMARK), recon (information_schema, @@version, SHOW DATABASES or TABLES, USER()), file_access (INTO OUTFILE or DUMPFILE, LOAD_FILE), priv_esc (GRANT, CREATE USER), destructive (DROP, TRUNCATE, DELETE). Severity follows the tag.
2.5 Events use http_method "SQL" and request_path "/mysql/<phase>" and put the details in metadata_payload. Events are sent through the existing ForwardingEventSink (app/core/event_sink.py), so the decoy never needs database access.

## R3. Behavior
3.1 Bait credentials come from settings (a list of username and password pairs). The server SHALL verify the client response with the mysql_native_password scramble. On a match it sends OK and enters the command phase. Otherwise it sends ERR 1045 "Access denied for user 'u'@'ip' (using password: YES or NO)".
3.2 Optional lure (setting, default on): after 5 failed attempts from one IP within 10 minutes, the next attempt for the user root is accepted.
3.3 Command phase: COM_QUIT, COM_PING, COM_INIT_DB, COM_QUERY are handled; any other command gets ERR 1047. Queries are answered from a fixed table: VERSION(), @@version, DATABASE(), USER(), CURRENT_USER(), SHOW DATABASES, SHOW TABLES, USE <db>, SET ..., and SELECT ... FROM users, api_keys or contracts (fixed fake rows, WHERE ignored). Anything else gets ERR 1064 or 1142.
3.4 Fake data matches the Nexis Defense portal theme. It contains no real personal data. Password hash columns hold made-up strings that do not correspond to real passwords.

## R4. Robustness and limits
4.1 Defaults: 200 concurrent connections (extra ones are closed immediately and counted), packets over 1 MB close the connection, idle timeout 30 s, connection lifetime 5 min, 200 commands per connection.
4.2 Malformed, truncated or garbage input SHALL never crash or hang the service: close the connection and log db_malformed (rate limited).
4.3 After 100 events per minute from one IP, logging SHALL aggregate into a summary event with a count.

## R5. Integration
5.1 Run as its own container with the same argus-app image: command python -m app.decoys.mysql.server. Networks: decoy-net and backend-internal only (never db-net). read_only, cap_drop ALL, no-new-privileges, resource limits, its own spool volume.
5.2 The dashboard SHALL show db_connection, db_login_attempt and db_query events with readable labels. Unknown event types must not break any dashboard view.

## Out of scope
Real SQL parsing, TLS, other protocols, writing data, replication.
