import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

// Session data structure
export interface SessionData {
  userId?: string;
  username?: string;
  createdAt?: number;
  // Temporary storage for WebAuthn challenges
  challenge?: string;
  challengeType?: "registration" | "authentication";
  // Pending user data during registration/login ceremony (before session is established)
  pendingUserId?: string;
  pendingUsername?: string;
}

// Session timeout configuration (with defaults)
const IDLE_TIMEOUT_MINUTES = parseInt(
  process.env.SESSION_IDLE_TIMEOUT_MINUTES || "30",
  10
);
const ABSOLUTE_TIMEOUT_HOURS = parseInt(
  process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS || "8",
  10
);

// Session configuration
const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "fido2-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict" as const,
    // Idle timeout (sliding expiration handled by iron-session)
    maxAge: IDLE_TIMEOUT_MINUTES * 60,
  },
};

// Absolute maximum session lifetime
const ABSOLUTE_MAX_AGE_MS = ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000;

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function createSession(
  userId: string,
  username: string
): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  session.username = username;
  session.createdAt = Date.now();
  // Clear any WebAuthn challenge data
  session.challenge = undefined;
  session.challengeType = undefined;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

export async function isSessionValid(): Promise<boolean> {
  const session = await getSession();

  if (!session.userId || !session.createdAt) {
    return false;
  }

  // Check absolute maximum age
  if (Date.now() - session.createdAt > ABSOLUTE_MAX_AGE_MS) {
    await destroySession();
    return false;
  }

  return true;
}

export async function getCurrentUser(): Promise<{
  userId: string;
  username: string;
} | null> {
  const valid = await isSessionValid();
  if (!valid) {
    return null;
  }

  const session = await getSession();
  return {
    userId: session.userId!,
    username: session.username!,
  };
}

// Store WebAuthn challenge in session along with pending user data (for registration)
export async function storeChallenge(
  challenge: string,
  type: "registration",
  userId: string,
  username: string
): Promise<void> {
  const session = await getSession();
  session.challenge = challenge;
  session.challengeType = type;
  session.pendingUserId = userId;
  session.pendingUsername = username;
  await session.save();
}

// Store WebAuthn challenge in session (for usernameless authentication)
export async function storeChallengeUsernameless(
  challenge: string
): Promise<void> {
  const session = await getSession();
  session.challenge = challenge;
  session.challengeType = "authentication";
  session.pendingUserId = undefined;
  session.pendingUsername = undefined;
  await session.save();
}

// Result type for getAndClearChallenge
export interface ChallengeData {
  challenge: string;
  userId: string;
  username: string;
}

// Retrieve and clear WebAuthn challenge from session (for registration)
export async function getAndClearChallenge(
  expectedType: "registration"
): Promise<ChallengeData | null> {
  const session = await getSession();

  if (
    !session.challenge ||
    session.challengeType !== expectedType ||
    !session.pendingUserId ||
    !session.pendingUsername
  ) {
    return null;
  }

  const result: ChallengeData = {
    challenge: session.challenge,
    userId: session.pendingUserId,
    username: session.pendingUsername,
  };

  session.challenge = undefined;
  session.challengeType = undefined;
  session.pendingUserId = undefined;
  session.pendingUsername = undefined;
  await session.save();

  return result;
}

// Retrieve and clear WebAuthn challenge from session (for usernameless authentication)
export async function getAndClearChallengeUsernameless(): Promise<
  string | null
> {
  const session = await getSession();

  if (!session.challenge || session.challengeType !== "authentication") {
    return null;
  }

  const challenge = session.challenge;

  session.challenge = undefined;
  session.challengeType = undefined;
  await session.save();

  return challenge;
}
