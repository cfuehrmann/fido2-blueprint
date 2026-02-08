export type AuthErrorCode =
  | "USERNAME_TAKEN"
  | "USER_NOT_FOUND"
  | "CREDENTIAL_NOT_FOUND"
  | "CREDENTIAL_NOT_OWNED"
  | "LAST_CREDENTIAL"
  | "REGISTRATION_FAILED"
  | "AUTHENTICATION_FAILED";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
