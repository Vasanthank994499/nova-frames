CREATE TABLE IF NOT EXISTS client_accounts (id text PRIMARY KEY, brand_id text NOT NULL, name text NOT NULL, email text NOT NULL UNIQUE, password_hash text NOT NULL, active integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS instagram_metrics (id text PRIMARY KEY, brand_id text NOT NULL, month text NOT NULL, job_id text NOT NULL DEFAULT '', payload text NOT NULL, updated text NOT NULL);
