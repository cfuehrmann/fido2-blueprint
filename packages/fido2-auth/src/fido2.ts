import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "./db/schema";

type AuthDatabase = BetterSQLite3Database<typeof schema>;

export interface WebAuthnConfig {
  rpID: string;
  rpName: string;
  origin: string;
}

// Generate registration options for a new user
export async function createRegistrationOptions(
  db: AuthDatabase,
  config: WebAuthnConfig,
  userId: string,
  username: string
) {
  // Get existing credentials for this user (for excludeCredentials)
  const existingCredentials = await db
    .select({
      id: schema.credentials.id,
      transports: schema.credentials.transports,
    })
    .from(schema.credentials)
    .where(eq(schema.credentials.userId, userId));

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userID: new TextEncoder().encode(userId),
    userName: username,
    userDisplayName: username,
    // Don't allow re-registering existing credentials
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.id,
      transports: cred.transports
        ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
        : undefined,
    })),
    authenticatorSelection: {
      // Don't restrict to platform authenticators to support security keys and testing
      // authenticatorAttachment: "platform",
      // Require user verification (biometric or PIN)
      userVerification: "required",
      // Require resident key for usernameless flows in the future
      residentKey: "required",
    },
    // We don't need attestation for this use case
    attestationType: "none",
  });

  return options;
}

// Generate a passkey name based on existing credential count
async function generatePasskeyName(
  db: AuthDatabase,
  userId: string
): Promise<string> {
  const existingCredentials = await db
    .select({ id: schema.credentials.id })
    .from(schema.credentials)
    .where(eq(schema.credentials.userId, userId));

  return `Passkey ${existingCredentials.length + 1}`;
}

// Verify registration response and store credential
export async function verifyAndStoreRegistration(
  db: AuthDatabase,
  config: WebAuthnConfig,
  userId: string,
  expectedChallenge: string,
  authenticatorResponse: RegistrationResponseJSON
): Promise<VerifiedRegistrationResponse> {
  const verification = await verifyRegistrationResponse({
    response: authenticatorResponse,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const { registrationInfo } = verification;

  // Generate a name for this passkey
  const name = await generatePasskeyName(db, userId);

  // Store the credential
  await db.insert(schema.credentials).values({
    id: registrationInfo.credential.id,
    userId,
    name,
    publicKey: Buffer.from(registrationInfo.credential.publicKey),
    counter: registrationInfo.credential.counter,
    deviceType: registrationInfo.credentialDeviceType,
    backedUp: registrationInfo.credentialBackedUp,
    transports: authenticatorResponse.response.transports
      ? JSON.stringify(authenticatorResponse.response.transports)
      : null,
    createdAt: new Date(),
    lastUsedAt: null,
  });

  return verification;
}

// Generate authentication options for usernameless flow
export async function createAuthenticationOptions(config: WebAuthnConfig) {
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    allowCredentials: [], // Empty = show all discoverable credentials for this rpId
    userVerification: "required",
  });

  return options;
}

// Verify authentication response and return user info (for usernameless flow)
export async function verifyAuthentication(
  db: AuthDatabase,
  config: WebAuthnConfig,
  expectedChallenge: string,
  authenticatorResponse: AuthenticationResponseJSON
): Promise<{ verified: boolean; userId: string; username: string }> {
  // Look up credential by ID
  const credential = await db
    .select()
    .from(schema.credentials)
    .where(eq(schema.credentials.id, authenticatorResponse.id))
    .get();

  if (!credential) {
    throw new Error("Credential not found");
  }

  // Look up user
  const user = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, credential.userId))
    .get();

  if (!user) {
    throw new Error("User not found");
  }

  const verification = await verifyAuthenticationResponse({
    response: authenticatorResponse,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    credential: {
      id: credential.id,
      publicKey: new Uint8Array(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports
        ? (JSON.parse(credential.transports) as AuthenticatorTransportFuture[])
        : undefined,
    },
  });

  if (!verification.verified) {
    throw new Error("Authentication verification failed");
  }

  // Update the counter and last used timestamp
  await db
    .update(schema.credentials)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(schema.credentials.id, authenticatorResponse.id));

  return { verified: true, userId: user.id, username: user.username };
}

// Get all credentials for a user (for the profile page)
export async function getUserCredentials(db: AuthDatabase, userId: string) {
  return db
    .select({
      id: schema.credentials.id,
      name: schema.credentials.name,
      deviceType: schema.credentials.deviceType,
      backedUp: schema.credentials.backedUp,
      transports: schema.credentials.transports,
      counter: schema.credentials.counter,
      createdAt: schema.credentials.createdAt,
      lastUsedAt: schema.credentials.lastUsedAt,
    })
    .from(schema.credentials)
    .where(eq(schema.credentials.userId, userId));
}

// Rename a credential
export async function renameCredential(
  db: AuthDatabase,
  userId: string,
  credentialId: string,
  newName: string
) {
  // Verify this credential belongs to the user
  const credential = await db
    .select({ id: schema.credentials.id, userId: schema.credentials.userId })
    .from(schema.credentials)
    .where(eq(schema.credentials.id, credentialId))
    .get();

  if (!credential || credential.userId !== userId) {
    throw new Error("Credential not found or does not belong to user");
  }

  await db
    .update(schema.credentials)
    .set({ name: newName })
    .where(eq(schema.credentials.id, credentialId));
}

// Delete a credential (user must have at least one remaining)
export async function deleteCredential(
  db: AuthDatabase,
  userId: string,
  credentialId: string
) {
  // Check how many credentials the user has
  const credentials = await db
    .select({ id: schema.credentials.id })
    .from(schema.credentials)
    .where(eq(schema.credentials.userId, userId));

  if (credentials.length <= 1) {
    throw new Error(
      "Cannot delete the only credential. Add another passkey first."
    );
  }

  // Verify this credential belongs to the user
  const credential = credentials.find((c) => c.id === credentialId);
  if (!credential) {
    throw new Error("Credential not found");
  }

  await db
    .delete(schema.credentials)
    .where(eq(schema.credentials.id, credentialId));
}
