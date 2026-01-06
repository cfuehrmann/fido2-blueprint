import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const credentials = sqliteTable("credentials", {
  // Base64URL-encoded credential ID from the authenticator
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // The public key in COSE format
  publicKey: blob("public_key", { mode: "buffer" }).notNull(),
  // Counter for replay attack prevention
  counter: integer("counter").notNull(),
  // 'singleDevice' or 'multiDevice'
  deviceType: text("device_type").notNull(),
  // Whether the credential is backed up (synced across devices)
  backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
  // JSON array of transports: ['internal', 'usb', 'ble', 'nfc', 'hybrid']
  transports: text("transports"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

// For tracking TS data migration scripts
export const dataMigrations = sqliteTable("data_migrations", {
  name: text("name").primaryKey(),
  executedAt: integer("executed_at", { mode: "timestamp" }).notNull(),
});

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
