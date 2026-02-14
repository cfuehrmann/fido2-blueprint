import { test as base, expect, type Page } from "@playwright/test";

// Setup virtual WebAuthn authenticator
async function setupVirtualAuthenticator(page: Page) {
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send("WebAuthn.enable");

  const { authenticatorId } = await cdpSession.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    }
  );

  return { authenticatorId, cdpSession };
}

const test = base;

// Helper: Navigate to registration page and fill username
async function goToRegistration(page: Page, username: string) {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");

  // Fill in username
  await page.locator('input[name="username"]').fill(username);
}

// Helper: Register a new user
async function registerUser(page: Page, username: string) {
  await goToRegistration(page, username);

  // Click "Create account" button
  await page.locator('button:has-text("Create account")').click();

  // Wait for redirect to profile
  await expect(page).toHaveURL("/profile", { timeout: 15000 });
}

test.describe("Authentication", () => {
  test("user can register with a passkey", async ({ page }) => {
    // Setup virtual authenticator
    await setupVirtualAuthenticator(page);

    const username = `testuser_${Date.now()}`;
    await registerUser(page, username);

    // Should see the username on the profile page
    await expect(page.getByText(username).first()).toBeVisible();
  });

  test("registered user can login with passkey (usernameless)", async ({
    page,
  }) => {
    // Setup virtual authenticator
    await setupVirtualAuthenticator(page);

    // First register a user
    const username = `testuser_${Date.now()}`;
    await registerUser(page, username);

    // Logout
    await page.locator('button:has-text("Sign out")').click();

    // Wait for redirect to login
    await expect(page).toHaveURL("/login", { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Now login - no username needed, just click the button
    await page.locator('button:has-text("Sign in with passkey")').click();

    // Should redirect back to profile
    await expect(page).toHaveURL("/profile", { timeout: 15000 });

    // Should see the username
    await expect(page.getByText(username).first()).toBeVisible();
  });

  test("shows validation error for empty username on registration", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Leave username empty and click "Create account"
    await page.locator('button:has-text("Create account")').click();

    // Should show validation error (not JSON)
    await expect(
      page.getByText("Username must be at least 3 characters")
    ).toBeVisible({
      timeout: 5000,
    });

    // Error should not contain JSON brackets
    const errorText = await page.locator(".text-destructive").textContent();
    expect(errorText).not.toContain("[");
    expect(errorText).not.toContain("{");
  });

  test("shows validation error for short username on registration", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Enter too-short username
    await page.locator('input[name="username"]').fill("ab");
    await page.locator('button:has-text("Create account")').click();

    // Should show validation error
    await expect(
      page.getByText("Username must be at least 3 characters")
    ).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows validation error for invalid username characters on registration", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Enter username with invalid characters
    await page.locator('input[name="username"]').fill("test@user");
    await page.locator('button:has-text("Create account")').click();

    // Should show validation error
    await expect(
      page.getByText(
        "Username can only contain letters, numbers, and underscores"
      )
    ).toBeVisible({ timeout: 5000 });
  });

  test("prevents duplicate registration", async ({ page }) => {
    await setupVirtualAuthenticator(page);

    const username = `testuser_${Date.now()}`;

    // Register first user
    await registerUser(page, username);

    // Logout
    await page.locator('button:has-text("Sign out")').click();
    await expect(page).toHaveURL("/login", { timeout: 10000 });

    // Try to register with same username
    await goToRegistration(page, username);
    await page.locator('button:has-text("Create account")').click();

    // Should show error about username taken
    await expect(page.getByText(/already taken/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("login page links to register and vice versa", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Should see login view
    await expect(
      page.locator('button:has-text("Sign in with passkey")')
    ).toBeVisible();

    // Click "Create one" link to navigate to register
    await page.locator('a:has-text("Create one")').click();
    await expect(page).toHaveURL("/register");

    // Should see registration view with username field
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(
      page.locator('button:has-text("Create account")')
    ).toBeVisible();

    // Click "Sign in" link to navigate back to login
    await page.locator('a:has-text("Sign in")').click();
    await expect(page).toHaveURL("/login");

    // Should be back on login view
    await expect(
      page.locator('button:has-text("Sign in with passkey")')
    ).toBeVisible();
  });
});

test.describe("Root URL Redirects", () => {
  test("unauthenticated user visiting / is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login", { timeout: 10000 });
  });

  test("authenticated user visiting / is redirected to /profile", async ({
    page,
  }) => {
    await setupVirtualAuthenticator(page);

    // Register a user first
    const username = `testuser_${Date.now()}`;
    await registerUser(page, username);

    // Now visit root URL
    await page.goto("/");

    // Should redirect to profile
    await expect(page).toHaveURL("/profile", { timeout: 10000 });
  });
});

test.describe("Profile", () => {
  test("user can update display name", async ({ page }) => {
    await setupVirtualAuthenticator(page);

    // Register
    const username = `testuser_${Date.now()}`;
    await registerUser(page, username);

    // Click edit button
    await page.locator('button:has-text("Edit")').click();

    // Fill in new display name
    const newDisplayName = "Test User Display Name";
    await page.locator("input#displayName").fill(newDisplayName);
    await page.locator('button:has-text("Save")').click();

    // Should see the new display name
    await expect(page.getByText(newDisplayName)).toBeVisible({
      timeout: 10000,
    });
  });

  test("passkey is auto-named and can be renamed", async ({ page }) => {
    await setupVirtualAuthenticator(page);

    // Register a user
    const username = `testuser_${Date.now()}`;
    await registerUser(page, username);

    // Should see auto-generated passkey name "Passkey 1"
    await expect(page.getByText("Passkey 1")).toBeVisible({ timeout: 10000 });

    // Should see "Consider renaming" badge
    await expect(page.getByText("Consider renaming")).toBeVisible();

    // Click the pencil icon to rename
    await page.locator('button[title="Rename passkey"]').click();

    // Type new name and save
    const newName = "My Phone";
    await page.locator("input").nth(0).fill(newName);
    await page.locator('button:has-text("Save")').first().click();

    // Should see the new name
    await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });

    // "Consider renaming" badge should be gone
    await expect(page.getByText("Consider renaming")).not.toBeVisible();

    // Reload page and verify name persists
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });
  });
});
