import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as schema from "./db/schema";
import {
  createRegistrationOptions as fido2CreateRegistrationOptions,
  verifyAndStoreRegistration as fido2VerifyAndStoreRegistration,
  createAuthenticationOptions as fido2CreateAuthenticationOptions,
  verifyAuthentication as fido2VerifyAuthentication,
  getUserCredentials as fido2GetUserCredentials,
  renameCredential as fido2RenameCredential,
  deleteCredential as fido2DeleteCredential,
  type WebAuthnConfig,
} from "./fido2";
import { AuthError } from "./errors";

type AuthDatabase = BetterSQLite3Database<typeof schema>;

// ── Registration ──

export async function registerStart(
  db: AuthDatabase,
  config: WebAuthnConfig,
  username: string
) {
  // Check if username is taken
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();

  if (existing) {
    throw new AuthError("USERNAME_TAKEN", "Username is already taken");
  }

  const userId = randomUUID();
  const options = await fido2CreateRegistrationOptions(
    db,
    config,
    userId,
    username
  );

  return { options, userId, username };
}

export async function registerFinish(
  db: AuthDatabase,
  config: WebAuthnConfig,
  userId: string,
  username: string,
  challenge: string,
  credential: unknown
) {
  // Check again that username isn't taken (race condition protection)
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();

  if (existing) {
    throw new AuthError("USERNAME_TAKEN", "Username is already taken");
  }

  // Create the user FIRST (before storing credential due to FK constraint)
  await db.insert(schema.users).values({
    id: userId,
    username,
    displayName: username,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Verify the registration and store credential
  try {
    await fido2VerifyAndStoreRegistration(
      db,
      config,
      userId,
      challenge,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      credential as any
    );
  } catch (error) {
    // Rollback: delete the user if credential storage fails
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    throw new AuthError(
      "REGISTRATION_FAILED",
      error instanceof Error
        ? error.message
        : "Registration verification failed"
    );
  }

  return { userId, username };
}

// ── Authentication ──

export async function loginStart(config: WebAuthnConfig) {
  const options = await fido2CreateAuthenticationOptions(config);
  return { options };
}

export async function loginFinish(
  db: AuthDatabase,
  config: WebAuthnConfig,
  challenge: string,
  credential: unknown
) {
  try {
    const result = await fido2VerifyAuthentication(
      db,
      config,
      challenge,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      credential as any
    );
    return { userId: result.userId, username: result.username };
  } catch (error) {
    throw new AuthError(
      "AUTHENTICATION_FAILED",
      error instanceof Error
        ? error.message
        : "Authentication verification failed"
    );
  }
}

// ── User Profile ──

export async function getUser(db: AuthDatabase, userId: string) {
  const user = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!user) {
    throw new AuthError("USER_NOT_FOUND", "User not found");
  }

  return user;
}

export async function updateDisplayName(
  db: AuthDatabase,
  userId: string,
  displayName: string
) {
  await db
    .update(schema.users)
    .set({
      displayName,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId));
}

// ── Credential Management ──

export async function getCredentials(db: AuthDatabase, userId: string) {
  return fido2GetUserCredentials(db, userId);
}

export async function addPasskeyStart(
  db: AuthDatabase,
  config: WebAuthnConfig,
  userId: string,
  username: string
) {
  const options = await fido2CreateRegistrationOptions(
    db,
    config,
    userId,
    username
  );
  return { options };
}

export async function addPasskeyFinish(
  db: AuthDatabase,
  config: WebAuthnConfig,
  userId: string,
  challenge: string,
  credential: unknown
) {
  try {
    await fido2VerifyAndStoreRegistration(
      db,
      config,
      userId,
      challenge,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      credential as any
    );
  } catch (error) {
    throw new AuthError(
      "REGISTRATION_FAILED",
      error instanceof Error ? error.message : "Failed to add passkey"
    );
  }
}

export async function removeCredential(
  db: AuthDatabase,
  userId: string,
  credentialId: string
) {
  try {
    await fido2DeleteCredential(db, userId, credentialId);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      "CREDENTIAL_NOT_FOUND",
      error instanceof Error ? error.message : "Failed to delete credential"
    );
  }
}

export async function renameCredential(
  db: AuthDatabase,
  userId: string,
  credentialId: string,
  newName: string
) {
  try {
    await fido2RenameCredential(db, userId, credentialId, newName);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      "CREDENTIAL_NOT_FOUND",
      error instanceof Error ? error.message : "Failed to rename credential"
    );
  }
}
