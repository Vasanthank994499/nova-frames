CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"day" text NOT NULL,
	"payload" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extra_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"payload" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"assignee" text DEFAULT '' NOT NULL,
	"payload" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"expires" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"expires" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_events" (
	"id" text PRIMARY KEY NOT NULL,
	"at" text NOT NULL,
	"actor_id" text NOT NULL,
	"job_id" text NOT NULL,
	"payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"specialty" text NOT NULL,
	"permissions" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"branch_id" text,
	"start_date" text,
	"removed" integer DEFAULT 0 NOT NULL,
	"end_date" text,
	"password_hash" text,
	"role" text DEFAULT 'editor' NOT NULL,
	CONSTRAINT "workers_email_unique" UNIQUE("email")
);
