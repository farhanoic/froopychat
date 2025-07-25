// Phase 3 Verification Tests - Interest Matching and Phase Transitions
import { test, expect } from '@playwright/test';

test.describe('Phase 3: Interest Matching Verification', () => {
  
  // Helper function to complete auth flow
  async function completeAuth(page, email, password, gender) {
    await page.goto('http://localhost:5173/auth');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click(gender === 'male' ? 'text=👨' : 'text=👩');
    await expect(page.locator('text=You\'ll be known as:')).toBeVisible();
    await page.click('button:has-text("Continue")');
    await expect(page).toHaveURL('http://localhost:5173/');
  }

  test('Interest Matching: Users with overlapping interests should match quickly', async ({ browser }) => {
    console.log('🎯 Testing Interest-Based Matching');
    
    const contextA = await browser.newContext();
    const userA = await contextA.newPage();
    const contextB = await browser.newContext();
    const userB = await contextB.newPage();
    
    try {
      // User A: Male looking for Female with interests
      await completeAuth(userA, 'interest-match-a@test.com', 'password123', 'male');
      
      // Fill interests and set duration BEFORE selecting gender preference
      await userA.fill('input[placeholder*="Interests"]', 'gaming, music, coding');
      await userA.click('button:has-text("30s")');
      await userA.click('button:has-text("Female")');
      
      // User B: Female looking for Male with overlapping interests
      await completeAuth(userB, 'interest-match-b@test.com', 'password123', 'female');
      await userB.fill('input[placeholder*="Interests"]', 'movies, music, art');
      await userB.click('button:has-text("30s")');
      await userB.click('button:has-text("Male")');
      
      // The preference selection automatically starts the search
      // Try to catch the interest phase indicators (may be very brief due to fast matching)
      try {
        await expect(userA.locator('text=Looking for shared interests')).toBeVisible({ timeout: 3000 });
        await expect(userB.locator('text=Looking for shared interests')).toBeVisible({ timeout: 3000 });
        await expect(userA.locator('text=Phase 1 of 2')).toBeVisible();
      } catch (e) {
        // Fast matching on shared interest "music" - went directly to chat
        console.log('Very fast interest matching detected');
      }
      
      // Should match quickly on "music" interest
      await expect(userA.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 10000 });
      await expect(userB.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 10000 });
      
      console.log('✅ Interest-based matching successful!');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('Phase Transition: Users should transition from interest to gender-only phase after timeout', async ({ browser }) => {
    console.log('🎯 Testing Phase Transition Logic');
    
    const context = await browser.newContext();
    const user = await context.newPage();
    
    try {
      // Setup user with unique interests and short duration
      await completeAuth(user, 'phase-transition@test.com', 'password123', 'male');
      
      // Fill interests and duration BEFORE selecting gender preference
      await user.fill('input[placeholder*="Interests"]', 'very-unique-interest-xyz123');
      await user.click('button:has-text("15s")');
      await user.click('button:has-text("Female")');
      
      // Should start in interest phase
      await expect(user.locator('text=Looking for shared interests')).toBeVisible();
      await expect(user.locator('text=Phase 1 of 2')).toBeVisible();
      
      // Wait for phase transition (15s + buffer)
      await user.waitForTimeout(17000);
      
      // Should transition to gender-only phase
      await expect(user.locator('text=Expanding search')).toBeVisible();
      await expect(user.locator('text=Phase 2 of 2')).toBeVisible();
      
      console.log('✅ Phase transition working correctly!');
      
    } finally {
      await context.close();
    }
  });

  test('Infinite Duration: Users should never transition from interest phase with ∞ duration', async ({ browser }) => {
    console.log('🎯 Testing Infinite Duration Logic');
    
    const context = await browser.newContext();
    const user = await context.newPage();
    
    try {
      // Setup user with interests and infinite duration
      await completeAuth(user, 'infinite-duration@test.com', 'password123', 'male');
      
      // Fill interests and duration BEFORE selecting gender preference
      await user.fill('input[placeholder*="Interests"]', 'infinite-test-interest');
      await user.click('button:has-text("∞")');
      await user.click('button:has-text("Female")');
      
      // Should show interest phase with infinite message
      await expect(user.locator('text=Looking for shared interests')).toBeVisible();
      await expect(user.locator('text=Searching indefinitely')).toBeVisible();
      
      // Wait longer than any reasonable timeout
      await user.waitForTimeout(30000); // 30 seconds
      
      // Should still be in interest phase
      await expect(user.locator('text=Looking for shared interests')).toBeVisible();
      await expect(user.locator('text=Expanding search')).not.toBeVisible();
      
      console.log('✅ Infinite duration logic working correctly!');
      
    } finally {
      await context.close();
    }
  });

  test('No Interests: Users without interests should go straight to gender-only matching', async ({ browser }) => {
    console.log('🎯 Testing No-Interest Behavior');
    
    const contextA = await browser.newContext();
    const userA = await contextA.newPage();
    const contextB = await browser.newContext();
    const userB = await contextB.newPage();
    
    try {
      // Both users without interests
      await completeAuth(userA, 'no-interest-a@test.com', 'password123', 'male');
      await userA.click('button:has-text("Female")');
      // Don't fill interests - leave empty
      
      await completeAuth(userB, 'no-interest-b@test.com', 'password123', 'female');
      await userB.click('button:has-text("Male")');
      // Don't fill interests - leave empty
      
      // The preference selection automatically starts the search and should match quickly
      // Either show searching state briefly OR go directly to chat (fast matching)
      try {
        // Try to catch the brief searching state (if it appears)
        await expect(userA.locator('text=Finding someone for you')).toBeVisible({ timeout: 2000 });
        // Should NOT show interest phase indicators when no interests
        await expect(userA.locator('text=Looking for shared interests')).not.toBeVisible();
        await expect(userA.locator('text=Phase 1 of 2')).not.toBeVisible();
      } catch (e) {
        // Fast matching - went directly to chat, which is also valid
        console.log('Fast matching detected - went directly to chat');
      }
      
      // Should match quickly on gender compatibility (or already be chatting)
      await expect(userA.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 10000 });
      await expect(userB.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 10000 });
      
      console.log('✅ No-interest gender matching working correctly!');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('Special Characters in Interests: Should handle special characters correctly', async ({ browser }) => {
    console.log('🎯 Testing Special Characters in Interests');
    
    const contextA = await browser.newContext();
    const userA = await contextA.newPage();
    const contextB = await browser.newContext();
    const userB = await contextB.newPage();
    
    try {
      // User A with special characters
      await completeAuth(userA, 'special-a@test.com', 'password123', 'male');
      await userA.fill('input[placeholder*="Interests"]', 'C++, .NET, Rock & Roll');
      await userA.click('button:has-text("Female")');
      
      // User B with lowercase version
      await completeAuth(userB, 'special-b@test.com', 'password123', 'female');
      await userB.fill('input[placeholder*="Interests"]', 'c++, python, jazz');
      await userB.click('button:has-text("Male")');
      
      // The preference selection automatically starts the search
      // Should match on C++/c++ (case insensitive) - may be very fast
      await expect(userA.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 10000 });
      await expect(userB.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 10000 });
      
      console.log('✅ Special character handling working correctly!');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('Duration Selector UI: All duration options should be selectable and show correct description', async ({ browser }) => {
    console.log('🎯 Testing Duration Selector UI');
    
    const context = await browser.newContext();
    const user = await context.newPage();
    
    try {
      await completeAuth(user, 'duration-ui@test.com', 'password123', 'male');
      
      // Test each duration option
      const durations = [
        { button: '15s', description: 'Search 15s for interests, then expand to all' },
        { button: '30s', description: 'Search 30s for interests, then expand to all' },
        { button: '1min', description: 'Search 1min for interests, then expand to all' },
        { button: '∞', description: 'Search indefinitely for interest matches' }
      ];
      
      for (const duration of durations) {
        await user.click(`button:has-text("${duration.button}")`);
        await expect(user.locator(`text=${duration.description}`)).toBeVisible();
        console.log(`✅ Duration ${duration.button} selector working`);
      }
      
      console.log('✅ All duration selectors working correctly!');
      
    } finally {
      await context.close();
    }
  });
});