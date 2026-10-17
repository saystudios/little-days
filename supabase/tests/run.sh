#!/usr/bin/env bash
# Builds a throwaway database: Supabase stand-in -> original schema -> legacy
# data -> migrations (twice, to prove they can be re-run) -> security tests.
# Uses the standard PG* environment variables for the connection.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="little_days_test_$$"
psql -v ON_ERROR_STOP=1 -q -d "${PGDATABASE:-postgres}" -c "create database $DB"
trap 'psql -q -d "${PGDATABASE:-postgres}" -c "drop database if exists $DB" >/dev/null' EXIT
run() { PGOPTIONS="-c client_min_messages=warning" psql -v ON_ERROR_STOP=1 -q -X -d "$DB" -f "$1"; }
run tests/stub_supabase.sql
run schema.sql
run tests/legacy_data.sql >/dev/null
for m in migrations/*.sql; do run "$m"; done
for m in migrations/*.sql; do run "$m"; done
PGOPTIONS="-c client_min_messages=notice" psql -v ON_ERROR_STOP=1 -q -X -d "$DB" -f tests/security_test.sql
