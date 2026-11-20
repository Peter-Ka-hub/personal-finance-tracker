REVOKE ALL ON SCHEMA auth, categories, transactions, finance_migrations FROM PUBLIC;
REVOKE ALL ON TABLE auth."Users", auth."PendingCategorySeeds", categories."Categories",
  categories."CategorySeeds", transactions."Transactions", finance_migrations.schema_migrations FROM PUBLIC;

GRANT USAGE ON SCHEMA auth TO finance_auth;
GRANT SELECT, INSERT ON auth."Users" TO finance_auth;
GRANT SELECT, INSERT, DELETE ON auth."PendingCategorySeeds" TO finance_auth;

GRANT USAGE ON SCHEMA categories TO finance_categories, finance_transactions;
GRANT SELECT, INSERT ON categories."Categories", categories."CategorySeeds" TO finance_categories;
GRANT UPDATE ("archivedAt", "updatedAt") ON categories."Categories" TO finance_categories;
GRANT SELECT (id, "userId", type, "archivedAt") ON categories."Categories" TO finance_transactions;
-- PostgreSQL requires UPDATE on at least one column for SELECT FOR SHARE.
GRANT UPDATE ("updatedAt") ON categories."Categories" TO finance_transactions;

GRANT USAGE ON SCHEMA transactions TO finance_transactions;
GRANT SELECT, INSERT, DELETE ON transactions."Transactions" TO finance_transactions;
