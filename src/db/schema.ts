import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(0),
  min_quantity: integer('min_quantity').notNull().default(0),
  location_id: text('location_id').references(() => locations.id),
  category_id: text('category_id').references(() => categories.id),
  memo: text('memo'),
  updated_at: text('updated_at').notNull(),
  alarm_at: text('alarm_at'),
  alarm_message: text('alarm_message'),
  notification_id: text('notification_id'),
  image_uri: text('image_uri'),
  barcode: text('barcode'),
});

export const logs = sqliteTable('logs', {
  id: text('id').primaryKey(),
  item_id: text('item_id').references(() => items.id),
  log_type: text('log_type').notNull(),
  message: text('message').notNull(),
  created_at: text('created_at').notNull(),
});
