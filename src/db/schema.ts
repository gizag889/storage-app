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
  location_id: text('location_id').references(() => locations.id),
  category_id: text('category_id').references(() => categories.id),
  memo: text('memo'),
  updated_at: text('updated_at').notNull(),
});
