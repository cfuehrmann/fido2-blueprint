export type ServerAuthErrorCode =
  | "USERNAME_TAKEN"
  | "USER_NOT_FOUND"
  | "CREDENTIAL_NOT_FOUND"
  | "CREDENTIAL_NOT_OWNED"
  | "LAST_CREDENTIAL"
  | "REGISTRATION_FAILED"
  | "AUTHENTICATION_FAILED";

export class ServerAuthError extends Error {
  constructor(
    public readonly code: ServerAuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ServerAuthError";
  }
}
