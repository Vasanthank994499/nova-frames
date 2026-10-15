CREATE TABLE IF NOT EXISTS expenses(id text PRIMARY KEY,worker_id text NOT NULL,manager_id text NOT NULL,day text NOT NULL,amount_cents bigint NOT NULL,payload text NOT NULL,updated text NOT NULL);
