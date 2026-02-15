// Client-safe exports (no Node.js dependencies)
export { usernameSchema } from "./validation";
export { ServerAuthError, type ServerAuthErrorCode } from "./errors";
export type { WebAuthnConfig } from "./fido2";
