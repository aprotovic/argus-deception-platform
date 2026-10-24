"""Shared fake data for MySQL decoy query responses.

These rows are IDENTICAL to _FAKE_PERSONNEL in decoy_personnel.py.
A test (tests/unit/test_mysql_fake_data.py) fails if they drift.

Rules:
- No real personal data.
- badge_id values are canary identifiers to detect exfiltration.
- Passwords and secrets are never included.
- access_log and departments are derived from PERSONNEL_ROWS; tests enforce
  that every employee_id/name/badge_id in access_log appears in PERSONNEL_ROWS
  and every department name in DEPARTMENTS_ROWS appears in PERSONNEL_ROWS.
"""

from __future__ import annotations
from typing import Any, Dict, List, Tuple

PERSONNEL_PUBLIC_COLUMNS: List[str] = [
    "employee_id",
    "full_name",
    "title",
    "clearance",
    "department",
    "email",
    "office_ext",
    "location",
]

# All columns including badge_id (shown on simulated SQLi dump only).
PERSONNEL_ALL_COLUMNS: List[str] = PERSONNEL_PUBLIC_COLUMNS + ["badge_id"]

PERSONNEL_ROWS: List[Dict[str, Any]] = [
    {
        "employee_id": "NX-1001",
        "full_name": "Harrison Blake",
        "title": "Director of Enclave Operations",
        "clearance": "TS/SCI",
        "department": "Tactical Network Division",
        "email": "h.blake@defense.internal",
        "office_ext": "DSN-312-555-0101",
        "location": "Enclave VA-01 // Pentagon Annex B",
        "badge_id": "NX-7F3A-1001-B9",
    },
    {
        "employee_id": "NX-1008",
        "full_name": "Sophia Reeves",
        "title": "Cryptographic Systems Architect",
        "clearance": "TS/SCI-Q",
        "department": "Crypto Engineering",
        "email": "s.reeves@defense.internal",
        "office_ext": "DSN-312-555-0108",
        "location": "Enclave VA-01 // SCIF Lab 3",
        "badge_id": "NX-A2C8-1008-F1",
    },
    {
        "employee_id": "NX-1015",
        "full_name": "Marcus Webb",
        "title": "Satellite Link Operations Lead",
        "clearance": "SECRET",
        "department": "SATCOM Division",
        "email": "m.webb@satcom.defense.internal",
        "office_ext": "DSN-312-555-0115",
        "location": "Enclave PAC-03 // Remote Node",
        "badge_id": "NX-3D91-1015-C4",
    },
    {
        "employee_id": "NX-1022",
        "full_name": "Elena Vasquez",
        "title": "SecOps Incident Response Analyst",
        "clearance": "SECRET",
        "department": "Security Operations Center",
        "email": "e.vasquez@soc.defense.internal",
        "office_ext": "DSN-312-555-0122",
        "location": "Enclave VA-01 // SOC Floor 2",
        "badge_id": "NX-B5E0-1022-D7",
    },
    {
        "employee_id": "NX-1031",
        "full_name": "Tariq Al-Nasir",
        "title": "Zero-Trust Network Architect",
        "clearance": "TS/SCI",
        "department": "Network Security",
        "email": "t.alnasir@defense.internal",
        "office_ext": "DSN-312-555-0131",
        "location": "Enclave EU-02 // Frankfurt Node",
        "badge_id": "NX-9F12-1031-A3",
    },
    {
        "employee_id": "NX-1042",
        "full_name": "Miller Christopher",
        "title": "Lead Systems Engineer",
        "clearance": "TS/SCI",
        "department": "Infrastructure",
        "email": "c.miller@defense.internal",
        "office_ext": "DSN-312-555-0142",
        "location": "Enclave VA-01 // Server Farm B",
        "badge_id": "NX-C4B7-1042-E2",
    },
    {
        "employee_id": "NX-1058",
        "full_name": "Dana Park",
        "title": "Compliance & STIG Auditor",
        "clearance": "SECRET",
        "department": "Compliance Division",
        "email": "d.park@compliance.defense.internal",
        "office_ext": "DSN-312-555-0158",
        "location": "Enclave VA-01 // Admin Wing",
        "badge_id": "NX-E8D3-1058-61",
    },
    {
        "employee_id": "NX-1067",
        "full_name": "James Okoro",
        "title": "Hardware Security Module Engineer",
        "clearance": "TS/SCI-Q",
        "department": "Crypto Engineering",
        "email": "j.okoro@hsm.defense.internal",
        "office_ext": "DSN-312-555-0167",
        "location": "Enclave VA-01 // SCIF Lab 1",
        "badge_id": "NX-F1A6-1067-22",
    },
]

# ---------------------------------------------------------------------------
# Access log — one entry per employee (8 rows, matching PERSONNEL_ROWS exactly)
# ---------------------------------------------------------------------------
ACCESS_LOG_COLUMNS: List[str] = [
    "log_id", "employee_id", "full_name", "badge_id",
    "access_time", "location", "access_type",
]

ACCESS_LOG_ROWS: List[Dict[str, Any]] = [
    {
        "log_id":       "AL-0091",
        "employee_id":  "NX-1001",
        "full_name":    "Harrison Blake",
        "badge_id":     "NX-7F3A-1001-B9",
        "access_time":  "2026-10-22 07:14:33",
        "location":     "Enclave VA-01 // Pentagon Annex B",
        "access_type":  "ENTRY",
    },
    {
        "log_id":       "AL-0092",
        "employee_id":  "NX-1008",
        "full_name":    "Sophia Reeves",
        "badge_id":     "NX-A2C8-1008-F1",
        "access_time":  "2026-10-22 08:02:11",
        "location":     "Enclave VA-01 // SCIF Lab 3",
        "access_type":  "ENTRY",
    },
    {
        "log_id":       "AL-0093",
        "employee_id":  "NX-1015",
        "full_name":    "Marcus Webb",
        "badge_id":     "NX-3D91-1015-C4",
        "access_time":  "2026-10-22 06:55:47",
        "location":     "Enclave PAC-03 // Remote Node",
        "access_type":  "ENTRY",
    },
    {
        "log_id":       "AL-0094",
        "employee_id":  "NX-1022",
        "full_name":    "Elena Vasquez",
        "badge_id":     "NX-B5E0-1022-D7",
        "access_time":  "2026-10-22 09:31:05",
        "location":     "Enclave VA-01 // SOC Floor 2",
        "access_type":  "ENTRY",
    },
    {
        "log_id":       "AL-0095",
        "employee_id":  "NX-1031",
        "full_name":    "Tariq Al-Nasir",
        "badge_id":     "NX-9F12-1031-A3",
        "access_time":  "2026-10-22 07:48:19",
        "location":     "Enclave EU-02 // Frankfurt Node",
        "access_type":  "ENTRY",
    },
    {
        "log_id":       "AL-0096",
        "employee_id":  "NX-1042",
        "full_name":    "Miller Christopher",
        "badge_id":     "NX-C4B7-1042-E2",
        "access_time":  "2026-10-22 08:17:44",
        "location":     "Enclave VA-01 // Server Farm B",
        "access_type":  "ENTRY",
    },
    {
        "log_id":       "AL-0097",
        "employee_id":  "NX-1058",
        "full_name":    "Dana Park",
        "badge_id":     "NX-E8D3-1058-61",
        "access_time":  "2026-10-22 09:03:22",
        "location":     "Enclave VA-01 // Admin Wing",
        "access_type":  "ENTRY",
    },
    {
        "log_id":       "AL-0098",
        "employee_id":  "NX-1067",
        "full_name":    "James Okoro",
        "badge_id":     "NX-F1A6-1067-22",
        "access_time":  "2026-10-22 08:44:57",
        "location":     "Enclave VA-01 // SCIF Lab 1",
        "access_type":  "ENTRY",
    },
]

# ---------------------------------------------------------------------------
# Departments — 7 distinct departments from PERSONNEL_ROWS
# ---------------------------------------------------------------------------
DEPARTMENTS_COLUMNS: List[str] = [
    "dept_id", "dept_name", "clearance_required", "director",
    "location", "headcount",
]

DEPARTMENTS_ROWS: List[Dict[str, Any]] = [
    {
        "dept_id":           "DEPT-01",
        "dept_name":         "Tactical Network Division",
        "clearance_required": "TS/SCI",
        "director":          "Harrison Blake",
        "location":          "Enclave VA-01",
        "headcount":         "12",
    },
    {
        "dept_id":           "DEPT-02",
        "dept_name":         "Crypto Engineering",
        "clearance_required": "TS/SCI-Q",
        "director":          "Sophia Reeves",
        "location":          "Enclave VA-01",
        "headcount":         "8",
    },
    {
        "dept_id":           "DEPT-03",
        "dept_name":         "SATCOM Division",
        "clearance_required": "SECRET",
        "director":          "Marcus Webb",
        "location":          "Enclave PAC-03",
        "headcount":         "6",
    },
    {
        "dept_id":           "DEPT-04",
        "dept_name":         "Security Operations Center",
        "clearance_required": "SECRET",
        "director":          "Elena Vasquez",
        "location":          "Enclave VA-01",
        "headcount":         "15",
    },
    {
        "dept_id":           "DEPT-05",
        "dept_name":         "Network Security",
        "clearance_required": "TS/SCI",
        "director":          "Tariq Al-Nasir",
        "location":          "Enclave EU-02",
        "headcount":         "9",
    },
    {
        "dept_id":           "DEPT-06",
        "dept_name":         "Infrastructure",
        "clearance_required": "TS/SCI",
        "director":          "Miller Christopher",
        "location":          "Enclave VA-01",
        "headcount":         "11",
    },
    {
        "dept_id":           "DEPT-07",
        "dept_name":         "Compliance Division",
        "clearance_required": "SECRET",
        "director":          "Dana Park",
        "location":          "Enclave VA-01",
        "headcount":         "5",
    },
]

# ---------------------------------------------------------------------------
# DESCRIBE / SHOW COLUMNS schemas
# Each row: [Field, Type, Null, Key, Default, Extra]
# ---------------------------------------------------------------------------
TABLE_SCHEMAS: Dict[str, List[List[str]]] = {
    "personnel": [
        ["employee_id", "varchar(16)",  "NO",  "PRI", None,  ""],
        ["full_name",   "varchar(128)", "NO",  "",    None,  ""],
        ["title",       "varchar(128)", "YES", "",    None,  ""],
        ["clearance",   "varchar(16)",  "NO",  "",    None,  ""],
        ["department",  "varchar(64)",  "NO",  "MUL", None,  ""],
        ["email",       "varchar(128)", "NO",  "UNI", None,  ""],
        ["office_ext",  "varchar(32)",  "YES", "",    None,  ""],
        ["location",    "varchar(128)", "YES", "",    None,  ""],
    ],
    "access_log": [
        ["log_id",      "varchar(16)",  "NO",  "PRI", None,  ""],
        ["employee_id", "varchar(16)",  "NO",  "MUL", None,  ""],
        ["full_name",   "varchar(128)", "NO",  "",    None,  ""],
        ["badge_id",    "varchar(24)",  "NO",  "",    None,  ""],
        ["access_time", "datetime",     "NO",  "MUL", None,  ""],
        ["location",    "varchar(128)", "YES", "",    None,  ""],
        ["access_type", "varchar(8)",   "NO",  "",    None,  ""],
    ],
    "departments": [
        ["dept_id",            "varchar(8)",   "NO",  "PRI", None, ""],
        ["dept_name",          "varchar(64)",  "NO",  "UNI", None, ""],
        ["clearance_required", "varchar(16)",  "NO",  "",    None, ""],
        ["director",           "varchar(128)", "YES", "",    None, ""],
        ["location",           "varchar(32)",  "YES", "",    None, ""],
        ["headcount",          "int",          "YES", "",    None, ""],
    ],
}
