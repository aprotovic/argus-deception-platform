"""Safe payload collection and quarantine storage manager."""

import hashlib
import os
import re
import uuid
from pathlib import Path
from typing import Any, BinaryIO, Dict, Optional, Tuple
from fastapi import UploadFile
from app.config import settings
from app.logging_config import logger

# Magic byte signatures for safe, parser-free MIME type identification
MAGIC_SIGNATURES: Dict[bytes, str] = {
    b"\x7fELF": "application/x-executable-elf",
    b"MZ": "application/x-dosexec-pe",
    b"%PDF": "application/pdf",
    b"PK\x03\x04": "application/zip",
    b"\x1f\x8b": "application/gzip",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
    b"#!/bin/": "text/x-shellscript",
    b"#!/usr/bin/": "text/x-shellscript",
    b"<?php": "text/x-php",
    b"<!DOCTYPE html": "text/html",
    b"<html": "text/html",
}


def sanitize_filename(filename: Optional[str]) -> str:
    """
    Sanitizes user-supplied filename to prevent directory traversal and filesystem attacks.
    Never uses this as the actual disk filename!
    """
    if not filename:
        return "unnamed_upload.bin"

    # Strip null bytes and normalize backslashes cross-platform
    cleaned = filename.replace("\x00", "").replace("\\", "/")

    # Extract base name only (blocks ../, ..\, C:\)
    cleaned = os.path.basename(cleaned)

    # Replace suspicious characters with underscore
    cleaned = re.sub(r"[^\w\.\-\_]", "_", cleaned)

    # Limit length
    if len(cleaned) > 200:
        name_part, ext = os.path.splitext(cleaned)
        cleaned = name_part[:190] + ext[:10]

    return cleaned or "upload.bin"


def detect_mime_type_from_header(header_bytes: bytes) -> str:
    """Detects MIME type from file header magic bytes without executing parsers."""
    for magic, mime in MAGIC_SIGNATURES.items():
        if header_bytes.startswith(magic):
            return mime

    # Check for shell script or PHP signatures anywhere in the first 512 bytes
    if b"#!/bin/" in header_bytes or b"#!/usr/bin/" in header_bytes:
        return "text/x-shellscript"
    if b"<?php" in header_bytes:
        return "text/x-php"

    # Check for ASCII / UTF-8 readable text
    try:
        sample = header_bytes[:512].decode("utf-8")
        if all(ord(c) >= 32 or c in "\n\r\t" for c in sample):
            return "text/plain"
    except UnicodeDecodeError:
        pass

    return "application/octet-stream"


def get_quarantine_storage_usage() -> int:
    """Returns current total bytes stored in quarantine directory."""
    total_bytes = 0
    quarantine_dir = settings.quarantine_path
    if quarantine_dir.exists():
        for entry in quarantine_dir.iterdir():
            if entry.is_file() and entry.name != ".gitkeep":
                try:
                    total_bytes += entry.stat().st_size
                except OSError:
                    pass
    return total_bytes


async def store_quarantined_upload(
    upload_file: UploadFile,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Safely streams an uploaded file into quarantine.
    Calculates SHA-256 hash, enforces size limits and storage quotas,
    generates UUID internal filename, and writes with restricted permissions (0600).
    """
    quarantine_dir = settings.quarantine_path
    sanitized_original = sanitize_filename(upload_file.filename)
    declared_mime = upload_file.content_type or "application/octet-stream"

    # Check total quarantine storage quota
    current_quota = get_quarantine_storage_usage()
    if current_quota >= settings.MAX_QUARANTINE_QUOTA_BYTES:
        return False, {
            "rejection_reason": "Quarantine storage quota exceeded on host",
            "sanitized_name": sanitized_original,
            "declared_mime": declared_mime,
            "detected_mime": "unknown",
            "size": 0,
            "sha256": "",
            "internal_path": "",
        }

    # Generate isolated internal storage path with .quarantine suffix
    file_uuid = uuid.uuid4()
    internal_filename = f"{file_uuid}.quarantine"
    target_path = quarantine_dir / internal_filename

    sha256_hasher = hashlib.sha256()
    total_bytes_written = 0
    header_bytes = b""

    try:
        with open(target_path, "wb") as out_file:
            while True:
                chunk = await upload_file.read(64 * 1024)  # 64 KB chunk
                if not chunk:
                    break

                total_bytes_written += len(chunk)

                if not header_bytes:
                    header_bytes = chunk[:512]

                # Check individual file size limit
                if total_bytes_written > settings.MAX_UPLOAD_SIZE_BYTES:
                    # File exceeded limit - abort and remove file immediately
                    out_file.close()
                    if target_path.exists():
                        target_path.unlink()
                    return False, {
                        "rejection_reason": f"File size exceeds limit of {settings.MAX_UPLOAD_SIZE_BYTES} bytes",
                        "sanitized_name": sanitized_original,
                        "declared_mime": declared_mime,
                        "detected_mime": detect_mime_type_from_header(header_bytes),
                        "size": total_bytes_written,
                        "sha256": sha256_hasher.hexdigest(),
                        "internal_path": "",
                    }

                sha256_hasher.update(chunk)
                out_file.write(chunk)

        # Set restrictive permissions: Read & write only for the application user (chmod 0600)
        try:
            os.chmod(target_path, 0o600)
        except OSError:
            pass  # Windows may not support UNIX file modes

        detected_mime = detect_mime_type_from_header(header_bytes)
        calculated_sha256 = sha256_hasher.hexdigest()

        return True, {
            "internal_path": str(target_path),
            "internal_filename": internal_filename,
            "sanitized_name": sanitized_original,
            "sha256": calculated_sha256,
            "size": total_bytes_written,
            "declared_mime": declared_mime,
            "detected_mime": detected_mime,
            "file_uuid": file_uuid,
        }

    except Exception as e:
        if target_path.exists():
            try:
                target_path.unlink()
            except OSError:
                pass
        logger.error(f"Error while storing quarantined file: {str(e)}")
        return False, {
            "rejection_reason": f"Internal I/O failure during storage: {str(e)}",
            "sanitized_name": sanitized_original,
            "declared_mime": declared_mime,
            "detected_mime": "unknown",
            "size": total_bytes_written,
            "sha256": "",
            "internal_path": "",
        }


def is_safe_quarantine_path(path_str: str) -> bool:
    """Verifies that a target file path strictly resides within the configured quarantine directory."""
    try:
        resolved_path = Path(path_str).resolve()
        quarantine_root = settings.quarantine_path.resolve()
        return quarantine_root in resolved_path.parents and resolved_path.exists()
    except Exception:
        return False
