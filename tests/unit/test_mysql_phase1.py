"""Tests for Phase 1 items 1–4.

Item 1: ERR 1046 when no db selected and table referenced
Item 2: access_log, departments rows + COUNT(*), col-list SELECT, WHERE, LIMIT
Item 3: SHOW GRANTS, SHOW VARIABLES LIKE, SHOW TABLES FROM, DESCRIBE, i_s.tables
Item 4: 201-query cap (in test_mysql_query_cap_integration.py)
"""

import struct
from types import SimpleNamespace
import pytest

from app.decoys.mysql.fake_data import (
    ACCESS_LOG_ROWS,
    DEPARTMENTS_ROWS,
    PERSONNEL_ROWS,
    TABLE_SCHEMAS,
)
from app.decoys.mysql.responses import dispatch_query, _err1064_msg

VERSION = "8.0.36-0ubuntu0.22.04.1"


def _ctx(database=None, username="root", peer_ip="10.0.0.1", conn_id=42):
    return SimpleNamespace(
        username=username, peer_ip=peer_ip,
        database=database, connection_id=conn_id,
    )


def _unframe(pkt):
    length = pkt[0] | (pkt[1] << 8) | (pkt[2] << 16)
    return pkt[4:4 + length], pkt[3]


def _first_payload(pkts):
    return _unframe(pkts[0])[0]


def _result_rows(pkts):
    """Extract string values from result-set row packets."""
    # pkts: col_count, N col_defs, eof, M rows, eof
    if len(pkts) < 4:
        return []
    from app.decoys.mysql.protocol import decode_lenenc, decode_lenenc_str
    col_count = _unframe(pkts[0])[0][0]
    rows = []
    for pkt in pkts[2 + col_count:-1]:
        payload, _ = _unframe(pkt)
        if payload and payload[0] == 0xFE:
            break
        off = 0
        row = []
        while off < len(payload):
            if payload[off] == 0xFB:
                row.append(None); off += 1
            else:
                val, n = decode_lenenc_str(payload, off)
                row.append(val.decode("utf-8", errors="replace")); off += n
        rows.append(row)
    return rows


def _is_ok(pkts):
    return _first_payload(pkts)[0] == 0x00


def _err_code(pkts):
    p = _first_payload(pkts)
    if p[0] == 0xFF:
        return struct.unpack_from("<H", p, 1)[0]
    return None


# ---------------------------------------------------------------------------
# Item 1: ERR 1046
# ---------------------------------------------------------------------------
class TestErr1046:
    # Must fire
    def test_select_star_no_db(self):
        pkts = dispatch_query("SELECT * FROM personnel", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) == 1046

    def test_select_count_no_db(self):
        pkts = dispatch_query("SELECT COUNT(*) FROM personnel", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) == 1046

    def test_select_col_list_no_db(self):
        pkts = dispatch_query("SELECT full_name FROM personnel", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) == 1046

    # Must NOT fire — no table reference
    def test_select_1_no_db_ok(self):
        pkts = dispatch_query("SELECT 1", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) is None
        rows = _result_rows(pkts)
        assert rows[0][0] == "1"

    def test_select_version_no_db_ok(self):
        pkts = dispatch_query("SELECT VERSION()", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) is None

    def test_select_now_no_db_ok(self):
        pkts = dispatch_query("SELECT NOW()", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) is None

    def test_select_atversion_no_db_ok(self):
        pkts = dispatch_query("SELECT @@version", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) is None

    def test_show_databases_no_db_ok(self):
        pkts = dispatch_query("SHOW DATABASES", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) is None

    def test_show_variables_no_db_ok(self):
        pkts = dispatch_query("SHOW VARIABLES", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) is None

    def test_show_grants_no_db_ok(self):
        pkts = dispatch_query("SHOW GRANTS", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) is None

    def test_use_no_db_ok(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("USE nexis_hr", ctx, 1, VERSION)
        assert _is_ok(pkts)
        assert ctx.database == "nexis_hr"

    def test_set_no_db_ok(self):
        pkts = dispatch_query("SET NAMES utf8mb4", _ctx(database=None), 1, VERSION)
        assert _is_ok(pkts)

    # db-qualified reference bypasses ERR 1046
    def test_db_qualified_no_err_1046(self):
        pkts = dispatch_query("SELECT * FROM nexis_hr.personnel", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) != 1046

    def test_information_schema_qualified_no_err_1046(self):
        pkts = dispatch_query("SELECT * FROM information_schema.tables", _ctx(database=None), 1, VERSION)
        assert _err_code(pkts) != 1046

    # After USE it works
    def test_after_use_no_err_1046(self):
        ctx = _ctx(database=None)
        dispatch_query("USE nexis_hr", ctx, 1, VERSION)
        pkts = dispatch_query("SELECT * FROM personnel", ctx, 1, VERSION)
        assert _err_code(pkts) != 1046
        rows = _result_rows(pkts)
        assert len(rows) == 8


# ---------------------------------------------------------------------------
# Item 2: fake_data consistency + COUNT, col-list, WHERE, LIMIT
# ---------------------------------------------------------------------------
class TestFakeDataConsistency:
    def test_access_log_employee_ids_in_personnel(self):
        personnel_ids = {r["employee_id"] for r in PERSONNEL_ROWS}
        for row in ACCESS_LOG_ROWS:
            assert row["employee_id"] in personnel_ids, \
                f"access_log employee_id {row['employee_id']!r} not in PERSONNEL_ROWS"

    def test_access_log_names_in_personnel(self):
        personnel_names = {r["full_name"] for r in PERSONNEL_ROWS}
        for row in ACCESS_LOG_ROWS:
            assert row["full_name"] in personnel_names

    def test_access_log_badge_ids_in_personnel(self):
        personnel_badges = {r["badge_id"] for r in PERSONNEL_ROWS}
        for row in ACCESS_LOG_ROWS:
            assert row["badge_id"] in personnel_badges

    def test_departments_names_in_personnel(self):
        personnel_depts = {r["department"] for r in PERSONNEL_ROWS}
        for row in DEPARTMENTS_ROWS:
            assert row["dept_name"] in personnel_depts, \
                f"dept_name {row['dept_name']!r} not in PERSONNEL_ROWS departments"

    def test_departments_directors_are_personnel_names(self):
        personnel_names = {r["full_name"] for r in PERSONNEL_ROWS}
        for row in DEPARTMENTS_ROWS:
            assert row["director"] in personnel_names

    def test_access_log_count_equals_personnel_count(self):
        assert len(ACCESS_LOG_ROWS) == len(PERSONNEL_ROWS)

    def test_departments_count_equals_distinct_departments(self):
        distinct = {r["department"] for r in PERSONNEL_ROWS}
        assert len(DEPARTMENTS_ROWS) == len(distinct)


class TestSelectAccessLog:
    def test_select_star_access_log(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT * FROM access_log", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == len(ACCESS_LOG_ROWS)

    def test_count_star_access_log(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT COUNT(*) FROM access_log", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert rows[0][0] == str(len(ACCESS_LOG_ROWS))

    def test_count_star_departments(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT COUNT(*) FROM departments", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert rows[0][0] == str(len(DEPARTMENTS_ROWS))

    def test_count_star_personnel(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT COUNT(*) FROM personnel", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert rows[0][0] == str(len(PERSONNEL_ROWS))


class TestSelectColList:
    def test_select_specific_columns(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT full_name, clearance FROM personnel", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == len(PERSONNEL_ROWS)
        # first row should be Harrison Blake, TS/SCI
        assert rows[0][0] == "Harrison Blake"
        assert rows[0][1] == "TS/SCI"


class TestWhereFilter:
    def test_where_clearance_secret(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT * FROM personnel WHERE clearance='SECRET'", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        expected = [r for r in PERSONNEL_ROWS if r["clearance"].upper() == "SECRET"]
        assert len(rows) == len(expected)

    def test_where_case_insensitive(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT * FROM personnel WHERE clearance='secret'", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == len([r for r in PERSONNEL_ROWS if r["clearance"].upper() == "SECRET"])

    def test_where_no_match_empty(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT * FROM personnel WHERE clearance='TOP_SECRET_SCI'", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert rows == []

    def test_limit_personnel(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT * FROM personnel LIMIT 3", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == 3

    def test_where_with_limit(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SELECT * FROM personnel WHERE clearance='SECRET' LIMIT 1", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == 1


# ---------------------------------------------------------------------------
# Item 3: SHOW GRANTS, SHOW VARIABLES LIKE, SHOW TABLES FROM, DESCRIBE, i_s
# ---------------------------------------------------------------------------
class TestShowGrants:
    def test_grant_format_backtick(self):
        ctx = _ctx(username="root", database="nexis_hr")
        pkts = dispatch_query("SHOW GRANTS", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == 1
        grant = rows[0][0]
        assert "`root`@`%`" in grant
        assert "GRANT ALL PRIVILEGES ON *.*" in grant
        assert "WITH GRANT OPTION" in grant

    def test_grant_uses_logged_in_username(self):
        ctx = _ctx(username="operator", database=None)
        pkts = dispatch_query("SHOW GRANTS", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert "`operator`@`%`" in rows[0][0]


class TestShowVariables:
    def test_show_variables_returns_20_plus(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SHOW VARIABLES", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) >= 20

    def test_show_variables_like_version_percent(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SHOW VARIABLES LIKE 'version%'", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        names = [r[0] for r in rows]
        assert "version" in names
        assert "version_comment" in names
        # must not include non-version keys
        for n in names:
            assert n.lower().startswith("version")

    def test_show_variables_like_percent_version_percent(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SHOW VARIABLES LIKE '%version%'", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        names = [r[0] for r in rows]
        assert "version" in names
        assert "version_comment" in names

    def test_show_variables_like_exact(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SHOW VARIABLES LIKE 'port'", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == 1
        assert rows[0][0] == "port"
        assert rows[0][1] == "3306"

    def test_show_variables_like_no_match(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SHOW VARIABLES LIKE 'no_such_var_%'", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert rows == []


class TestShowTablesFrom:
    def test_show_tables_from_nexis_hr(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SHOW TABLES FROM nexis_hr", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        names = [r[0] for r in rows]
        assert "personnel" in names
        assert "access_log" in names
        assert "departments" in names

    def test_show_tables_from_header_uses_db_name(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SHOW TABLES FROM nexis_hr", ctx, 1, VERSION)
        # column header should be "Tables_in_nexis_hr"
        from app.decoys.mysql.protocol import decode_lenenc_str
        col_count = _unframe(pkts[0])[0][0]
        col_def_payload, _ = _unframe(pkts[1])  # first col def
        off = 0
        for _ in range(5):  # skip catalog, schema, table, org_table, name
            _, n = decode_lenenc_str(col_def_payload, off); off += n
        name_bytes, _ = decode_lenenc_str(col_def_payload, off)
        assert name_bytes.decode() == "Tables_in_nexis_hr"

    def test_show_tables_from_unknown_db_err_1049(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SHOW TABLES FROM unknowndb", ctx, 1, VERSION)
        assert _err_code(pkts) == 1049


class TestDescribe:
    def test_describe_personnel(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("DESCRIBE personnel", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        field_names = [r[0] for r in rows]
        assert "employee_id" in field_names
        assert "full_name" in field_names
        assert len(rows) == len(TABLE_SCHEMAS["personnel"])

    def test_describe_access_log(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("DESCRIBE access_log", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == len(TABLE_SCHEMAS["access_log"])

    def test_describe_departments(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("DESCRIBE departments", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == len(TABLE_SCHEMAS["departments"])

    def test_describe_unknown_table_1146(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("DESCRIBE nosuch", ctx, 1, VERSION)
        assert _err_code(pkts) == 1146

    def test_show_columns_from_personnel(self):
        ctx = _ctx(database="nexis_hr")
        pkts = dispatch_query("SHOW COLUMNS FROM personnel", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        assert len(rows) == len(TABLE_SCHEMAS["personnel"])


class TestInformationSchemaTables:
    def test_returns_three_nexis_hr_tables(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SELECT * FROM information_schema.tables", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        table_names = [r[2] for r in rows]  # TABLE_NAME is col index 2
        assert "personnel" in table_names
        assert "access_log" in table_names
        assert "departments" in table_names

    def test_works_with_no_database_selected(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SELECT * FROM information_schema.tables", ctx, 1, VERSION)
        assert _err_code(pkts) != 1046

    def test_row_count_in_table_rows_column(self):
        ctx = _ctx(database=None)
        pkts = dispatch_query("SELECT * FROM information_schema.tables", ctx, 1, VERSION)
        rows = _result_rows(pkts)
        # TABLE_ROWS column (index 5) should reflect actual row counts
        for row in rows:
            assert row[5] is not None
            assert int(row[5]) > 0
