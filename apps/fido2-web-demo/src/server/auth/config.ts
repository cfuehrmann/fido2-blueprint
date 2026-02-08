import type { WebAuthnConfig } from "@repo/fido2-auth";

export const webauthnConfig: WebAuthnConfig = {
  rpID: process.env.WEBAUTHN_RP_ID || "localhost",
  rpName: process.env.WEBAUTHN_RP_NAME || "FIDO2 Blueprint",
  origin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
};
