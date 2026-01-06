import { getIronSession, IronSession } from "iron-session"
import { cookies } from "next/headers"

// Session data structure
export interface SessionData {
  userId?: string
  username?: string
  createdAt?: number
  // Temporary storage for WebAuthn challenges
  challenge?: string
  challengeType?: "registration" | "authentication"
}

// Session timeout configuration (with defaults)
const IDLE_TIMEOUT_MINUTES = parseInt(
  process.env.SESSION_IDLE_TIMEOUT_MINUTES || "30",
  10
)
const ABSOLUTE_TIMEOUT_HOURS = parseInt(
  process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS || "8",
  10
)

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
}

// Absolute maximum session lifetime
const ABSOLUTE_MAX_AGE_MS = ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function createSession(userId: string, username: string): Promise<void> {
  const session = await getSession()
  session.userId = userId
  session.username = username
  session.createdAt = Date.now()
  // Clear any WebAuthn challenge data
  session.challenge = undefined
  session.challengeType = undefined
  await session.save()
}

export async function destroySession(): Promise<void> {
  const session = await getSession()
  session.destroy()
}

export async function isSessionValid(): Promise<boolean> {
  const session = await getSession()
  
  if (!session.userId || !session.createdAt) {
    return false
  }
  
  // Check absolute maximum age
  if (Date.now() - session.createdAt > ABSOLUTE_MAX_AGE_MS) {
    await destroySession()
    return false
  }
  
  return true
}

export async function getCurrentUser(): Promise<{ userId: string; username: string } | null> {
  const valid = await isSessionValid()
  if (!valid) {
    return null
  }
  
  const session = await getSession()
  return {
    userId: session.userId!,
    username: session.username!,
  }
}

// Store WebAuthn challenge in session
export async function storeChallenge(
  challenge: string,
  type: "registration" | "authentication"
): Promise<void> {
  const session = await getSession()
  session.challenge = challenge
  session.challengeType = type
  await session.save()
}

// Retrieve and clear WebAuthn challenge from session
export async function getAndClearChallenge(
  expectedType: "registration" | "authentication"
): Promise<string | null> {
  const session = await getSession()
  
  if (!session.challenge || session.challengeType !== expectedType) {
    return null
  }
  
  const challenge = session.challenge
  session.challenge = undefined
  session.challengeType = undefined
  await session.save()
  
  return challenge
}
