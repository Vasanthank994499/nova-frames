CREATE TABLE `extra_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);
