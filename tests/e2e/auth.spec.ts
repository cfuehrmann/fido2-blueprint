import { test as base, expect, type Page } from "@playwright/test"

// Setup virtual WebAuthn authenticator
async function setupVirtualAuthenticator(page: Page) {
  const cdpSession = await page.context().newCDPSession(page)
  await cdpSession.send("WebAuthn.enable")

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
  )

  return { authenticatorId, cdpSession }
}

const test = base

test.describe("Authentication", () => {
  test("user can register with a passkey", async ({ page }) => {
    // Setup virtual authenticator
    await setupVirtualAuthenticator(page)

    // Go to registration page
    await page.goto("/register")

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle")

    // Fill in username
    const username = `testuser_${Date.now()}`
    await page.locator('input[name="username"]').fill(username)

    // Click register button
    await page.locator('button[type="submit"]').click()

    // Should redirect to profile page
    await expect(page).toHaveURL("/profile", { timeout: 15000 })

    // Should see the username on the profile page
    await expect(page.getByText(username).first()).toBeVisible()
  })

  test("registered user can login with passkey", async ({ page }) => {
    // Setup virtual authenticator
    await setupVirtualAuthenticator(page)

    // First register a user
    const username = `testuser_${Date.now()}`
    await page.goto("/register")
    await page.waitForLoadState("networkidle")

    await page.locator('input[name="username"]').fill(username)
    await page.locator('button[type="submit"]').click()

    // Wait for registration to complete and redirect
    await expect(page).toHaveURL("/profile", { timeout: 15000 })

    // Logout
    await page.locator('button:has-text("Sign out")').click()

    // Wait for redirect to login
    await expect(page).toHaveURL("/login", { timeout: 10000 })
    await page.waitForLoadState("networkidle")

    // Now login with the same username
    await page.locator('input[name="username"]').fill(username)
    await page.locator('button[type="submit"]').click()

    // Should redirect back to profile
    await expect(page).toHaveURL("/profile", { timeout: 15000 })

    // Should see the username
    await expect(page.getByText(username).first()).toBeVisible()
  })

  test("shows error for non-existent user", async ({ page }) => {
    await setupVirtualAuthenticator(page)

    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    await page.locator('input[name="username"]').fill("nonexistent_user_12345")
    await page.locator('button[type="submit"]').click()

    // Should show error message
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 10000 })
  })

  test("prevents duplicate registration", async ({ page }) => {
    await setupVirtualAuthenticator(page)

    const username = `testuser_${Date.now()}`

    // Register first user
    await page.goto("/register")
    await page.waitForLoadState("networkidle")

    await page.locator('input[name="username"]').fill(username)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL("/profile", { timeout: 15000 })

    // Logout
    await page.locator('button:has-text("Sign out")').click()
    await expect(page).toHaveURL("/login", { timeout: 10000 })

    // Try to register with same username
    await page.goto("/register")
    await page.waitForLoadState("networkidle")

    await page.locator('input[name="username"]').fill(username)
    await page.locator('button[type="submit"]').click()

    // Should show error about username taken
    await expect(page.getByText(/already taken/i)).toBeVisible({ timeout: 10000 })
  })
})

test.describe("Profile", () => {
  test("user can update display name", async ({ page }) => {
    await setupVirtualAuthenticator(page)

    // Register
    const username = `testuser_${Date.now()}`
    await page.goto("/register")
    await page.waitForLoadState("networkidle")

    await page.locator('input[name="username"]').fill(username)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL("/profile", { timeout: 15000 })

    // Click edit button
    await page.locator('button:has-text("Edit")').click()

    // Fill in new display name
    const newDisplayName = "Test User Display Name"
    await page.locator('input#displayName').fill(newDisplayName)
    await page.locator('button:has-text("Save")').click()

    // Should see the new display name
    await expect(page.getByText(newDisplayName)).toBeVisible({ timeout: 10000 })
  })
})
