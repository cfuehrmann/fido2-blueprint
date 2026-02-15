import { TRPCClientError } from "@trpc/client";

// Browser-side authentication errors (from WebAuthn API)
export type BrowserAuthErrorCode =
  | "CANCELLED_OR_DENIED" // NotAllowedError - user cancelled, timed out, or blocked
  | "ALREADY_REGISTERED"; // InvalidStateError - credential already exists

export class BrowserAuthError extends Error {
  constructor(
    public readonly code: BrowserAuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "BrowserAuthError";
  }
}

// Convert browser WebAuthn errors to BrowserAuthError
export function toBrowserAuthError(err: unknown): BrowserAuthError | null {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") {
      return new BrowserAuthError("CANCELLED_OR_DENIED", err.message);
    }
    if (err.name === "InvalidStateError") {
      return new BrowserAuthError("ALREADY_REGISTERED", err.message);
    }
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
