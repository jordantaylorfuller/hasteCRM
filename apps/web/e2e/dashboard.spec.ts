import { test, expect } from "./fixtures/test-base";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting a fake token
    // In a real app, you would properly authenticate
    await page.addInitScript(() => {
      localStorage.setItem("auth-token", "fake-token-for-testing");
    });
  });

  test("should display dashboard layout", async ({ page }) => {
    await page.goto("/dashboard");

    // Check for main dashboard elements
    await expect(
      page.getByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();

    // Check for navigation items
    await expect(page.getByRole("link", { name: /contacts/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /pipelines/i })).toBeVisible();

    // Check for user menu
    await expect(
      page.getByRole("button", { name: /user menu/i }),
    ).toBeVisible();
  });

  test("should navigate to contacts", async ({ page }) => {
    await page.goto("/dashboard");

    // Click contacts link
    await page.getByRole("link", { name: /contacts/i }).click();

    // Should navigate to contacts page
    await expect(page).toHaveURL("/contacts");
    await expect(
      page.getByRole("heading", { name: /contacts/i }),
    ).toBeVisible();
  });

  test("should navigate to pipelines", async ({ page }) => {
    await page.goto("/dashboard");

    // Click pipelines link
    await page.getByRole("link", { name: /pipelines/i }).click();

    // Should navigate to pipelines page
    await expect(page).toHaveURL("/pipelines");
    await expect(
      page.getByRole("heading", { name: /pipelines/i }),
    ).toBeVisible();
  });

  test("should open user menu", async ({ page }) => {
    await page.goto("/dashboard");

    // Click user menu
    await page.getByRole("button", { name: /user menu/i }).click();

    // Should show menu items
    await expect(
      page.getByRole("menuitem", { name: /profile/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /settings/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /sign out/i }),
    ).toBeVisible();
  });

  test("should handle sign out", async ({ page }) => {
    await page.goto("/dashboard");

    // Open user menu and click sign out
    await page.getByRole("button", { name: /user menu/i }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL("/login");

    // Should clear auth token
    const token = await page.evaluate(() => localStorage.getItem("auth-token"));
    expect(token).toBeNull();
  });

  test("should show recent activity", async ({ page }) => {
    await page.goto("/dashboard");

    // Check for activity section
    await expect(page.getByText(/recent activity/i)).toBeVisible();
  });

  test("should show statistics cards", async ({ page }) => {
    await page.goto("/dashboard");

    // Check for stats cards
    await expect(page.getByText(/total contacts/i)).toBeVisible();
    await expect(page.getByText(/active deals/i)).toBeVisible();
    await expect(page.getByText(/emails/i)).toBeVisible();
  });

  test("should be responsive", async ({ page }) => {
    await page.goto("/dashboard");

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Mobile menu should be visible
    await expect(page.getByRole("button", { name: /menu/i })).toBeVisible();

    // Desktop navigation should be hidden
    await expect(page.getByRole("navigation").first()).not.toBeVisible();

    // Click mobile menu
    await page.getByRole("button", { name: /menu/i }).click();

    // Mobile navigation should appear
    await expect(page.getByRole("link", { name: /contacts/i })).toBeVisible();
  });
});
