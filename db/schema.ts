import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const contentProducts = sqliteTable("content_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentType: text("content_type").notNull(),
  title: text("title").notNull().unique(),
  priceCents: integer("price_cents").notNull(),
  starsPrice: integer("stars_price").notNull().default(0),
  genre: text("genre").notNull().default(""),
  actors: text("actors").notNull().default(""),
  trailerUrl: text("trailer_url").notNull().default(""),
  deliveryUrl: text("delivery_url").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_content_products_active_created").on(table.active, table.createdAt),
]);

export const paidMediaSales = sqliteTable("paid_media_sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseKey: text("purchase_key").notNull().unique(),
  productId: integer("product_id").notNull(),
  chatId: text("chat_id").notNull(),
  businessConnectionId: text("business_connection_id"),
  telegramName: text("telegram_name").notNull().default("Telegram fan"),
  stars: integer("stars").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_paid_media_sales_product_created").on(table.productId, table.createdAt),
]);

export const productInterest = sqliteTable("product_interest", {
  chatId: text("chat_id").primaryKey(),
  productId: integer("product_id").notNull(),
  businessConnectionId: text("business_connection_id"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sextingScripts = sqliteTable("sexting_scripts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stage: text("stage").notNull(),
  title: text("title").notNull(),
  scriptText: text("script_text").notNull(),
  mediaLabel: text("media_label").notNull().default(""),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_sexting_scripts_active_stage").on(table.active, table.stage),
]);

export const dailyTasks = sqliteTable("daily_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  taskType: text("task_type").notNull().default("other"),
  scheduledAt: text("scheduled_at").notNull(),
  fanName: text("fan_name").notNull().default(""),
  details: text("details").notNull().default(""),
  amountCents: integer("amount_cents").notNull().default(0),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, (table) => [
  index("idx_daily_tasks_scheduled_status").on(table.scheduledAt, table.status),
]);

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull(),
  message: text("message").notNull().default(""),
  streamUrl: text("stream_url").notNull(),
  status: text("status").notNull().default("sending"),
  recipientCount: integer("recipient_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  sentAt: text("sent_at"),
}, (table) => [
  index("idx_announcements_created").on(table.createdAt),
]);

export const creatorSocialLinks = sqliteTable("creator_social_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const conversationTraining = sqliteTable("conversation_training", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  suggestion: text("suggestion").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_conversation_training_category_suggestion").on(table.category, table.suggestion),
]);

export const testChatFeedback = sqliteTable("test_chat_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userMessage: text("user_message").notNull(),
  assistantMessage: text("assistant_message").notNull().default(""),
  correction: text("correction").notNull().default(""),
  action: text("action").notNull().default("flag"),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_test_chat_feedback_created").on(table.createdAt),
]);
