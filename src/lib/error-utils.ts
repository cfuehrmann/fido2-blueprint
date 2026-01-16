import { TRPCClientError } from "@trpc/client";

export function getErrorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) {
    const zodError = err.data?.zodError;
    if (zodError?.fieldErrors) {
      const firstField = Object.keys(zodError.fieldErrors)[0];
      if (firstField && zodError.fieldErrors[firstField]?.[0]) {
        return zodError.fieldErrors[firstField][0];
      }
    }
    return (
      err.message ||
      `TRPCClientError (no message, code: ${err.data?.code ?? "unknown"})`
    );
  }
  if (err instanceof Error) {
    return err.message || `${err.name || "Error"} (no message)`;
  }
  return `Unknown error: ${JSON.stringify(err)}`;
}

export function getWebAuthnErrorMessage(
  err: unknown,
  context: "login" | "register"
): string {
  if (err instanceof Error) {
    const errorDetail = `[${err.name}] ${err.message || "(no message)"}`;

    switch (err.name) {
      case "NotAllowedError":
        return context === "login"
          ? `Authentication was cancelled or timed out (${errorDetail})`
          : `Passkey creation was cancelled or timed out (${errorDetail})`;
      case "InvalidStateError":
        return `This passkey is already registered (${errorDetail})`;
      case "AbortError":
        return context === "login"
          ? `Authentication was aborted (${errorDetail})`
          : `Passkey creation was aborted (${errorDetail})`;
      case "SecurityError":
        return `Security error (${errorDetail})`;
      default:
        return getErrorMessage(err);
    }
  }
  return getErrorMessage(err);
}
