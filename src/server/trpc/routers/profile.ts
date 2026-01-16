import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import {
  getUserCredentials,
  deleteCredential,
  renameCredential,
  createRegistrationOptions,
  verifyAndStoreRegistration,
} from "@/server/auth/fido2";
import { storeChallenge, getAndClearChallenge } from "@/server/auth/session";

export const profileRouter = router({
  // Get current user's profile
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, ctx.user.userId))
      .get();

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user;
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
      await db
        .update(schema.users)
        .set({
          displayName: input.displayName,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, ctx.user.userId));

      return { success: true };
    }),

  // Get user's credentials
  getCredentials: protectedProcedure.query(async ({ ctx }) => {
    const credentials = await getUserCredentials(ctx.user.userId);
    return credentials.map((cred) => ({
      id: cred.id,
      name: cred.name,
      deviceType: cred.deviceType,
      backedUp: cred.backedUp,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
    }));
  }),

  // Start adding a new passkey
  addPasskeyStart: protectedProcedure.mutation(async ({ ctx }) => {
    const options = await createRegistrationOptions(
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
        credential: z.any(), // RegistrationResponseJSON
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
        await verifyAndStoreRegistration(
          ctx.user.userId,
          challengeData.challenge,
          input.credential
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "Failed to add passkey",
        });
      }

      return { success: true };
    }),

  // Delete a credential
  deleteCredential: protectedProcedure
    .input(z.object({ credentialId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteCredential(ctx.user.userId, input.credentialId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Failed to delete credential",
        });
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
        await renameCredential(ctx.user.userId, input.credentialId, input.name);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Failed to rename credential",
        });
      }

      return { success: true };
    }),
});
