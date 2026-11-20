-- Reusable checks for adopting a database created by Sequelize.
CREATE FUNCTION pg_temp.require_table(
  schema_name text, table_name text, expected jsonb, primary_column text, unique_column text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  qualified text := format('%I.%I', schema_name, table_name);
  rel oid := to_regclass(qualified);
  column_spec record;
  actual text;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_class WHERE oid = rel AND relkind = 'r') THEN
    RAISE EXCEPTION 'Schema mismatch: expected table %', qualified;
  END IF;

  FOR column_spec IN SELECT key AS name, value AS definition FROM jsonb_each_text(expected) LOOP
    SELECT format_type(atttypid, atttypmod) || CASE WHEN attnotnull THEN ' NOT NULL' ELSE '' END
      INTO actual FROM pg_attribute
      WHERE attrelid = rel AND attname = column_spec.name AND attnum > 0 AND NOT attisdropped;
    IF actual IS DISTINCT FROM column_spec.definition THEN
      RAISE EXCEPTION 'Schema mismatch: %.% expected %, found %',
        qualified, column_spec.name, column_spec.definition, coalesce(actual, '<missing>');
    END IF;
  END LOOP;

  SELECT string_agg(attname, ', ' ORDER BY attname) INTO actual FROM pg_attribute
    WHERE attrelid = rel AND attnum > 0 AND NOT attisdropped AND NOT (expected ? attname::text);
  IF actual IS NOT NULL THEN
    RAISE EXCEPTION 'Schema mismatch: % has unexpected columns %', qualified, actual;
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = rel AND a.attname = primary_column
    WHERE c.conrelid = rel AND c.contype = 'p' AND c.conkey = ARRAY[a.attnum] AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'Schema mismatch: % needs a primary key on %', qualified, primary_column;
  END IF;

  IF unique_column IS NOT NULL AND NOT EXISTS (
    SELECT FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = rel AND a.attname = unique_column
    WHERE c.conrelid = rel AND c.contype = 'u' AND c.conkey = ARRAY[a.attnum] AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'Schema mismatch: % needs a unique constraint on %', qualified, unique_column;
  END IF;

  SELECT string_agg(c.conname, ', ' ORDER BY c.conname) INTO actual
    FROM pg_constraint c
    WHERE c.conrelid = rel AND NOT (
      c.contype = 'p' OR (
        c.contype = 'u' AND EXISTS (SELECT FROM pg_attribute a
          WHERE a.attrelid = rel AND a.attname = unique_column AND c.conkey = ARRAY[a.attnum])
      )
    );
  IF actual IS NOT NULL THEN
    RAISE EXCEPTION 'Schema mismatch: % has unexpected constraints %', qualified, actual;
  END IF;
END
$$;

CREATE FUNCTION pg_temp.require_core(allow_empty boolean) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  common jsonb := '{"id":"uuid NOT NULL","createdAt":"timestamp with time zone NOT NULL","updatedAt":"timestamp with time zone NOT NULL"}';
  category_columns jsonb := common || '{"userId":"uuid NOT NULL","name":"character varying(255) NOT NULL","type":"categories.\"enum_Categories_type\" NOT NULL","color":"character varying(255)","icon":"character varying(255)"}';
  enum_name text;
BEGIN
  IF allow_empty AND NOT EXISTS (
    SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('auth', 'categories', 'transactions') AND c.relkind IN ('r', 'p', 'f', 'v', 'm', 'S')
  ) AND NOT EXISTS (
    SELECT FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname IN ('auth', 'categories', 'transactions') AND t.typtype = 'e'
  ) THEN
    RETURN false;
  END IF;

  FOREACH enum_name IN ARRAY ARRAY['categories."enum_Categories_type"', 'transactions."enum_Transactions_type"'] LOOP
    IF ARRAY(SELECT enumlabel::text FROM pg_enum WHERE enumtypid = to_regtype(enum_name) ORDER BY enumsortorder)
      IS DISTINCT FROM ARRAY['income', 'expense'] THEN
      RAISE EXCEPTION 'Schema mismatch: % must contain income and expense in that order', enum_name;
    END IF;
  END LOOP;

  IF EXISTS (SELECT FROM pg_attribute WHERE attrelid = to_regclass('categories."Categories"')
    AND attname = 'archivedAt' AND attnum > 0 AND NOT attisdropped) THEN
    category_columns := category_columns || '{"archivedAt":"timestamp with time zone"}';
  END IF;

  PERFORM pg_temp.require_table('auth', 'Users', common ||
    '{"username":"character varying(255) NOT NULL","password":"character varying(255) NOT NULL"}', 'id', 'username');
  PERFORM pg_temp.require_table('categories', 'Categories', category_columns, 'id');
  PERFORM pg_temp.require_table('transactions', 'Transactions', common ||
    '{"userId":"uuid NOT NULL","type":"transactions.\"enum_Transactions_type\" NOT NULL","amount":"numeric(10,2) NOT NULL","categoryId":"uuid NOT NULL","description":"character varying(255) NOT NULL","date":"date NOT NULL"}', 'id');
  RETURN true;
END
$$;

CREATE FUNCTION pg_temp.require_features(require_seed_tables boolean, require_archive boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF require_seed_tables OR to_regclass('auth."PendingCategorySeeds"') IS NOT NULL THEN
    PERFORM pg_temp.require_table('auth', 'PendingCategorySeeds', '{"userId":"uuid NOT NULL"}', 'userId');
  END IF;
  IF require_seed_tables OR to_regclass('categories."CategorySeeds"') IS NOT NULL THEN
    PERFORM pg_temp.require_table('categories', 'CategorySeeds', '{"userId":"uuid NOT NULL"}', 'userId');
  END IF;
  IF require_archive AND NOT EXISTS (SELECT FROM pg_attribute
    WHERE attrelid = to_regclass('categories."Categories"')
      AND attname = 'archivedAt' AND attnum > 0 AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Schema mismatch: categories."Categories"."archivedAt" is missing';
  END IF;
END
$$;
