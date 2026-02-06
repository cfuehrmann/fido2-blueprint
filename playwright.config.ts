import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Run tests sequentially to avoid DB conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid concurrent DB access issues
  reporter: "html",
  use: {
    baseURL: "http://localhost:3333",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "mkdir -p ./data && pnpm db:generate && pnpm exec tsx src/server/db/migrate.ts && pnpm dev --port 3333",
    url: "http://localhost:3333",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_RP_NAME: "FIDO2 Blueprint Test",
      WEBAUTHN_ORIGIN: "http://localhost:3333",
      DATABASE_PATH: "./data/app.db",
      SESSION_SECRET: "test-secret-at-least-32-characters-long",
    },
  },
});
