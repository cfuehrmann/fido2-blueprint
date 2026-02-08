// Database schema
export * from "./db/schema";

// Validation
export { usernameSchema } from "./validation";

// FIDO2 / WebAuthn
export {
  createRegistrationOptions,
  verifyAndStoreRegistration,
  createAuthenticationOptions,
  verifyAuthentication,
  getUserCredentials,
  renameCredential,
  deleteCredential,
  type WebAuthnConfig,
} from "./fido2";
