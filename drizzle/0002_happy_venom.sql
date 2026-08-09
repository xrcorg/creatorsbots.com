CREATE TABLE `daily_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`task_type` text DEFAULT 'other' NOT NULL,
	`scheduled_at` text NOT NULL,
	`fan_name` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_daily_tasks_scheduled_status` ON `daily_tasks` (`scheduled_at`,`status`);