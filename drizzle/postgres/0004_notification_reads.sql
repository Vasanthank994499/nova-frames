CREATE TABLE IF NOT EXISTS notification_reads (
 id text PRIMARY KEY,
 account_id text NOT NULL,
 item_id text NOT NULL,
 read_at bigint NOT NULL
);
