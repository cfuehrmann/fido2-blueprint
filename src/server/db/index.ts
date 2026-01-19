import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Validate DATABASE_PATH is set
const databasePath = process.env.DATABASE_PATH;
if (!databasePath || databasePath.trim() === "") {
  throw new Error(
    "DATABASE_PATH environment variable is required.\n" +
      "Create a .env.local file - see .env.example for details."
  );
}

// Validate the directory exists and is writable
const dir = path.dirname(databasePath);
if (!fs.existsSync(dir)) {
  throw new Error(
    `DATABASE_PATH directory does not exist: ${dir}\n` +
      "Create the directory or update DATABASE_PATH in .env.local"
  );
}

try {
  fs.accessSync(dir, fs.constants.W_OK);
} catch {
  throw new Error(
    `DATABASE_PATH directory is not writable: ${dir}\n` +
      "Check permissions or update DATABASE_PATH in .env.local"
  );
}

const sqlite = new Database(databasePath);

// Enable foreign keys
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export { schema };
