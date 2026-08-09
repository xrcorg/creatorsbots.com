import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contentProducts = sqliteTable("content_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentType: text("content_type").notNull(),
  title: text("title").notNull().unique(),
  priceCents: integer("price_cents").notNull(),
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
