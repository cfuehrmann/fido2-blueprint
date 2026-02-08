import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema";
import { type WebAuthnConfig } from "./fido2";
import {
  registerStart,
  registerFinish,
  loginStart,
  loginFinish,
  getUser,
  updateDisplayName,
  getCredentials,
  addPasskeyStart,
  addPasskeyFinish,
  removeCredential,
  renameCredential,
} from "./services";

export interface CreateAuthOptions {
  databasePath: string;
  webauthn: WebAuthnConfig;
}

export function createAuth({ databasePath, webauthn }: CreateAuthOptions) {
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  return {
    // Registration
    registerStart: (username: string) => registerStart(db, webauthn, username),
    registerFinish: (
      userId: string,
      username: string,
      challenge: string,
      credential: unknown
    ) => registerFinish(db, webauthn, userId, username, challenge, credential),

    // Authentication
    loginStart: () => loginStart(webauthn),
    loginFinish: (challenge: string, credential: unknown) =>
      loginFinish(db, webauthn, challenge, credential),

    // User profile
    getUser: (userId: string) => getUser(db, userId),
    updateDisplayName: (userId: string, displayName: string) =>
      updateDisplayName(db, userId, displayName),

    // Credential management
    getCredentials: (userId: string) => getCredentials(db, userId),
    addPasskeyStart: (userId: string, username: string) =>
      addPasskeyStart(db, webauthn, userId, username),
    addPasskeyFinish: (
      userId: string,
      challenge: string,
      credential: unknown
    ) => addPasskeyFinish(db, webauthn, userId, challenge, credential),
    removeCredential: (userId: string, credentialId: string) =>
      removeCredential(db, userId, credentialId),
    renameCredential: (userId: string, credentialId: string, newName: string) =>
      renameCredential(db, userId, credentialId, newName),
  };
}

export type Auth = ReturnType<typeof createAuth>;
