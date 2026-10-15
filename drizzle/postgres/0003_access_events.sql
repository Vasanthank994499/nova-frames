CREATE TABLE IF NOT EXISTS access_events (
 id text PRIMARY KEY,
 worker_id text NOT NULL,
 day text NOT NULL,
 payload text NOT NULL
);
