CREATE TABLE IF NOT EXISTS calendar_holidays (
  day text PRIMARY KEY,
  reason text NOT NULL,
  marked_by text NOT NULL,
  marked_at bigint NOT NULL
);
