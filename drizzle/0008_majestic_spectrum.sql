CREATE TABLE `creator_intake_submissions` (
	`creator_key` text PRIMARY KEY NOT NULL,
	`creator_email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`submitted_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_creator_intake_status_updated` ON `creator_intake_submissions` (`status`,`updated_at`);