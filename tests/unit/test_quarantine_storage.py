"""Unit tests for quarantine storage, path traversal defenses, and MIME detection."""

import io
from pathlib import Path
import pytest
from starlette.datastructures import UploadFile
from app.core.quarantine import (
    detect_mime_type_from_header,
    is_safe_quarantine_path,
    sanitize_filename,
    store_quarantined_upload,
)


def test_sanitize_filename_blocks_path_traversal():
    # Dangerous path traversal payloads
    assert sanitize_filename("../../../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\Windows\\System32\\cmd.exe") == "cmd.exe"
    assert sanitize_filename("safe_payload.log") == "safe_payload.log"
    assert sanitize_filename("") == "unnamed_upload.bin"
    assert sanitize_filename(None) == "unnamed_upload.bin"
    # Null byte injection
    assert "\x00" not in sanitize_filename("payload\x00.exe")


def test_detect_mime_type_magic_bytes():
    assert detect_mime_type_from_header(b"\x7fELF\x02\x01\x01") == "application/x-executable-elf"
    assert detect_mime_type_from_header(b"MZ\x90\x00\x03\x00\x00\x00") == "application/x-dosexec-pe"
    assert detect_mime_type_from_header(b"%PDF-1.4\n") == "application/pdf"
    assert detect_mime_type_from_header(b"PK\x03\x04\x14\x00") == "application/zip"
    assert detect_mime_type_from_header(b"#!/bin/bash\necho test") == "text/x-shellscript"
    assert detect_mime_type_from_header(b"Plain text log entry here") == "text/plain"


@pytest.mark.asyncio
async def test_store_quarantined_upload_success():
    payload_content = b"Simulated diagnostic memory dump for testing.\n[TIMESTAMP 2026-10-19] System OK"
    file_obj = io.BytesIO(payload_content)
    upload = UploadFile(file=file_obj, filename="memory_dump.dmp", headers={"content-type": "application/octet-stream"})

    success, result = await store_quarantined_upload(upload)

    assert success is True
    assert result["size"] == len(payload_content)
    assert len(result["sha256"]) == 64
    assert result["sanitized_name"] == "memory_dump.dmp"
    assert result["internal_filename"].endswith(".quarantine")

    # Verify file exists on disk
    target_path = Path(result["internal_path"])
    assert target_path.exists()
    assert is_safe_quarantine_path(str(target_path)) is True

    # Clean up test file
    target_path.unlink()
