CREATE TABLE `sexting_scripts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stage` text NOT NULL,
	`title` text NOT NULL,
	`script_text` text NOT NULL,
	`media_label` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sexting_scripts_active_stage` ON `sexting_scripts` (`active`,`stage`);