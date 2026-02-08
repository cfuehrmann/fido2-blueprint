import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";

const databasePath = process.env.DATABASE_PATH;
if (!databasePath || databasePath.trim() === "") {
  throw new Error(
    "DATABASE_PATH environment variable is required.\n" +
      "Set it in .env.local or pass it directly."
  );
}

// Validate the directory exists and is writable
const dir = path.dirname(databasePath);
if (!fs.existsSync(dir)) {
  throw new Error(
    `DATABASE_PATH directory does not exist: ${dir}\n` +
      "Create the directory or update DATABASE_PATH."
  );
}

try {
  fs.accessSync(dir, fs.constants.W_OK);
} catch {
  throw new Error(
    `DATABASE_PATH directory is not writable: ${dir}\n` +
      "Check permissions or update DATABASE_PATH."
  );
}

const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

// Resolve migrations folder relative to this file's location
const migrationsFolder = path.resolve(import.meta.dirname, "../../drizzle");

console.log("Running migrations...");
migrate(db, { migrationsFolder });
console.log("Migrations complete!");

sqlite.close();
