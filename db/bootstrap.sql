\set ON_ERROR_STOP on
\set VERBOSITY terse
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '60s';
SET LOCAL statement_timeout = '5min';
SET LOCAL password_encryption = 'scram-sha-256';
SELECT pg_advisory_xact_lock(691203854771); -- Also used by migrate.sql.

\ir schema-checks.sql
SELECT pg_temp.require_core(true);
SELECT pg_temp.require_features(false, false);

-- The optional password inputs are for local Compose. On Azure set passwords
-- with psql \password after this script, from an authorized administrative host.
\set migrator_password ''
\set auth_password ''
\set categories_password ''
\set transactions_password ''
\getenv migrator_password POSTGRES_MIGRATOR_PASSWORD
\getenv auth_password POSTGRES_AUTH_PASSWORD
\getenv categories_password POSTGRES_CATEGORIES_PASSWORD
\getenv transactions_password POSTGRES_TRANSACTIONS_PASSWORD
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', inputs.role, NULLIF(inputs.password, ''))
FROM (VALUES
  ('finance_migrator', :'migrator_password'),
  ('finance_auth', :'auth_password'),
  ('finance_categories', :'categories_password'),
  ('finance_transactions', :'transactions_password')
) AS inputs(role, password)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = inputs.role)
\gexec

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_roles r
    WHERE rolname IN ('finance_migrator', 'finance_auth', 'finance_categories', 'finance_transactions')
      AND (NOT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
        OR EXISTS (SELECT FROM pg_auth_members WHERE member = r.oid))
  ) THEN
    RAISE EXCEPTION 'Bootstrap roles have unexpected attributes or memberships';
  END IF;
END
$$;

-- Keep the old administrator's effective ownership during the transition.
GRANT finance_migrator TO CURRENT_USER WITH INHERIT TRUE, SET TRUE;
SELECT format('REVOKE CREATE, TEMP ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT, CREATE, TEMP ON DATABASE %I TO finance_migrator', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO finance_auth, finance_categories, finance_transactions', current_database()) \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Adopt only the validated application objects, leaving unrelated objects alone.
SELECT format('ALTER SCHEMA %I OWNER TO finance_migrator', nspname)
FROM pg_namespace
WHERE nspname IN ('auth', 'categories', 'transactions') AND nspowner <> 'finance_migrator'::regrole
\gexec
SELECT format('ALTER TYPE %I.%I OWNER TO finance_migrator', n.nspname, t.typname)
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE (n.nspname, t.typname) IN (('categories', 'enum_Categories_type'), ('transactions', 'enum_Transactions_type'))
  AND t.typowner <> 'finance_migrator'::regrole
\gexec
SELECT format('ALTER TABLE %I.%I OWNER TO finance_migrator', n.nspname, c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname, c.relname) IN (
  ('auth', 'Users'), ('auth', 'PendingCategorySeeds'), ('categories', 'Categories'),
  ('categories', 'CategorySeeds'), ('transactions', 'Transactions')
) AND c.relowner <> 'finance_migrator'::regrole
\gexec
COMMIT;
\echo 'Database roles and ownership are ready'
