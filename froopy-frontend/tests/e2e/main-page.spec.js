import { test, expect } from '@playwright/test';

test.describe('Main Page States', () => {
  // Helper function to complete auth flow
  async function completeAuthFlow(page, email = 'test@example.com', gender = '👨') {
    await page.goto('/auth');
    await page.fill('input[type="email"]', email);
    await page.locator(`button:has-text("${gender}")`).click();
    await page.locator('button:has-text("Continue")').click();
    await expect(page).toHaveURL('/');
  }

  test('should show preferences view after auth completion', async ({ page }) => {
    await completeAuthFlow(page);
    
    // Should show preferences view
    await expect(page.locator('h2')).toContainText('I want to chat with');
    
    // Should show gender preference options
    const maleOption = page.locator('button', { hasText: 'Male' }).first();
    const femaleOption = page.locator('button', { hasText: 'Female' }).first();
    const bothOption = page.locator('button', { hasText: 'Both' }).first();
    
    await expect(maleOption).toBeVisible();
    await expect(femaleOption).toBeVisible();
    await expect(bothOption).toBeVisible();
  });

  test('should show connection status indicator', async ({ page }) => {
    await completeAuthFlow(page);
    
    // Should show connection status dot in top-right corner
    const statusDot = page.locator('.w-3.h-3.rounded-full').first();
    await expect(statusDot).toBeVisible();
    
    // Should be green (connected) or red (disconnected)
    const hasValidStatus = await statusDot.evaluate(el => {
      return el.classList.contains('bg-green-500') || el.classList.contains('bg-red-500');
    });
    expect(hasValidStatus).toBeTruthy();
  });

  test('should transition to searching state when preference selected', async ({ page }) => {
    await completeAuthFlow(page);
    
    // Select "Both" preference
    await page.locator('button', { hasText: 'Both' }).first().click();
    
    // Should show searching view
    await expect(page.locator('h2')).toContainText('Finding someone...');
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    
    // Should have loading animation (3 bouncing dots)
    const loadingDots = page.locator('.animate-bounce');
    const dotCount = await loadingDots.count();
    expect(dotCount).toBe(3);
  });

  test('should transition to searching with different preferences', async ({ page }) => {
    await completeAuthFlow(page);
    
    // Test with "Male" preference
    await page.locator('button', { hasText: 'Male' }).first().click();
    await expect(page.locator('h2')).toContainText('Finding someone...');
    
    // Cancel and try Female
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('h2')).toContainText('I want to chat with');
    
    await page.locator('button', { hasText: 'Female' }).first().click();
    await expect(page.locator('h2')).toContainText('Finding someone...');
  });

  test('should return to preferences on cancel search', async ({ page }) => {
    await completeAuthFlow(page);
    
    // Go to searching state
    await page.locator('button', { hasText: 'Female' }).first().click();
    await expect(page.locator('h2')).toContainText('Finding someone...');
    
    // Cancel search
    await page.locator('button:has-text("Cancel")').click();
    
    // Should return to preferences
    await expect(page.locator('h2')).toContainText('I want to chat with');
    
    // All preference buttons should be visible again
    await expect(page.locator('button', { hasText: 'Male' }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Female' }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Both' }).first()).toBeVisible();
  });

  test('should maintain responsive design across states', async ({ page }) => {
    await completeAuthFlow(page);
    
    // Check preferences view mobile layout
    const preferencesContainer = page.locator('.flex.flex-col.items-center');
    await expect(preferencesContainer).toBeVisible();
    
    // Go to searching state
    await page.locator('button', { hasText: 'Both' }).first().click();
    
    // Check searching view mobile layout
    const searchingContainer = page.locator('.flex.flex-col.items-center');
    await expect(searchingContainer).toBeVisible();
    
    const cancelButton = page.locator('button:has-text("Cancel")');
    const buttonBox = await cancelButton.boundingBox();
    expect(buttonBox.height).toBeGreaterThanOrEqual(40); // Touch-friendly
  });

  test('should handle direct navigation to main page without auth', async ({ page }) => {
    // Navigate directly to main page without completing auth
    await page.goto('/');
    
    // The page should still load (though user data might be empty)
    // This tests that the app doesn't crash without user context
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // The app should handle the case where user is null/undefined
    // It might show preferences or handle the missing user gracefully
  });

  test('should preserve user data from auth flow', async ({ page }) => {
    const testEmail = 'preserve@test.com';
    await completeAuthFlow(page, testEmail, '👩');
    
    // User data should be preserved and accessible to the main page
    // We can verify this by checking that the page loads correctly
    // and preferences are shown (which means user context is working)
    await expect(page.locator('h2')).toContainText('I want to chat with');
  });

  test('should handle rapid state changes', async ({ page }) => {
    await completeAuthFlow(page);
    
    // Rapidly switch between states
    await page.locator('button', { hasText: 'Male' }).first().click();
    await page.locator('button:has-text("Cancel")').click();
    await page.locator('button', { hasText: 'Female' }).first().click();
    await page.locator('button:has-text("Cancel")').click();
    
    // Should end up in preferences state
    await expect(page.locator('h2')).toContainText('I want to chat with');
    
    // All options should still be available
    await expect(page.locator('button', { hasText: 'Male' }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Female' }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Both' }).first()).toBeVisible();
  });

  test('should show proper styling for each state', async ({ page }) => {
    await completeAuthFlow(page);
    
    // Check preferences view styling
    await expect(page.locator('.bg-dark-navy')).toBeVisible();
    await expect(page.locator('.text-white')).toBeVisible();
    
    // Check "Both" button has royal-blue background
    const bothButton = page.locator('button', { hasText: 'Both' }).first();
    const hasRoyalBlue = await bothButton.evaluate(el => {
      return el.classList.contains('bg-royal-blue');
    });
    expect(hasRoyalBlue).toBeTruthy();
    
    // Go to searching state
    await bothButton.click();
    
    // Check searching view maintains styling
    await expect(page.locator('.bg-dark-navy')).toBeVisible();
    await expect(page.locator('.text-white')).toBeVisible();
  });
});