"""Unit tests for the MySQL query classifier and sanitiser (items 5, 6)."""

import pytest
from app.decoys.mysql.classifier import classify, sanitize_query_text


class TestClassifier:
    # --- sqli ---
    def test_union_select_is_sqli(self):
        assert classify("SELECT 1 UNION SELECT user,pass FROM users")[0] == "sqli"

    def test_or_1_eq_1_is_sqli(self):
        assert classify("SELECT * FROM t WHERE id=1 OR 1=1")[0] == "sqli"

    def test_trailing_dash_space_is_sqli(self):
        assert classify("admin'-- ")[0] == "sqli"

    def test_block_comment_is_sqli(self):
        assert classify("/* ping */")[0] == "sqli"

    def test_sleep_is_sqli(self):
        assert classify("SELECT sleep(5)")[0] == "sqli"

    def test_benchmark_is_sqli(self):
        assert classify("SELECT benchmark(1000000,sha1(1))")[0] == "sqli"

    def test_lone_quote_is_NOT_sqli(self):
        """Item 5: a lone ' must not be tagged sqli."""
        tag, _ = classify("'")
        assert tag != "sqli"

    def test_lone_dash_dash_is_NOT_sqli(self):
        """Item 5: bare -- must not be tagged sqli."""
        tag, _ = classify("--")
        assert tag != "sqli"

    # --- file_access ---
    def test_into_outfile_is_file_access(self):
        assert classify("SELECT * INTO OUTFILE '/tmp/x'")[0] == "file_access"

    def test_load_file_is_file_access(self):
        assert classify("SELECT LOAD_FILE('/etc/passwd')")[0] == "file_access"

    def test_into_dumpfile_is_file_access(self):
        assert classify("SELECT 1 INTO DUMPFILE '/tmp/y'")[0] == "file_access"

    # --- priv_esc ---
    def test_grant_is_priv_esc(self):
        assert classify("GRANT ALL ON *.* TO 'x'@'%'")[0] == "priv_esc"

    def test_create_user_is_priv_esc(self):
        assert classify("CREATE USER 'evil'@'%' IDENTIFIED BY 'pw'")[0] == "priv_esc"

    # --- destructive ---
    def test_drop_table_is_destructive(self):
        assert classify("DROP TABLE personnel")[0] == "destructive"

    def test_truncate_is_destructive(self):
        assert classify("TRUNCATE TABLE access_log")[0] == "destructive"

    def test_delete_from_is_destructive(self):
        # "1=1" in the WHERE makes this sqli; use a plain delete without 1=1
        assert classify("DELETE FROM personnel WHERE id=5")[0] == "destructive"

    def test_drop_user_is_priv_esc_not_destructive(self):
        assert classify("DROP USER 'x'@'%'")[0] == "priv_esc"

    # --- recon ---
    def test_information_schema_is_recon(self):
        assert classify("SELECT * FROM information_schema.tables")[0] == "recon"

    def test_show_databases_is_recon(self):
        assert classify("SHOW DATABASES")[0] == "recon"

    def test_show_tables_is_recon(self):
        assert classify("SHOW TABLES")[0] == "recon"

    def test_select_version_is_recon(self):
        assert classify("SELECT VERSION()")[0] == "recon"

    def test_select_user_is_recon(self):
        assert classify("SELECT USER()")[0] == "recon"

    def test_select_1_is_recon(self):
        assert classify("SELECT 1")[0] == "recon"

    def test_mysql_user_is_recon(self):
        assert classify("SELECT * FROM mysql.user")[0] == "recon"

    # --- normal ---
    def test_select_personnel_is_normal(self):
        assert classify("SELECT * FROM personnel")[0] == "normal"

    def test_show_grants_is_recon(self):
        # SHOW GRANTS matches recon pattern
        tag, _ = classify("SHOW GRANTS")
        assert tag == "recon"

    # --- case-insensitive ---
    def test_case_insensitive(self):
        assert classify("union select 1,2")[0] == "sqli"
        assert classify("UNION SELECT 1,2")[0] == "sqli"
        assert classify("Union Select 1,2")[0] == "sqli"

    # --- severity ---
    def test_sqli_severity_high(self):
        _, sev = classify("1 UNION SELECT 1,2")
        assert sev == "high"

    def test_recon_severity_medium(self):
        _, sev = classify("SHOW DATABASES")
        assert sev == "medium"

    def test_normal_severity_medium(self):
        _, sev = classify("SELECT * FROM personnel")
        assert sev == "medium"


class TestSanitizeQueryText:
    def test_truncates_at_1024(self):
        long_q = "x" * 2000
        text, trunc = sanitize_query_text(long_q)
        assert len(text) == 1024
        assert trunc is True

    def test_short_query_not_truncated(self):
        _, trunc = sanitize_query_text("SELECT 1")
        assert trunc is False

    def test_strips_nul_bytes(self):
        text, _ = sanitize_query_text("SELECT\x00*\x00FROM\x00t")
        assert "\x00" not in text
        assert text == "SELECT*FROMt"

    def test_strips_other_control_chars(self):
        text, _ = sanitize_query_text("SEL\x01ECT\x1fVAL")
        assert "\x01" not in text
        assert "\x1f" not in text

    def test_redacts_identified_by(self):
        q = "CREATE USER 'x'@'%' IDENTIFIED BY 'mypassword'"
        text, _ = sanitize_query_text(q)
        assert "mypassword" not in text
        assert "IDENTIFIED BY '[REDACTED]'" in text

    def test_redacts_password_function(self):
        q = "SET PASSWORD FOR 'u'@'h' = PASSWORD('secret')"
        text, _ = sanitize_query_text(q)
        assert "secret" not in text
        assert "[REDACTED]" in text

    def test_redacts_set_password(self):
        q = "SET PASSWORD = 'newpass'"
        text, _ = sanitize_query_text(q)
        assert "newpass" not in text

    def test_allows_tab_and_newline(self):
        """Tab (\t) and newline (\n) should NOT be stripped."""
        text, _ = sanitize_query_text("SELECT\t1\nFROM t")
        assert "\t" in text
        assert "\n" in text
