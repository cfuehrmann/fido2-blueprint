import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"
import path from "path"
import fs from "fs"

const databasePath = process.env.DATABASE_PATH || "./data/app.db"

// Ensure the directory exists
const dir = path.dirname(databasePath)
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

const sqlite = new Database(databasePath)

// Enable foreign keys
sqlite.pragma("foreign_keys = ON")

export const db = drizzle(sqlite, { schema })

export { schema }
