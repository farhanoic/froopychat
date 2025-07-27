// Manual Auto-Detect Test - Simple debugging test
import { test, expect } from '@playwright/test';

test('debug auto-detect flow step by step', async ({ page }) => {
  console.log('🔍 Debugging auto-detect flow...');

  try {
    // Step 1: Navigate to auth page
    await page.goto('http://localhost:5173/auth');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'debug-1-initial.png' });
    console.log('✅ Initial page loaded');
    
    // Step 2: Check what email input looks like
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    console.log('✅ Email input visible');
    
    // Step 3: Enter a test email
    await emailInput.fill('debug@test.com');
    console.log('✅ Email entered: debug@test.com');
    
    // Step 4: Find and click continue button
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    console.log('✅ Continue button clicked');
    
    // Step 5: Wait and see what happens
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'debug-2-after-continue.png' });
    
    // Check what text elements are now visible
    const allText = await page.textContent('body');
    console.log('📝 All text on page:', allText);
    
    // Look for password input
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible()) {
      console.log('✅ Password input visible');
      
      // Check for sign up vs login indicators
      const body = await page.textContent('body');
      if (body.includes('Create your account')) {
        console.log('✅ Shows CREATE ACCOUNT flow (new user)');
      } else if (body.includes('Welcome back')) {
        console.log('✅ Shows WELCOME BACK flow (existing user)');
      } else {
        console.log('❓ Unknown flow detected');
      }
      
      // Check for gender buttons (should only show for new users)
      const maleButton = page.locator('button:has-text("👨 Male")');
      const femaleButton = page.locator('button:has-text("👩 Female")');
      
      if (await maleButton.isVisible() && await femaleButton.isVisible()) {
        console.log('✅ Gender buttons visible (new user signup)');
      } else {
        console.log('✅ Gender buttons hidden (existing user login)');
      }
    }
    
    console.log('🎯 Auto-detect flow debugging complete!');
    
  } catch (error) {
    await page.screenshot({ path: 'debug-error.png' });
    console.error('❌ Debug failed:', error.message);
    throw error;
  }
});