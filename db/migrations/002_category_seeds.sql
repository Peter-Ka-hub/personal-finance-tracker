CREATE TABLE IF NOT EXISTS auth."PendingCategorySeeds" ("userId" uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS categories."CategorySeeds" ("userId" uuid PRIMARY KEY);
SELECT pg_temp.require_features(true, false);
