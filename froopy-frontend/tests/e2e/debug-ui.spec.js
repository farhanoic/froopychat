// Debug UI Elements Test
import { test, expect } from '@playwright/test';

test('Debug: Check Phase 3 UI Elements', async ({ page }) => {
  console.log('🔍 Debugging Phase 3 UI Elements');
  
  // Navigate to auth page
  await page.goto('http://localhost:5173/auth');
  
  // Complete auth
  await page.fill('input[type="email"]', 'debug@test.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('text=👨');
  await expect(page.locator('text=You\'ll be known as:')).toBeVisible();
  await page.click('button:has-text("Continue")');
  await expect(page).toHaveURL('http://localhost:5173/');
  
  console.log('✅ Auth flow completed');
  
  // Take screenshot of main page
  await page.screenshot({ path: 'debug-main-page.png' });
  
  // Check for Phase 3 elements
  console.log('🔍 Checking for Phase 3 UI elements...');
  
  // Check for interests input
  const interestsInput = page.locator('input[placeholder*="Interests"]');
  if (await interestsInput.isVisible()) {
    console.log('✅ Interests input field found');
    await interestsInput.fill('gaming, music');
    console.log('✅ Filled interests');
  } else {
    console.log('❌ Interests input field NOT found');
  }
  
  // Check for duration buttons
  const durations = ['15s', '30s', '1min', '∞'];
  for (const duration of durations) {
    const button = page.locator(`button:has-text("${duration}")`);
    if (await button.isVisible()) {
      console.log(`✅ Duration button ${duration} found`);
    } else {
      console.log(`❌ Duration button ${duration} NOT found`);
    }
  }
  
  // Check for gender preference buttons
  const genderButtons = ['Male', 'Female', 'Both'];
  for (const gender of genderButtons) {
    const button = page.locator(`button:has-text("${gender}")`);
    if (await button.isVisible()) {
      console.log(`✅ Gender button ${gender} found`);
    } else {
      console.log(`❌ Gender button ${gender} NOT found`);
    }
  }
  
  // Try clicking Female to start search
  await page.click('button:has-text("Female")');
  console.log('✅ Clicked Female preference');
  
  // Wait and check for search state
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'debug-searching-state.png' });
  
  // Check what text appears during search
  const searchTexts = [
    'Looking for shared interests',
    'Finding someone for you',
    'Phase 1 of 2',
    'Searching for',
    'I want to chat with'
  ];
  
  for (const text of searchTexts) {
    const element = page.locator(`text=${text}`);
    if (await element.isVisible()) {
      console.log(`✅ Found text: ${text}`);
    } else {
      console.log(`❌ NOT found text: ${text}`);
    }
  }
  
  console.log('🔍 Debug complete');
});