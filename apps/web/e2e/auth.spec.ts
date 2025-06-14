import { test, expect } from './fixtures/test-base';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    // Check page elements
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByText(/don't have an account/i)).toBeVisible();
  });

  test('should display register page', async ({ page }) => {
    await page.goto('/register');
    
    // Check page elements
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
    await expect(page.getByPlaceholder(/first name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/last name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/^password/i)).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('should show validation errors on empty login', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show validation errors
    await expect(page.getByText(/email.*required/i)).toBeVisible();
    await expect(page.getByText(/password.*required/i)).toBeVisible();
  });

  test('should show validation errors on invalid email', async ({ page }) => {
    await page.goto('/login');
    
    // Enter invalid email
    await page.getByPlaceholder(/email/i).fill('invalid-email');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show email validation error
    await expect(page.getByText(/valid.*email/i)).toBeVisible();
  });

  test('should navigate between login and register', async ({ page }) => {
    // Start at login
    await page.goto('/login');
    
    // Click register link
    await page.getByText(/don't have an account/i).click();
    await expect(page).toHaveURL('/register');
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
    
    // Click login link
    await page.getByText(/already have an account/i).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should register a new user', async ({ page, testUser }) => {
    await page.goto('/register');
    
    // Fill registration form
    await page.getByPlaceholder(/first name/i).fill(testUser.firstName);
    await page.getByPlaceholder(/last name/i).fill(testUser.lastName);
    await page.getByPlaceholder(/email/i).fill(testUser.email);
    await page.getByPlaceholder(/^password/i).first().fill(testUser.password);
    await page.getByPlaceholder(/confirm password/i).fill(testUser.password);
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should redirect to verify email or dashboard
    await expect(page).toHaveURL(/\/(verify-email|dashboard)/);
  });

  test('should handle password mismatch', async ({ page, testUser }) => {
    await page.goto('/register');
    
    // Fill form with mismatched passwords
    await page.getByPlaceholder(/first name/i).fill(testUser.firstName);
    await page.getByPlaceholder(/last name/i).fill(testUser.lastName);
    await page.getByPlaceholder(/email/i).fill(testUser.email);
    await page.getByPlaceholder(/^password/i).first().fill(testUser.password);
    await page.getByPlaceholder(/confirm password/i).fill('different-password');
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show password mismatch error
    await expect(page.getByText(/passwords.*match/i)).toBeVisible();
  });

  test('should show Google OAuth button', async ({ page }) => {
    await page.goto('/login');
    
    // Check for Google sign-in button
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  });

  test('should handle login errors', async ({ page }) => {
    await page.goto('/login');
    
    // Fill login form with invalid credentials
    await page.getByPlaceholder(/email/i).fill('nonexistent@example.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show error message
    await expect(page.getByText(/invalid.*credentials/i)).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});