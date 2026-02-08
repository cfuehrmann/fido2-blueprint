import { createAuth } from "@repo/fido2-auth/server";
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

export const auth = createAuth({
  databasePath,
  webauthn: {
    rpID: process.env.WEBAUTHN_RP_ID || "localhost",
    rpName: process.env.WEBAUTHN_RP_NAME || "FIDO2 Blueprint",
    origin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
  },
});
