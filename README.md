# FIDO2 Blueprint

A minimalistic web application demonstrating passwordless authentication with FIDO2/WebAuthn passkeys. Intended as a starting point for building secure, modern web applications.

## Why This Exists

Passwords are a security liability. FIDO2/WebAuthn passkeys offer phishing-resistant, passwordless authentication that's both more secure and more convenient. This blueprint provides a working implementation you can learn from and build upon.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up the database
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev
```

Copy `.env.example` to `.env.local` and generate a new `SESSION_SECRET`:

```bash
openssl rand -base64 32
```

## Testing

End-to-end tests are central to this project. They use Playwright with a virtual WebAuthn authenticator, enabling realistic passkey flows without physical hardware.

```bash
# Run E2E tests
pnpm test:e2e

# Run with browser visible
pnpm test:e2e --headed

# Run unit tests
pnpm test
```

**The E2E tests are the safety net for refactoring.** They test actual user flows (registration, login, profile management) through a real browser. Keep them passing and up to date.

## Design Decisions

### Why Passkeys Only (No Passwords)

This blueprint intentionally omits password authentication. Passkeys are:
- Phishing-resistant (bound to the origin)
- Not reusable across sites
- Not vulnerable to credential stuffing
- More convenient (biometric or device PIN)

If you need password fallback for legacy reasons, add it consciously, understanding the security tradeoffs.

### Why SQLite

SQLite provides referential integrity without requiring users to install a database server. The database is a single file, making development and testing straightforward. For production with multiple servers, swap to PostgreSQL - the Drizzle ORM layer makes this a configuration change.

### Why tRPC

tRPC provides end-to-end type safety from database to UI with zero code generation. When you change an API, TypeScript catches mismatches immediately. This eliminates an entire class of runtime errors.

### Why Encrypted Cookie Sessions (Not Database Sessions)

Session data is encrypted and stored in a cookie. This means:
- No session table to query on every request
- Stateless servers (easier horizontal scaling)
- Sessions survive server restarts

The tradeoff: you cannot instantly revoke a session server-side. For most applications, short session lifetimes (30 min idle, 8 hour absolute) are sufficient. If you need "logout from all devices", add a session table.

### Why One API Call Per User Action

Each user action (register, login, update profile) is a single API call. This simplifies error handling and avoids complex retry logic. If a call fails, show an error. If it succeeds, the action is complete.

### Why E2E Tests Over Unit Tests

Unit tests verify implementation details. E2E tests verify behavior. When you refactor the implementation, unit tests break even if behavior is unchanged. E2E tests only break if you actually broke something.

This blueprint emphasizes E2E tests because:
- They catch real bugs (the auth flow actually works)
- They survive refactoring
- Playwright's virtual authenticator makes WebAuthn testing practical

Unit tests are still valuable for complex business logic, but the E2E tests are the primary safety net.

## Session Security

Sessions use sliding expiration with an absolute maximum:
- **Idle timeout**: Session expires after inactivity (configurable via `SESSION_IDLE_TIMEOUT_MINUTES`, default 30)
- **Absolute maximum**: Even active sessions expire (configurable via `SESSION_ABSOLUTE_TIMEOUT_HOURS`, default 8)

Cookie security flags:
- `httpOnly`: Not accessible via JavaScript
- `secure`: HTTPS only (in production)
- `sameSite: strict`: Not sent with cross-site requests

## Multi-Device Support

Users can register multiple passkeys (e.g., phone + laptop + security key). The credential management UI allows adding and removing passkeys, with protection against removing the last one.

Modern passkeys sync across devices automatically (via iCloud Keychain, Google Password Manager, etc.), so most users won't need to manually add multiple credentials.

## WebAuthn Configuration

The WebAuthn Relying Party is configured via environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `WEBAUTHN_RP_ID` | Domain name | `localhost` or `example.com` |
| `WEBAUTHN_RP_NAME` | Display name | `My App` |
| `WEBAUTHN_ORIGIN` | Full origin | `https://example.com` |

**Important**: `RP_ID` must match your domain. Passkeys are bound to this identifier and won't work if it changes.

## Production Considerations

Before deploying:

1. **Generate a strong session secret** (32+ random bytes)
2. **Use HTTPS** (required for WebAuthn in production)
3. **Set correct RP_ID** (your production domain)
4. **Consider database** (PostgreSQL for multi-server deployments)
5. **Set up monitoring** (failed auth attempts, error rates)

## License

MIT
