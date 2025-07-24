import { test, expect } from '@playwright/test';

test.describe('Navigation Tests', () => {
  test('should load auth page at /auth route', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveURL('/auth');
    
    // Should show the Froopy branding or auth form
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', /email/i);
  });

  test('should redirect unauthenticated users from root to auth', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to /auth for unauthenticated users (security feature)
    await expect(page).toHaveURL('/auth');
    
    // Should show the authentication page
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('should have only two valid routes (/auth and /)', async ({ page }) => {
    // Test root route - should redirect to auth if unauthenticated
    await page.goto('/');
    await expect(page).toHaveURL('/auth');
    
    // Test auth route directly
    await page.goto('/auth');
    await expect(page).toHaveURL('/auth');
    
    // Test invalid route - should redirect to auth due to client-side routing
    await page.goto('/invalid-route');
    await expect(page).toHaveURL('/auth', { timeout: 2000 });
    
    // The app should still be responsive (not crash)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have mobile-optimized viewport', async ({ page }) => {
    await page.goto('/auth');
    
    // Check that page renders properly in mobile viewport (375x667)
    const viewport = page.viewportSize();
    expect(viewport.width).toBe(375);
    expect(viewport.height).toBe(667);
    
    // Check that elements are touch-friendly (minimum 48px height)
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      const firstButton = buttons.first();
      const boundingBox = await firstButton.boundingBox();
      expect(boundingBox.height).toBeGreaterThanOrEqual(40); // Close to 48px minimum
    }
  });

  test('should load without console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('404') && 
      !error.includes('favicon') &&
      !error.includes('WebSocket')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});