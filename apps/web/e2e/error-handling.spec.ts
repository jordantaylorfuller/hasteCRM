import { test, expect } from './fixtures/test-base';

test.describe('Error Handling', () => {
  test('should display 404 page for non-existent routes', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    // Should show 404 page
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText(/page not found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /go.*home/i })).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept API calls and make them fail
    await page.route('**/api/**', (route) => {
      route.abort('failed');
    });
    
    await page.goto('/dashboard');
    
    // Should show error message
    await expect(page.getByText(/error|failed|problem/i)).toBeVisible();
  });

  test('should show loading states', async ({ page }) => {
    // Slow down API responses
    await page.route('**/api/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });
    
    await page.goto('/contacts');
    
    // Should show loading indicator
    await expect(page.getByText(/loading/i).or(page.getByRole('progressbar'))).toBeVisible();
  });

  test('should handle form submission errors', async ({ page }) => {
    await page.goto('/login');
    
    // Intercept login API and return error
    await page.route('**/auth/login', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid credentials',
          error: 'BAD_REQUEST',
        }),
      });
    });
    
    // Fill and submit form
    await page.getByPlaceholder(/email/i).fill('test@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('should handle session expiration', async ({ page }) => {
    // Set expired token
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'expired-token');
    });
    
    // Intercept API calls to return 401
    await page.route('**/api/**', (route) => {
      if (!route.request().url().includes('auth')) {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Session expired',
            error: 'UNAUTHORIZED',
          }),
        });
      } else {
        route.continue();
      }
    });
    
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.getByText(/session.*expired/i)).toBeVisible();
  });

  test('should handle permission errors', async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'limited-access-token');
    });
    
    // Intercept API to return 403
    await page.route('**/api/admin/**', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Insufficient permissions',
          error: 'FORBIDDEN',
        }),
      });
    });
    
    // Try to access admin route
    await page.goto('/admin/settings');
    
    // Should show permission error
    await expect(page.getByText(/permission|forbidden|access denied/i)).toBeVisible();
  });

  test('should recover from errors', async ({ page }) => {
    let shouldFail = true;
    
    // Intercept API calls
    await page.route('**/api/contacts', (route) => {
      if (shouldFail) {
        route.abort('failed');
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ contacts: [], total: 0 }),
        });
      }
    });
    
    await page.goto('/contacts');
    
    // Should show error
    await expect(page.getByText(/error|failed|try again/i)).toBeVisible();
    
    // Find and click retry button
    const retryButton = page.getByRole('button', { name: /try again|retry/i });
    if (await retryButton.isVisible()) {
      shouldFail = false; // Make next request succeed
      await retryButton.click();
      
      // Should recover and show content
      await expect(page.getByText(/error|failed/i)).not.toBeVisible();
    }
  });

  test('should handle offline mode', async ({ page, context }) => {
    await page.goto('/dashboard');
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.getByRole('link', { name: /contacts/i }).click();
    
    // Should show offline indicator
    await expect(page.getByText(/offline|no.*connection/i)).toBeVisible();
    
    // Go back online
    await context.setOffline(false);
    
    // Should recover
    await page.reload();
    await expect(page.getByText(/offline|no.*connection/i)).not.toBeVisible();
  });

  test('should validate file uploads', async ({ page }) => {
    await page.goto('/contacts');
    await page.getByRole('button', { name: /import/i }).click();
    
    // Try to upload invalid file type
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      const invalidFile = Buffer.from('invalid content');
      await fileInput.setInputFiles({
        name: 'test.exe',
        mimeType: 'application/x-msdownload',
        buffer: invalidFile,
      });
      
      // Should show validation error
      await expect(page.getByText(/invalid.*file.*type/i)).toBeVisible();
    }
  });

  test('should handle large form validation', async ({ page }) => {
    await page.goto('/contacts');
    await page.getByRole('button', { name: /add contact/i }).click();
    
    // Fill form with invalid data
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/phone/i).fill('123'); // Too short
    
    // Try to submit
    await page.getByRole('button', { name: /save/i }).click();
    
    // Should show multiple validation errors
    await expect(page.getByText(/valid.*email/i)).toBeVisible();
    await expect(page.getByText(/valid.*phone/i)).toBeVisible();
    
    // Form should not be submitted
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});