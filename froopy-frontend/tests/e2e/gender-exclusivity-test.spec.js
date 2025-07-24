// Gender Matching Exclusivity Test - Verify users only match with preferred gender
// Tests that Male→Female NEVER matches with Male→Male, etc.
import { test, expect } from '@playwright/test';

test.describe('Gender Matching Exclusivity Verification', () => {
  
  // Helper function to complete auth flow
  async function completeAuth(page, email, password, gender) {
    await page.goto('http://localhost:5173/auth');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    const genderButton = gender === 'male' ? 'text=👨' : 'text=👩';
    await page.click(genderButton);
    
    await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await page.click('button:has-text("Continue")');
    await page.waitForURL('http://localhost:5173/');
  }

  test('EXCLUSIVITY: Male→Female should NOT match with Male→Male', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Male looking for Female
      await completeAuth(user1, 'male_wants_female@test.com', 'password123', 'male');
      
      // User 2: Male looking for Male (should NOT match with User 1)
      await completeAuth(user2, 'male_wants_male@test.com', 'password123', 'male');
      
      // Start searches
      await user1.click('button:has-text("Female")');
      await user2.click('button:has-text("Male")');
      
      // Both should stay in "Searching..." state - NO MATCH should occur
      await expect(user1.locator('text=Searching...')).toBeVisible({ timeout: 5000 });
      await expect(user2.locator('text=Searching...')).toBeVisible({ timeout: 5000 });
      
      // Wait 10 seconds - should NOT get matched
      await user1.waitForTimeout(10000);
      
      // Verify they're still searching (no match occurred)
      await expect(user1.locator('text=Searching...')).toBeVisible();
      await expect(user2.locator('text=Searching...')).toBeVisible();
      
      // Verify they did NOT reach chat state
      await expect(user1.locator('text=You\'re now chatting!')).not.toBeVisible();
      await expect(user2.locator('text=You\'re now chatting!')).not.toBeVisible();
      
      console.log('✅ EXCLUSIVITY VERIFIED: Male→Female did NOT match with Male→Male');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('EXCLUSIVITY: Female→Male should NOT match with Female→Female', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Female looking for Male
      await completeAuth(user1, 'female_wants_male@test.com', 'password123', 'female');
      
      // User 2: Female looking for Female (should NOT match with User 1)
      await completeAuth(user2, 'female_wants_female@test.com', 'password123', 'female');
      
      // Start searches
      await user1.click('button:has-text("Male")');
      await user2.click('button:has-text("Female")');
      
      // Both should stay in "Searching..." state - NO MATCH should occur
      await expect(user1.locator('text=Searching...')).toBeVisible({ timeout: 5000 });
      await expect(user2.locator('text=Searching...')).toBeVisible({ timeout: 5000 });
      
      // Wait 10 seconds - should NOT get matched
      await user1.waitForTimeout(10000);
      
      // Verify they're still searching (no match occurred)
      await expect(user1.locator('text=Searching...')).toBeVisible();
      await expect(user2.locator('text=Searching...')).toBeVisible();
      
      // Verify they did NOT reach chat state
      await expect(user1.locator('text=You\'re now chatting!')).not.toBeVisible();
      await expect(user2.locator('text=You\'re now chatting!')).not.toBeVisible();
      
      console.log('✅ EXCLUSIVITY VERIFIED: Female→Male did NOT match with Female→Female');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('POSITIVE CONTROL: Male→Female SHOULD match with Female→Male', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Male looking for Female
      await completeAuth(user1, 'male_compatible@test.com', 'password123', 'male');
      
      // User 2: Female looking for Male (SHOULD match with User 1)
      await completeAuth(user2, 'female_compatible@test.com', 'password123', 'female');
      
      // Start searches
      await user1.click('button:has-text("Female")');
      await user2.click('button:has-text("Male")');
      
      // Both should get matched quickly
      await expect(user1.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      await expect(user2.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      
      console.log('✅ POSITIVE CONTROL VERIFIED: Compatible preferences matched successfully');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('EDGE CASE: Multiple incompatible users in pool', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();
    const user3 = await context3.newPage();

    try {
      // User 1: Male looking for Female
      await completeAuth(user1, 'pool_male_f@test.com', 'password123', 'male');
      
      // User 2: Male looking for Male (incompatible with User 1)
      await completeAuth(user2, 'pool_male_m@test.com', 'password123', 'male');
      
      // User 3: Female looking for Female (incompatible with both)
      await completeAuth(user3, 'pool_female_f@test.com', 'password123', 'female');
      
      // All start searching
      await user1.click('button:has-text("Female")');
      await user2.click('button:has-text("Male")');
      await user3.click('button:has-text("Female")');
      
      // All should remain in searching state (no compatible matches)
      await user1.waitForTimeout(8000);
      
      // Verify all still searching
      await expect(user1.locator('text=Searching...')).toBeVisible();
      await expect(user2.locator('text=Searching...')).toBeVisible();
      await expect(user3.locator('text=Searching...')).toBeVisible();
      
      // None should be in chat
      await expect(user1.locator('text=You\'re now chatting!')).not.toBeVisible();
      await expect(user2.locator('text=You\'re now chatting!')).not.toBeVisible();
      await expect(user3.locator('text=You\'re now chatting!')).not.toBeVisible();
      
      console.log('✅ EDGE CASE VERIFIED: Multiple incompatible users remain in pool without matching');
      
    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });

  test('BOTH PREFERENCE: Both→Male should match with Male→Both (compatibility check)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Any gender looking for Male (using "Both" preference)
      await completeAuth(user1, 'both_wants_male@test.com', 'password123', 'female');
      
      // User 2: Male looking for Both
      await completeAuth(user2, 'male_wants_both@test.com', 'password123', 'male');
      
      // Start searches
      await user1.click('button:has-text("Male")');
      await user2.click('button:has-text("Both")');
      
      // Should match because Male→Both includes Females
      await expect(user1.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      await expect(user2.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      
      console.log('✅ BOTH PREFERENCE VERIFIED: Both logic working correctly');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});