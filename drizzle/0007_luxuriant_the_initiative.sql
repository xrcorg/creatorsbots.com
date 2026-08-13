CREATE TABLE `age_verification_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`telegram_user_id` text,
	`confirmed_by` text NOT NULL,
	`source` text DEFAULT 'creator_override' NOT NULL,
	`confirmed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_age_verification_audit_chat_id` ON `age_verification_audit` (`chat_id`,`confirmed_at`);--> statement-breakpoint
