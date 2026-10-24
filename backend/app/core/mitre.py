"""MITRE ATT&CK technique mapping for ARGUS security event types."""

from typing import Dict

MITRE_MAP: Dict[str, Dict[str, str]] = {
    "recon_probe": {
        "id": "T1190",
        "name": "Exploit Public-Facing Application",
        "tactic": "Initial Access",
    },
    "login_attempt": {
        "id": "T1110",
        "name": "Brute Force",
        "tactic": "Credential Access",
    },
    "sql_injection": {
        "id": "T1190",
        "name": "Exploit Public-Facing Application",
        "tactic": "Initial Access",
    },
    "file_upload": {
        "id": "T1105",
        "name": "Ingress Tool Transfer",
        "tactic": "Command and Control",
    },
    "terminal_exec": {
        "id": "T1059",
        "name": "Command and Scripting Interpreter",
        "tactic": "Execution",
    },
    "honeytoken_access": {
        "id": "T1083",
        "name": "File and Directory Discovery",
        "tactic": "Discovery",
    },
    "contractor_credential_use": {
        "id": "T1078",
        "name": "Valid Accounts",
        "tactic": "Defense Evasion",
    },
    "unauthorized_access": {
        "id": "T1078",
        "name": "Valid Accounts",
        "tactic": "Defense Evasion",
    },
    "malformed_request": {
        "id": "T1190",
        "name": "Exploit Public-Facing Application",
        "tactic": "Initial Access",
    },
    "db_query": {
        "id": "T1213",
        "name": "Data from Information Repositories",
        "tactic": "Collection",
    },
}

_DEFAULT = {
    "id": "T1190",
    "name": "Exploit Public-Facing Application",
    "tactic": "Initial Access",
}


def get_mitre(event_type: str) -> Dict[str, str]:
    """Return the MITRE ATT&CK technique dict for a given event_type."""
    return MITRE_MAP.get(event_type, _DEFAULT)
