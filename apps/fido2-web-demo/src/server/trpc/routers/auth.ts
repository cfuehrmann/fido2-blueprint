import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import {
  createSession,
  destroySession,
  storeChallenge,
  getAndClearChallenge,
  storeChallengeUsernameless,
  getAndClearChallengeUsernameless,
} from "@/server/auth/session";
import {
  createRegistrationOptions,
  verifyAndStoreRegistration,
  createAuthenticationOptions,
  verifyAuthentication,
} from "@repo/fido2-auth";
import { webauthnConfig } from "@/server/auth/config";
import { randomUUID } from "crypto";
import { usernameSchema } from "@/lib/validation";

export const authRouter = router({
  // Get current session
  session: publicProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  // Start registration - generate options
  registerStart: publicProcedure
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ input }) => {
      const { username } = input;

      // Check if username is taken
      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .get();

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username is already taken",
        });
      }

      // Generate a temporary user ID for registration
      const userId = randomUUID();

      // Generate registration options
      const options = await createRegistrationOptions(
        db,
        webauthnConfig,
        userId,
        username
      );

      // Store challenge and pending user data in session (binds them cryptographically)
      await storeChallenge(options.challenge, "registration", userId, username);

      // Return options to client (userId/username not needed by client for finish)
      return { options };
    }),

  // Finish registration - verify response and create user
  registerFinish: publicProcedure
    .input(
      z.object({
        credential: z.any(), // RegistrationResponseJSON - validated by simplewebauthn
      })
    )
    .mutation(async ({ input }) => {
      const { credential } = input;

      // Get and clear the challenge and pending user data from session
      const challengeData = await getAndClearChallenge("registration");
      if (!challengeData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No registration challenge found. Please start over.",
        });
      }

      const { challenge, userId, username } = challengeData;

      // Check again that username isn't taken (race condition protection)
      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .get();

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username is already taken",
        });
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
        await verifyAndStoreRegistration(
          db,
          webauthnConfig,
          userId,
          challenge,
          credential
        );
      } catch (error) {
        // Rollback: delete the user if credential storage fails
        await db.delete(schema.users).where(eq(schema.users.id, userId));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Registration verification failed",
        });
      }

      // Create session
      await createSession(userId, username);

      return { success: true };
    }),

  // Start login - generate authentication options (usernameless flow)
  loginStart: publicProcedure.mutation(async () => {
    // Generate authentication options without allowCredentials
    // This allows the authenticator to show all discoverable credentials
    const options = await createAuthenticationOptions(webauthnConfig);

    // Store only the challenge (no user binding for usernameless flow)
    await storeChallengeUsernameless(options.challenge);

    return { options };
  }),

  // Finish login - verify response and create session (usernameless flow)
  loginFinish: publicProcedure
    .input(
      z.object({
        credential: z.any(), // AuthenticationResponseJSON
      })
    )
    .mutation(async ({ input }) => {
      const { credential } = input;

      // Get and clear the challenge from session
      const challenge = await getAndClearChallengeUsernameless();
      if (!challenge) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No authentication challenge found. Please start over.",
        });
      }

      // Verify the authentication and get user info from credential
      try {
        const { userId, username } = await verifyAuthentication(
          db,
          webauthnConfig,
          challenge,
          credential
        );

        // Create session
        await createSession(userId, username);
      } catch (error) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            error instanceof Error
              ? error.message
              : "Authentication verification failed",
        });
      }

      return { success: true };
    }),

  // Logout
  logout: protectedProcedure.mutation(async () => {
    await destroySession();
    return { success: true };
  }),
});
