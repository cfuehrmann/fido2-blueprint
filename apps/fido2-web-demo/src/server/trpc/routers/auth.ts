import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  createSession,
  destroySession,
  storeChallenge,
  getAndClearChallenge,
  storeChallengeUsernameless,
  getAndClearChallengeUsernameless,
} from "@/server/auth/session";
import { auth } from "@/server/auth";
import { AuthError, usernameSchema } from "@repo/fido2-auth";

export const authRouter = router({
  // Get current session
  session: publicProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  // Start registration - generate options
  registerStart: publicProcedure
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ input }) => {
      try {
        const { options, userId, username } = await auth.registerStart(
          input.username
        );

        // Store challenge and pending user data in session
        await storeChallenge(
          options.challenge,
          "registration",
          userId,
          username
        );

        return { options };
      } catch (error) {
        if (error instanceof AuthError && error.code === "USERNAME_TAKEN") {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        throw error;
      }
    }),

  // Finish registration - verify response and create user
  registerFinish: publicProcedure
    .input(
      z.object({
        credential: z.any(), // RegistrationResponseJSON - validated by simplewebauthn
      })
    )
    .mutation(async ({ input }) => {
      const challengeData = await getAndClearChallenge("registration");
      if (!challengeData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No registration challenge found. Please start over.",
        });
      }

      try {
        const { userId, username } = await auth.registerFinish(
          challengeData.userId,
          challengeData.username,
          challengeData.challenge,
          input.credential
        );

        await createSession(userId, username);
        return { success: true };
      } catch (error) {
        if (error instanceof AuthError) {
          throw new TRPCError({
            code: error.code === "USERNAME_TAKEN" ? "CONFLICT" : "BAD_REQUEST",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // Start login - generate authentication options (usernameless flow)
  loginStart: publicProcedure.mutation(async () => {
    const { options } = await auth.loginStart();

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
      const challenge = await getAndClearChallengeUsernameless();
      if (!challenge) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No authentication challenge found. Please start over.",
        });
      }

      try {
        const { userId, username } = await auth.loginFinish(
          challenge,
          input.credential
        );

        await createSession(userId, username);
        return { success: true };
      } catch (error) {
        if (error instanceof AuthError) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // Logout
  logout: protectedProcedure.mutation(async () => {
    await destroySession();
    return { success: true };
  }),
});
