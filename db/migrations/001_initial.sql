SELECT pg_temp.require_core(true) AS existing_core \gset
\if :existing_core
  \echo 'Validated existing baseline'
\else
  CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION finance_migrator;
  CREATE SCHEMA IF NOT EXISTS categories AUTHORIZATION finance_migrator;
  CREATE SCHEMA IF NOT EXISTS transactions AUTHORIZATION finance_migrator;

  CREATE TYPE categories."enum_Categories_type" AS ENUM ('income', 'expense');
  CREATE TYPE transactions."enum_Transactions_type" AS ENUM ('income', 'expense');

  CREATE TABLE auth."Users" (
    id uuid PRIMARY KEY,
    username varchar(255) NOT NULL UNIQUE,
    password varchar(255) NOT NULL,
    "createdAt" timestamptz NOT NULL,
    "updatedAt" timestamptz NOT NULL
  );
  CREATE TABLE categories."Categories" (
    id uuid PRIMARY KEY,
    "userId" uuid NOT NULL,
    name varchar(255) NOT NULL,
    type categories."enum_Categories_type" NOT NULL,
    color varchar(255),
    icon varchar(255),
    "createdAt" timestamptz NOT NULL,
    "updatedAt" timestamptz NOT NULL
  );
  CREATE TABLE transactions."Transactions" (
    id uuid PRIMARY KEY,
    "userId" uuid NOT NULL,
    type transactions."enum_Transactions_type" NOT NULL,
    amount numeric(10,2) NOT NULL,
    "categoryId" uuid NOT NULL,
    description varchar(255) NOT NULL,
    date date NOT NULL,
    "createdAt" timestamptz NOT NULL,
    "updatedAt" timestamptz NOT NULL
  );
\endif
SELECT pg_temp.require_core(false);
