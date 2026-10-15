CREATE TABLE IF NOT EXISTS staff_requests (id text PRIMARY KEY, worker_id text NOT NULL, status text NOT NULL, payload text NOT NULL, updated text NOT NULL);
