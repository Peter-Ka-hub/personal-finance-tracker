#!/usr/bin/env bash
# Run against a disposable Compose stack. Creates and drops its own databases.
set -euo pipefail

compose_options=("$@")
compose() { docker compose "${compose_options[@]}" "$@"; }
admin() {
  compose exec -T postgres sh -ec 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$@"' sh "$@"
}
bootstrap() { compose run --rm -T --no-deps -e "PGDATABASE=$1" db-bootstrap; }
migrate() { compose run --rm -T --no-deps -e "PGDATABASE=$1" db-migrate; }
as_runtime() {
  compose run --rm -T --no-deps --entrypoint sh -e "PGDATABASE=$1" db-bootstrap -ec '
    case "$1" in
      finance_auth) PGPASSWORD=$POSTGRES_AUTH_PASSWORD ;;
      finance_categories) PGPASSWORD=$POSTGRES_CATEGORIES_PASSWORD ;;
      finance_transactions) PGPASSWORD=$POSTGRES_TRANSACTIONS_PASSWORD ;;
      *) exit 1 ;;
    esac
    export PGPASSWORD
    exec psql -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U "$1" -c "$2"
  ' sh "$2" "$3"
}
expect_denied() {
  local output
  if output=$(as_runtime "$@" 2>&1); then
    echo "Expected PostgreSQL to deny $2: $3" >&2
    exit 1
  fi
  grep -F '42501' <<<"$output"
}

suffix="$(date +%s)_$$"
fresh="finance_migration_fresh_$suffix"
legacy="finance_migration_legacy_$suffix"
drift="finance_migration_drift_$suffix"
logs=$(mktemp -d)
created_databases=()
cleanup() {
  local database
  for database in "${created_databases[@]}"; do
    admin -d postgres -c "DROP DATABASE \"$database\"" >/dev/null || true
  done
  rm -rf "$logs"
}
trap cleanup EXIT

for database in "$fresh" "$legacy" "$drift"; do
  admin -d postgres -c "CREATE DATABASE \"$database\"" >/dev/null
  created_databases+=("$database")
done

bootstrap "$fresh"
migrate "$fresh" >"$logs/first" 2>&1 &
first=$!
migrate "$fresh" >"$logs/second" 2>&1 &
second=$!
failed=0
wait "$first" || failed=1
wait "$second" || failed=1
if (( failed )); then
  cat "$logs/first" "$logs/second"
  exit 1
fi
ledger() {
  admin -d "$1" -Atc "SELECT string_agg(version || ':' || applied_at, ',' ORDER BY version) FROM finance_migrations.schema_migrations"
}
before=$(ledger "$fresh")
migrate "$fresh"
[[ "$before" == "$(ledger "$fresh")" ]]
[[ "$(admin -d "$fresh" -Atc 'SELECT count(*) FROM finance_migrations.schema_migrations')" == 4 ]]

# Build the pre-migration layout without a ledger, as the previous admin.
compose run --rm -T --no-deps -e "PGDATABASE=$legacy" db-bootstrap -f - <<'SQL'
SET search_path = pg_catalog;
\i /db/schema-checks.sql
\i /db/migrations/001_initial.sql
ALTER SCHEMA auth OWNER TO CURRENT_USER;
ALTER SCHEMA categories OWNER TO CURRENT_USER;
ALTER SCHEMA transactions OWNER TO CURRENT_USER;
INSERT INTO auth."Users" VALUES ('10000000-0000-4000-8000-000000000001', 'legacy', 'fixture', now(), now());
INSERT INTO categories."Categories" VALUES (
  '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
  'Legacy label', 'expense', '#123456', NULL, now(), now()
);
INSERT INTO transactions."Transactions" VALUES
  ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
    'expense', 42.50, '10000000-0000-4000-8000-000000000002', 'Linked', '2026-11-20', now(), now()),
  ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
    'expense', 15.25, '10000000-0000-4000-8000-000000000005', 'Orphan', '2026-11-20', now(), now());
-- A previous Categories release may have created these before migration adoption.
CREATE TABLE categories."CategorySeeds" ("userId" uuid PRIMARY KEY);
INSERT INTO categories."CategorySeeds" VALUES ('10000000-0000-4000-8000-000000000001');
ALTER TABLE categories."Categories" ADD COLUMN "archivedAt" timestamptz;
UPDATE categories."Categories" SET "archivedAt" = '2026-11-20T10:00:00Z';
SQL
legacy_rows() {
  admin -d "$1" -Atc 'SELECT username FROM auth."Users";
    SELECT id, name, color, "archivedAt" FROM categories."Categories";
    SELECT "userId" FROM categories."CategorySeeds";
    SELECT id, "userId", "categoryId", amount FROM transactions."Transactions" ORDER BY id'
}
before=$(legacy_rows "$legacy")
bootstrap "$legacy"
migrate "$legacy"
[[ "$before" == "$(legacy_rows "$legacy")" ]]
[[ "$(admin -d "$legacy" -Atc "SELECT tableowner FROM pg_tables WHERE schemaname='auth' AND tablename='Users'")" == finance_migrator ]]

# Confirm a schema mismatch cannot produce a baseline ledger or transfer objects.
bootstrap "$drift"
compose run --rm -T --no-deps -e "PGDATABASE=$drift" db-migrate -f - <<'SQL'
SET search_path = pg_catalog;
\i /db/schema-checks.sql
\i /db/migrations/001_initial.sql
ALTER TABLE auth."Users" DROP CONSTRAINT "Users_username_key";
SQL
if bootstrap "$drift" >"$logs/drift" 2>&1; then
  echo "Expected bootstrap to reject the missing unique constraint" >&2
  exit 1
fi
grep -F 'needs a unique constraint on username' "$logs/drift"
if migrate "$drift" >"$logs/drift" 2>&1; then
  echo "Expected migration to reject the missing unique constraint" >&2
  exit 1
fi
grep -F 'needs a unique constraint on username' "$logs/drift"
[[ "$(admin -d "$drift" -Atc "SELECT to_regclass('finance_migrations.schema_migrations') IS NULL")" == t ]]

for role in finance_auth finance_categories finance_transactions; do
  expect_denied "$fresh" "$role" 'CREATE SCHEMA runtime_should_not_create'
  expect_denied "$fresh" "$role" 'CREATE TEMP TABLE runtime_should_not_create (id integer)'
done
expect_denied "$fresh" finance_auth 'ALTER TABLE auth."Users" ADD COLUMN denied integer'
expect_denied "$fresh" finance_categories 'ALTER TABLE categories."Categories" ADD COLUMN denied integer'
expect_denied "$fresh" finance_transactions 'ALTER TABLE transactions."Transactions" ADD COLUMN denied integer'
expect_denied "$fresh" finance_categories 'DELETE FROM categories."Categories"'
expect_denied "$fresh" finance_transactions 'UPDATE categories."Categories" SET "archivedAt" = NULL'
expect_denied "$fresh" finance_transactions 'SELECT password FROM auth."Users"'
echo "PostgreSQL migration and runtime role regression tests passed."
