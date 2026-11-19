CREATE TABLE IF NOT EXISTS invoices (id text PRIMARY KEY, brand_id text NOT NULL, number text NOT NULL UNIQUE, due_date text NOT NULL, payload text NOT NULL, updated text NOT NULL);
