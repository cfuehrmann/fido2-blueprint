import { initTRPC, TRPCError } from "@trpc/server";
import { getCurrentUser } from "@/server/auth/session";

// Context type - what's available in every procedure
export interface Context {
  user: { userId: string; username: string } | null;
}

// Create context for each request
export async function createContext(): Promise<Context> {
  const user = await getCurrentUser();
  return { user };
}

// Initialize tRPC
const t = initTRPC.context<Context>().create();

// Base router and procedure
export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Now we know user is not null
    },
  });
});
