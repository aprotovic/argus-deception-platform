"""Consistency test: fake_data.py rows must match decoy_personnel._FAKE_PERSONNEL.

This test FAILS if the two sources drift apart. It is the single source of
truth that both the HTTP decoy and the MySQL decoy present the same data.
"""

import pytest

from app.decoys.mysql.fake_data import (
    PERSONNEL_ROWS,
    PERSONNEL_PUBLIC_COLUMNS,
)
from app.api.v1.decoy_personnel import (
    _FAKE_PERSONNEL,
    _PUBLIC_COLUMNS,
)


def test_row_count_matches():
    """Both tables must have the same number of rows."""
    assert len(PERSONNEL_ROWS) == len(_FAKE_PERSONNEL), (
        f"fake_data has {len(PERSONNEL_ROWS)} rows, "
        f"decoy_personnel has {len(_FAKE_PERSONNEL)}"
    )


def test_public_columns_match():
    """Both sources must export the same public column list."""
    assert PERSONNEL_PUBLIC_COLUMNS == _PUBLIC_COLUMNS, (
        f"Column lists differ:\n"
        f"  fake_data:        {PERSONNEL_PUBLIC_COLUMNS}\n"
        f"  decoy_personnel:  {_PUBLIC_COLUMNS}"
    )


def test_every_row_matches():
    """Every row in fake_data must match the corresponding row in decoy_personnel."""
    for i, (fd_row, dp_row) in enumerate(zip(PERSONNEL_ROWS, _FAKE_PERSONNEL)):
        assert fd_row == dp_row, (
            f"Row {i} differs:\n"
            f"  fake_data:       {fd_row}\n"
            f"  decoy_personnel: {dp_row}"
        )


def test_employee_ids_are_unique():
    ids = [r["employee_id"] for r in PERSONNEL_ROWS]
    assert len(ids) == len(set(ids)), "Duplicate employee_id values"


def test_badge_ids_are_unique():
    badges = [r["badge_id"] for r in PERSONNEL_ROWS]
    assert len(badges) == len(set(badges)), "Duplicate badge_id values"


def test_no_real_secrets_in_rows():
    """Rows must not contain password-like fields."""
    for row in PERSONNEL_ROWS:
        for key in row:
            assert "password" not in key.lower(), f"Field '{key}' looks like a secret"
            assert "secret" not in key.lower(), f"Field '{key}' looks like a secret"
