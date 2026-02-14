import { TRPCClientError } from "@trpc/client";

export function getErrorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) {
    // Check for Zod validation errors (properly formatted by server)
    const zodError = err.data?.zodError;
    if (zodError?.fieldErrors) {
      const firstField = Object.keys(zodError.fieldErrors)[0];
      if (firstField && zodError.fieldErrors[firstField]?.[0]) {
        return zodError.fieldErrors[firstField][0];
      }
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred";
}
