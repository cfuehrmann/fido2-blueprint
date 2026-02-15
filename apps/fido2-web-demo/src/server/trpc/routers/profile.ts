import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { storeChallenge, getAndClearChallenge } from "@/server/auth/session";
import { auth } from "@/server/auth";
import { ServerAuthError } from "@repo/fido2-auth";

export const profileRouter = router({
  // Get current user's profile
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await auth.getUser(ctx.user.userId);
    } catch (error) {
      if (error instanceof ServerAuthError && error.code === "USER_NOT_FOUND") {
        throw new TRPCError({ code: "NOT_FOUND", message: error.message });
      }
      throw error;
    }
  }),

  // Update display name
  updateDisplayName: protectedProcedure
    .input(
      z.object({
        displayName: z
          .string()
          .min(1, "Display name is required")
          .max(100, "Display name is too long"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await auth.updateDisplayName(ctx.user.userId, input.displayName);
      return { success: true };
    }),

  // Get user's credentials
  getCredentials: protectedProcedure.query(async ({ ctx }) => {
    const credentials = await auth.getCredentials(ctx.user.userId);
    return credentials.map((cred) => ({
      id: cred.id,
      name: cred.name,
      deviceType: cred.deviceType,
      backedUp: cred.backedUp,
      transports: cred.transports,
      counter: cred.counter,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
    }));
  }),

  // Start adding a new passkey
  addPasskeyStart: protectedProcedure.mutation(async ({ ctx }) => {
    const { options } = await auth.addPasskeyStart(
      ctx.user.userId,
      ctx.user.username
    );

    // Store challenge with user data (even though we have ctx.user, this ensures
    // the challenge is cryptographically bound to the user who started it)
    await storeChallenge(
      options.challenge,
      "registration",
      ctx.user.userId,
      ctx.user.username
    );

    return { options };
  }),

  // Finish adding a new passkey
  addPasskeyFinish: protectedProcedure
    .input(
      z.object({
        authenticatorResponse: z.any(), // RegistrationResponseJSON
      })
    )
    .mutation(async ({ ctx, input }) => {
      const challengeData = await getAndClearChallenge("registration");
      if (!challengeData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No registration challenge found. Please start over.",
        });
      }

      // Verify the challenge was issued for this user (defense in depth)
      if (challengeData.userId !== ctx.user.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Challenge was not issued for this user. Please start over.",
        });
      }

      try {
        await auth.addPasskeyFinish(
          ctx.user.userId,
          challengeData.challenge,
          input.authenticatorResponse
        );
      } catch (error) {
        if (error instanceof ServerAuthError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw error;
      }

      return { success: true };
    }),

  // Delete a credential
  deleteCredential: protectedProcedure
    .input(z.object({ credentialId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await auth.removeCredential(ctx.user.userId, input.credentialId);
      } catch (error) {
        if (error instanceof ServerAuthError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw error;
      }

      return { success: true };
    }),

  // Rename a credential
  renameCredential: protectedProcedure
    .input(
      z.object({
        credentialId: z.string(),
        name: z.string().min(1, "Name is required").max(50, "Name is too long"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await auth.renameCredential(
          ctx.user.userId,
          input.credentialId,
          input.name
        );
      } catch (error) {
        if (error instanceof ServerAuthError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw error;
      }

      return { success: true };
    }),
});
