// Client-safe exports (no Node.js dependencies)
export { usernameSchema } from "./validation";
export { AuthError, type AuthErrorCode } from "./errors";
export type { WebAuthnConfig } from "./fido2";
