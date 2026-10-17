#!/usr/bin/env bash
# For each tests/*_test.sql: builds a throwaway database (Supabase stand-in ->
# original schema -> legacy data -> migrations, applied twice to prove they can
# be re-run), then runs that test file. Uses the standard PG* variables.
set -euo pipefail
cd "$(dirname "$0")/.."
ADMIN_DB="${PGDATABASE:-postgres}"
run() { PGOPTIONS="-c client_min_messages=warning" psql -v ON_ERROR_STOP=1 -q -X -d "$DB" -f "$1"; }
for t in tests/*_test.sql; do
  DB="little_days_test_$$_$(basename "$t" .sql)"
  psql -v ON_ERROR_STOP=1 -q -d "$ADMIN_DB" -c "create database $DB"
  trap 'psql -q -d "$ADMIN_DB" -c "drop database if exists $DB" >/dev/null 2>&1' EXIT
  run tests/stub_supabase.sql
  run schema.sql
  run tests/legacy_data.sql >/dev/null
  for m in migrations/*.sql; do run "$m"; done
  for m in migrations/*.sql; do run "$m"; done
  echo "== $t"
  PGOPTIONS="-c client_min_messages=notice" psql -v ON_ERROR_STOP=1 -q -X -d "$DB" -f "$t"
  psql -q -d "$ADMIN_DB" -c "drop database if exists $DB" >/dev/null
done
echo ALL DATABASE TESTS PASSED
