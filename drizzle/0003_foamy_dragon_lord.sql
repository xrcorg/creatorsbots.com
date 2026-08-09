CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`stream_url` text NOT NULL,
	`status` text DEFAULT 'sending' NOT NULL,
	`recipient_count` integer DEFAULT 0 NOT NULL,
	`delivered_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_announcements_created` ON `announcements` (`created_at`);