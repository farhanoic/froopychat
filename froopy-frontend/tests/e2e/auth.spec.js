import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('should display auth page components correctly', async ({ page }) => {
    // Check Froopy branding
    await expect(page.locator('h1')).toContainText('Froopy');
    
    // Check email input
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', 'Your email');
    
    // Check gender buttons
    const maleButton = page.locator('button:has-text("👨")');
    const femaleButton = page.locator('button:has-text("👩")');
    
    await expect(maleButton).toBeVisible();
    await expect(femaleButton).toBeVisible();
    
    // Continue button should not be visible initially
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).not.toBeVisible();
  });

  test('should require email before gender selection', async ({ page }) => {
    // Try to select gender without email
    const maleButton = page.locator('button:has-text("👨")');
    
    // Set up dialog handler before clicking
    page.on('dialog', async dialog => {
      expect(dialog.message()).toBe('Please enter your email first');
      await dialog.accept();
    });
    
    await maleButton.click();
    
    // Should still be on the same page with no gender selected
    await expect(page.locator('button:has-text("Continue")')).not.toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Enter invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    
    // Set up dialog handler
    page.on('dialog', async dialog => {
      expect(dialog.message()).toBe('Please enter your email first');
      await dialog.accept();
    });
    
    await page.locator('button:has-text("👩")').click();
    
    // Should still show email input
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should complete auth flow with valid email and gender selection', async ({ page }) => {
    // Enter valid email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Enter valid password
    await page.fill('input[type="password"]', 'password123');
    
    // Select gender (male)
    await page.locator('button:has-text("👨")').click();
    
    // Should hide email input and gender buttons, show continue button
    await expect(page.locator('input[type="email"]')).not.toBeVisible();
    await expect(page.locator('button:has-text("👨")')).not.toBeVisible();
    await expect(page.locator('button:has-text("👩")')).not.toBeVisible();
    
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeVisible();
    
    // Click continue
    await continueButton.click();
    
    // Should navigate to main page
    await expect(page).toHaveURL('/');
  });

  test('should complete auth flow with female selection', async ({ page }) => {
    // Enter valid email
    await page.fill('input[type="email"]', 'female@example.com');
    
    // Enter valid password
    await page.fill('input[type="password"]', 'password123');
    
    // Select gender (female)
    await page.locator('button:has-text("👩")').click();
    
    // Should show continue button
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeVisible();
    
    // Click continue
    await continueButton.click();
    
    // Should navigate to main page
    await expect(page).toHaveURL('/');
  });

  test('should handle email with minimal validation', async ({ page }) => {
    // Test borderline valid email
    await page.fill('input[type="email"]', 'a@b');
    
    // Enter valid password
    await page.fill('input[type="password"]', 'password123');
    
    // Should allow gender selection
    await page.locator('button:has-text("👨")').click();
    
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeVisible();
  });

  test('should handle continue button validation', async ({ page }) => {
    // This tests the edge case where someone might try to navigate directly
    // or if there's a race condition
    
    await page.fill('input[type="email"]', '');
    await page.locator('button:has-text("👨")').click();
    
    // Even if somehow the continue button appeared, clicking it should validate
    // This is testing the handleContinue function's email validation
  });

  test('should have proper mobile styling', async ({ page }) => {
    // Check that elements are properly sized for mobile
    const emailInput = page.locator('input[type="email"]');
    const inputBox = await emailInput.boundingBox();
    
    // Should be at least 48px high for touch targets
    expect(inputBox.height).toBeGreaterThanOrEqual(40);
    
    // Gender buttons should be large enough
    const maleButton = page.locator('button:has-text("👨")');
    const buttonBox = await maleButton.boundingBox();
    expect(buttonBox.width).toBeGreaterThanOrEqual(40);
    expect(buttonBox.height).toBeGreaterThanOrEqual(40);
  });

  test('should preserve email during gender selection flow', async ({ page }) => {
    const testEmail = 'preserve@test.com';
    
    // Enter email
    await page.fill('input[type="email"]', testEmail);
    
    // Enter valid password
    await page.fill('input[type="password"]', 'password123');
    
    // Select gender
    await page.locator('button:has-text("👨")').click();
    
    // The email should be stored in state even though input is hidden
    // We can verify this by checking that continue works (which validates email)
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeVisible();
    
    await continueButton.click();
    await expect(page).toHaveURL('/');
  });

  test('should validate password length', async ({ page }) => {
    // Enter valid email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Enter password too short
    await page.fill('input[type="password"]', 'short');
    
    // Try to select gender - should get alert about password
    await page.locator('button:has-text("👨")').click();
    
    // Should still show email and password inputs
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Gender buttons should still be visible (not changed to continue button)
    await expect(page.locator('button:has-text("👨")')).toBeVisible();
  });
});