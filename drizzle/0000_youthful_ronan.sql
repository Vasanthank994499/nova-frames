CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`assignee` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`specialty` text NOT NULL,
	`permissions` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workers_email_unique` ON `workers` (`email`);