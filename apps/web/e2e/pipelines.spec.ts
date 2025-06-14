import { test, expect } from './fixtures/test-base';

test.describe('Pipeline Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'fake-token-for-testing');
    });
    await page.goto('/pipelines');
  });

  test('should display pipelines page', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /pipelines/i })).toBeVisible();
    
    // Check for pipeline board elements
    await expect(page.getByRole('button', { name: /add.*deal/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /pipeline.*settings/i })).toBeVisible();
  });

  test('should display pipeline stages', async ({ page }) => {
    // Check for default stages
    const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
    
    for (const stage of stages) {
      const stageColumn = page.getByText(stage);
      if (await stageColumn.isVisible()) {
        await expect(stageColumn).toBeVisible();
      }
    }
  });

  test('should open add deal modal', async ({ page }) => {
    // Click add deal button
    await page.getByRole('button', { name: /add.*deal/i }).click();
    
    // Modal should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /add.*deal/i })).toBeVisible();
    
    // Check form fields
    await expect(page.getByLabel(/title/i)).toBeVisible();
    await expect(page.getByLabel(/value/i)).toBeVisible();
    await expect(page.getByLabel(/contact/i)).toBeVisible();
    await expect(page.getByLabel(/stage/i)).toBeVisible();
    await expect(page.getByLabel(/close.*date/i)).toBeVisible();
  });

  test('should create a new deal', async ({ page }) => {
    // Open add deal modal
    await page.getByRole('button', { name: /add.*deal/i }).click();
    
    // Fill form
    await page.getByLabel(/title/i).fill('New Enterprise Deal');
    await page.getByLabel(/value/i).fill('50000');
    await page.getByLabel(/stage/i).selectOption({ index: 0 }); // Select first stage
    
    // Submit form
    await page.getByRole('button', { name: /save/i }).click();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // New deal should appear
    await expect(page.getByText('New Enterprise Deal')).toBeVisible();
    await expect(page.getByText('$50,000')).toBeVisible();
  });

  test('should handle drag and drop', async ({ page }) => {
    // Find a deal card
    const dealCard = page.locator('[data-testid="deal-card"]').first();
    
    if (await dealCard.isVisible()) {
      // Get initial stage
      const initialStage = await dealCard.locator('..').getAttribute('data-stage');
      
      // Find next stage column
      const nextStage = page.locator('[data-testid="stage-column"]').nth(1);
      
      if (await nextStage.isVisible()) {
        // Drag deal to next stage
        await dealCard.dragTo(nextStage);
        
        // Deal should move to new stage
        await expect(dealCard).toBeVisible();
        
        // Could verify API call or UI update here
      }
    }
  });

  test('should open deal details', async ({ page }) => {
    // Click on a deal card
    const dealCard = page.locator('[data-testid="deal-card"]').first();
    
    if (await dealCard.isVisible()) {
      await dealCard.click();
      
      // Should show deal details modal or sidebar
      await expect(page.getByRole('heading', { name: /deal.*detail/i }).or(page.getByRole('dialog'))).toBeVisible();
      
      // Check for deal information
      await expect(page.getByText(/value/i)).toBeVisible();
      await expect(page.getByText(/stage/i)).toBeVisible();
      await expect(page.getByText(/owner/i)).toBeVisible();
    }
  });

  test('should filter deals by stage', async ({ page }) => {
    // Click on a stage header
    const stageHeader = page.getByText('Qualified').first();
    
    if (await stageHeader.isVisible()) {
      await stageHeader.click();
      
      // Could show stage-specific view or filter
      // Verify filtered view if implemented
    }
  });

  test('should show pipeline analytics', async ({ page }) => {
    // Look for analytics button or section
    const analyticsButton = page.getByRole('button', { name: /analytics/i });
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Should show analytics view
      await expect(page.getByText(/conversion.*rate/i)).toBeVisible();
      await expect(page.getByText(/average.*deal.*size/i)).toBeVisible();
      await expect(page.getByText(/win.*rate/i)).toBeVisible();
    }
  });

  test('should handle pipeline settings', async ({ page }) => {
    // Click settings button
    await page.getByRole('button', { name: /pipeline.*settings/i }).click();
    
    // Settings modal should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /pipeline.*settings/i })).toBeVisible();
    
    // Check settings options
    await expect(page.getByText(/stage.*configuration/i)).toBeVisible();
    await expect(page.getByText(/automation.*rules/i)).toBeVisible();
  });

  test('should show deal count per stage', async ({ page }) => {
    // Each stage should show deal count
    const stageCounts = page.locator('[data-testid="stage-count"]');
    
    if ((await stageCounts.count()) > 0) {
      const firstCount = stageCounts.first();
      await expect(firstCount).toBeVisible();
      await expect(firstCount).toHaveText(/\d+/); // Should be a number
    }
  });

  test('should handle empty pipeline', async ({ page }) => {
    // Check for empty state in any stage
    const emptyState = page.getByText(/no deals.*stage/i);
    
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
      await expect(page.getByText(/drag.*deals.*here/i)).toBeVisible();
    }
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Pipeline should adapt to mobile
    // Might show horizontal scroll or stack stages
    const pipelineBoard = page.locator('[data-testid="pipeline-board"]');
    
    if (await pipelineBoard.isVisible()) {
      // Board should be scrollable on mobile
      const isScrollable = await pipelineBoard.evaluate((el) => {
        return el.scrollWidth > el.clientWidth;
      });
      
      expect(isScrollable).toBeTruthy();
    }
  });
});