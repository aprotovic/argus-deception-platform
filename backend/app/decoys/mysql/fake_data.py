"""Shared fake data for MySQL decoy query responses.

These rows are IDENTICAL to _FAKE_PERSONNEL in decoy_personnel.py.
A test (tests/unit/test_mysql_fake_data.py) fails if they drift.

Rules:
- No real personal data.
- badge_id values are canary identifiers to detect exfiltration.
- Passwords and secrets are never included.
"""

from __future__ import annotations
from typing import Any, Dict, List

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
