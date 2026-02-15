import { TRPCClientError } from "@trpc/client";

// Browser-side authentication errors (from WebAuthn API)
export type BrowserAuthErrorCode =
  | "CANCELLED_OR_DENIED" // NotAllowedError - user cancelled, timed out, or blocked
  | "ALREADY_REGISTERED"; // InvalidStateError - credential already exists

// Convert browser WebAuthn errors to a typed error code
export function getBrowserAuthErrorCode(
  err: unknown
): BrowserAuthErrorCode | null {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") return "CANCELLED_OR_DENIED";
    if (err.name === "InvalidStateError") return "ALREADY_REGISTERED";
  }
  return null;
}

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
