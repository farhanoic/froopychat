// Debug existing user flow
import { test, expect } from '@playwright/test';

test('debug existing user auto-detect flow', async ({ page }) => {
  console.log('🔍 Testing existing user flow...');

  try {
    // Use an email we know exists (from previous tests)
    const existingEmail = 'test@example.com'; // This should exist based on curl test
    
    // Navigate to auth page
    await page.goto('http://localhost:5173/auth');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Enter existing email
    await page.fill('input[type="email"]', existingEmail);
    await page.click('button:has-text("Continue")');
    
    // Wait and see what happens
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'debug-existing-user.png' });
    
    // Check what text is shown
    const allText = await page.textContent('body');
    console.log('📝 Existing user page text:', allText);
    
    // Check for specific indicators
    if (allText.includes('Welcome back')) {
      console.log('✅ Shows WELCOME BACK for existing user');
    }
    if (allText.includes('Create your account')) {
      console.log('❌ Incorrectly shows CREATE ACCOUNT for existing user');
    }
    
    // Check if gender buttons are hidden for existing users
    const maleButton = page.locator('button:has-text("👨 Male")');
    const femaleButton = page.locator('button:has-text("👩 Female")');
    
    if (!(await maleButton.isVisible()) && !(await femaleButton.isVisible())) {
      console.log('✅ Gender buttons correctly hidden for existing user');
    } else {
      console.log('❌ Gender buttons incorrectly shown for existing user');
    }
    
    // Check button text
    const loginButton = page.locator('button:has-text("Login")');
    if (await loginButton.isVisible()) {
      console.log('✅ Shows LOGIN button for existing user');
    }
    
    console.log('🎯 Existing user flow debugging complete!');
    
  } catch (error) {
    await page.screenshot({ path: 'debug-existing-error.png' });
    console.error('❌ Existing user debug failed:', error.message);
    throw error;
  }
});