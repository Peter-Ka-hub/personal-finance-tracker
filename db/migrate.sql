\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '60s';
SET LOCAL statement_timeout = '5min';
SELECT pg_advisory_xact_lock(691203854771); -- Also used by bootstrap.sql.

DO $$
BEGIN
  IF current_user <> 'finance_migrator' THEN
    RAISE EXCEPTION 'Run migrations as finance_migrator';
  END IF;
END
$$;
\ir schema-checks.sql

SELECT to_regclass('finance_migrations.schema_migrations') IS NULL AS new_ledger \gset
\if :new_ledger
  CREATE SCHEMA finance_migrations;
  CREATE TABLE finance_migrations.schema_migrations (
    version integer PRIMARY KEY,
    name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
\endif

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM finance_migrations.schema_migrations m
    WHERE (m.version, m.name) NOT IN (
      (1, 'initial'), (2, 'category_seeds'), (3, 'category_archive'), (4, 'runtime_permissions')
    ) OR (m.version > 1 AND NOT EXISTS (
      SELECT FROM finance_migrations.schema_migrations prev WHERE prev.version = m.version - 1
    ))
  ) THEN
    RAISE EXCEPTION 'Migration history mismatch: unexpected version, name or gap';
  END IF;
END
$$;

SELECT
  NOT EXISTS (SELECT FROM finance_migrations.schema_migrations WHERE version = 1) AS apply_001,
  NOT EXISTS (SELECT FROM finance_migrations.schema_migrations WHERE version = 2) AS apply_002,
  NOT EXISTS (SELECT FROM finance_migrations.schema_migrations WHERE version = 3) AS apply_003,
  NOT EXISTS (SELECT FROM finance_migrations.schema_migrations WHERE version = 4) AS apply_004
\gset

\if :apply_001
  \ir migrations/001_initial.sql
  INSERT INTO finance_migrations.schema_migrations (version, name) VALUES (1, 'initial');
\endif
\if :apply_002
  \ir migrations/002_category_seeds.sql
  INSERT INTO finance_migrations.schema_migrations (version, name) VALUES (2, 'category_seeds');
\endif
\if :apply_003
  \ir migrations/003_category_archive.sql
  INSERT INTO finance_migrations.schema_migrations (version, name) VALUES (3, 'category_archive');
\endif
\if :apply_004
  \ir migrations/004_runtime_permissions.sql
  INSERT INTO finance_migrations.schema_migrations (version, name) VALUES (4, 'runtime_permissions');
\endif

SELECT pg_temp.require_core(false);
SELECT pg_temp.require_features(true, true);
DO $$
DECLARE
  runtime text;
BEGIN
  FOREACH runtime IN ARRAY ARRAY['finance_auth', 'finance_categories', 'finance_transactions'] LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = runtime AND rolcanlogin
      AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
      OR EXISTS (SELECT FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member WHERE r.rolname = runtime)
    THEN
      RAISE EXCEPTION 'Runtime role % is missing or has unexpected role privileges', runtime;
    END IF;
    IF has_database_privilege(runtime, current_database(), 'CREATE, TEMP')
      OR EXISTS (SELECT FROM pg_namespace WHERE has_schema_privilege(runtime, oid, 'CREATE'))
      OR EXISTS (SELECT FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = runtime)
    THEN
      RAISE EXCEPTION 'Runtime role % has unexpected DDL privileges', runtime;
    END IF;
  END LOOP;
END
$$;
COMMIT;
\echo 'Database migrations complete'
