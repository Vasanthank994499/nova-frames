CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`day` text NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_events` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`actor_id` text NOT NULL,
	`job_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `workers` ADD `branch_id` text;--> statement-breakpoint
ALTER TABLE `workers` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `workers` ADD `removed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `workers` ADD `end_date` text;