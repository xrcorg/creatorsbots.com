CREATE TABLE `content_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_type` text NOT NULL,
	`title` text NOT NULL,
	`price_cents` integer NOT NULL,
	`genre` text DEFAULT '' NOT NULL,
	`actors` text DEFAULT '' NOT NULL,
	`trailer_url` text DEFAULT '' NOT NULL,
	`delivery_url` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_products_title_unique` ON `content_products` (`title`);--> statement-breakpoint
CREATE INDEX `idx_content_products_active_created` ON `content_products` (`active`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_interest` (
	`chat_id` text PRIMARY KEY NOT NULL,
	`product_id` integer NOT NULL,
	`business_connection_id` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
