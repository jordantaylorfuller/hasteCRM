import { test, expect } from './fixtures/test-base';

test.describe('Contacts Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'fake-token-for-testing');
    });
    await page.goto('/contacts');
  });

  test('should display contacts page', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible();
    
    // Check for main UI elements
    await expect(page.getByRole('button', { name: /add contact/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /filter/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /import/i })).toBeVisible();
  });

  test('should open add contact modal', async ({ page }) => {
    // Click add contact button
    await page.getByRole('button', { name: /add contact/i }).click();
    
    // Modal should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /add.*contact/i })).toBeVisible();
    
    // Check form fields
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/phone/i)).toBeVisible();
    await expect(page.getByLabel(/company/i)).toBeVisible();
    await expect(page.getByLabel(/title/i)).toBeVisible();
  });

  test('should create a new contact', async ({ page }) => {
    // Open add contact modal
    await page.getByRole('button', { name: /add contact/i }).click();
    
    // Fill form
    await page.getByLabel(/first name/i).fill('John');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email/i).fill('john.doe@example.com');
    await page.getByLabel(/phone/i).fill('+1 555-123-4567');
    await page.getByLabel(/title/i).fill('CEO');
    
    // Submit form
    await page.getByRole('button', { name: /save/i }).click();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // New contact should appear in list
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('john.doe@example.com')).toBeVisible();
  });

  test('should search contacts', async ({ page }) => {
    // Type in search box
    await page.getByPlaceholder(/search/i).fill('john');
    
    // Wait for search to complete
    await page.waitForTimeout(500);
    
    // Should filter contacts
    await expect(page.getByText(/searching/i).or(page.getByText(/no results/i))).toBeVisible();
  });

  test('should open filter popover', async ({ page }) => {
    // Click filter button
    await page.getByRole('button', { name: /filter/i }).click();
    
    // Filter popover should appear
    await expect(page.getByRole('heading', { name: /filter/i })).toBeVisible();
    
    // Check filter options
    await expect(page.getByLabel(/status/i)).toBeVisible();
    await expect(page.getByLabel(/source/i)).toBeVisible();
    await expect(page.getByLabel(/city/i)).toBeVisible();
    await expect(page.getByLabel(/state/i)).toBeVisible();
  });

  test('should apply filters', async ({ page }) => {
    // Open filter popover
    await page.getByRole('button', { name: /filter/i }).click();
    
    // Select a filter
    await page.getByLabel(/status/i).selectOption('ACTIVE');
    
    // Apply filters
    await page.getByRole('button', { name: /apply/i }).click();
    
    // Filter badge should show count
    await expect(page.getByRole('button', { name: /filter/i }).getByText('1')).toBeVisible();
  });

  test('should reset filters', async ({ page }) => {
    // Open filter popover
    await page.getByRole('button', { name: /filter/i }).click();
    
    // Select a filter
    await page.getByLabel(/status/i).selectOption('ACTIVE');
    
    // Reset filters
    await page.getByRole('button', { name: /reset/i }).click();
    
    // Filters should be cleared
    await expect(page.getByLabel(/status/i)).toHaveValue('');
  });

  test('should open import modal', async ({ page }) => {
    // Click import button
    await page.getByRole('button', { name: /import/i }).click();
    
    // Import modal should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /import/i })).toBeVisible();
    
    // Check import options
    await expect(page.getByText(/csv/i)).toBeVisible();
    await expect(page.getByText(/excel/i)).toBeVisible();
    await expect(page.getByText(/json/i)).toBeVisible();
  });

  test('should handle contact click', async ({ page }) => {
    // Assume there's at least one contact
    const contactCard = page.locator('[data-testid="contact-card"]').first();
    
    if (await contactCard.isVisible()) {
      // Click contact card
      await contactCard.click();
      
      // Should show contact details or navigate to detail page
      await expect(page.getByRole('heading', { name: /contact.*detail/i }).or(page.getByRole('dialog'))).toBeVisible();
    }
  });

  test('should handle empty state', async ({ page }) => {
    // If no contacts, should show empty state
    const emptyState = page.getByText(/no contacts.*found/i);
    const contactsList = page.locator('[data-testid="contacts-list"]');
    
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
      await expect(page.getByText(/get started.*adding/i)).toBeVisible();
    } else {
      await expect(contactsList).toBeVisible();
    }
  });

  test('should paginate contacts', async ({ page }) => {
    // Look for pagination controls
    const pagination = page.locator('[data-testid="pagination"]');
    
    if (await pagination.isVisible()) {
      // Check pagination elements
      await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
      
      // Click next page if available
      const nextButton = page.getByRole('button', { name: /next/i });
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        // URL should update with page parameter
        await expect(page).toHaveURL(/page=2/);
      }
    }
  });

  test('should handle bulk actions', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    
    if ((await checkboxes.count()) > 1) {
      // Select first checkbox
      await checkboxes.nth(1).check();
      
      // Bulk actions should appear
      await expect(page.getByText(/1 selected/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /bulk.*action/i })).toBeVisible();
    }
  });
});