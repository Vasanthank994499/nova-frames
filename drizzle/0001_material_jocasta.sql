CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `workers` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `workers` ADD `role` text DEFAULT 'editor' NOT NULL;