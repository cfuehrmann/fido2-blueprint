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

## Multi-Device Support

Users can register multiple passkeys (e.g., phone + laptop + security key). The credential management UI allows adding and removing passkeys, with protection against removing the last one.

Modern passkeys sync across devices automatically (via iCloud Keychain, Google Password Manager, etc.), so most users won't need to manually add multiple credentials.

## Deployment

### Environment Variables

| Variable                         | Required | Default                 | Description                                           |
| -------------------------------- | -------- | ----------------------- | ----------------------------------------------------- |
| `SESSION_SECRET`                 | Yes      | -                       | Encryption key for sessions (min 32 chars)            |
| `WEBAUTHN_RP_ID`                 | Yes      | `localhost`             | Domain name for passkey binding                       |
| `WEBAUTHN_RP_NAME`               | Yes      | `FIDO2 Blueprint`       | Display name shown during passkey registration        |
| `WEBAUTHN_ORIGIN`                | Yes      | `http://localhost:3000` | Full origin URL for WebAuthn                          |
| `DATABASE_PATH`                  | Yes      | `./data/app.db`         | Path to SQLite database file                          |
| `SESSION_IDLE_TIMEOUT_MINUTES`   | No       | `30`                    | Session expires after this many minutes idle          |
| `SESSION_ABSOLUTE_TIMEOUT_HOURS` | No       | `8`                     | Maximum session lifetime regardless of activity       |
| `PORT`                           | No       | `3000`                  | Server port (used by `scripts/start-prod.sh`)         |
| `HOSTNAME`                       | No       | `0.0.0.0`               | Server bind address (used by `scripts/start-prod.sh`) |

### Production Setup

1. **Create a data directory outside the repo** (safe from `git clean`):

   ```bash
   mkdir /path/to/fido2-data
   ```

2. **Create `.env.local`**:

   ```bash
   SESSION_SECRET=$(openssl rand -base64 32)
   WEBAUTHN_RP_ID=example.com
   WEBAUTHN_RP_NAME=FIDO2 Blueprint
   WEBAUTHN_ORIGIN=https://example.com
   DATABASE_PATH=/path/to/fido2-data/app.db
   ```

3. **Build and run migrations**:

   ```bash
   pnpm install
   pnpm build
   DATABASE_PATH=/path/to/fido2-data/app.db pnpm db:migrate
   ```

4. **Start the server** using the production script:
   ```bash
   PORT=3001 HOSTNAME=127.0.0.1 ./scripts/start-prod.sh
   ```

### systemd Service Example

```ini
[Unit]
Description=FIDO2 Blueprint
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/fido2-blueprint
ExecStart=/path/to/fido2-blueprint/scripts/start-prod.sh
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOSTNAME=127.0.0.1

[Install]
WantedBy=multi-user.target
```

Place this in `/etc/systemd/system/fido2-blueprint.service`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fido2-blueprint
```

### Reverse Proxy

The server binds to localhost only (`HOSTNAME=127.0.0.1`). Use a reverse proxy like Caddy or nginx to handle HTTPS:

**Caddy example** (`/etc/caddy/Caddyfile`):

```
fido2.example.com {
    reverse_proxy localhost:3001
}
```

Caddy automatically provisions SSL certificates via Let's Encrypt.

### Development Workflow on a Server

When developing on a deployed server (e.g., testing passkeys on a mobile device), you have two options:

**Option 1: Rebuild and restart** (production mode)

```bash
pnpm build
sudo systemctl restart fido2-blueprint
```

**Option 2: Dev mode with hot reload** (faster iteration)

```bash
sudo systemctl stop fido2-blueprint
PORT=3001 pnpm dev
# Ctrl+C when done, then restart production:
sudo systemctl start fido2-blueprint
```

Dev mode provides instant hot reload on code changes. Note that `pnpm dev` binds to all interfaces by default, which is acceptable for short dev sessions.

### Production Checklist

- Generate a strong session secret (32+ random bytes)
- Use HTTPS (required for WebAuthn)
- Set correct `WEBAUTHN_RP_ID` (passkeys are bound to this domain)
- Store database outside the repo
- Back up the database regularly

## License

MIT
