CREATE TABLE `paid_media_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_key` text NOT NULL,
	`product_id` integer NOT NULL,
	`chat_id` text NOT NULL,
	`business_connection_id` text,
	`telegram_name` text DEFAULT 'Telegram fan' NOT NULL,
	`stars` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paid_media_sales_purchase_key_unique` ON `paid_media_sales` (`purchase_key`);--> statement-breakpoint
CREATE INDEX `idx_paid_media_sales_product_created` ON `paid_media_sales` (`product_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `content_products` ADD `stars_price` integer DEFAULT 0 NOT NULL;