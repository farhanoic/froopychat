// Simple focused test to verify real matching functionality
import { test, expect } from '@playwright/test';

test.describe('Real Matching Functionality Verification', () => {
  
  test('Core Matching Test: Two Users Get Matched and Chat', async ({ browser }) => {
    // Create two separate browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Complete auth (Male looking for Female)
      await user1.goto('http://localhost:5173/auth');
      await user1.fill('input[type="email"]', 'testuser1@example.com');
      await user1.fill('input[type="password"]', 'password123');
      await user1.click('text=👨');
      await user1.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
      await user1.click('button:has-text("Continue")');
      await user1.waitForURL('http://localhost:5173/');

      // User 2: Complete auth (Female looking for Male)  
      await user2.goto('http://localhost:5173/auth');
      await user2.fill('input[type="email"]', 'testuser2@example.com');
      await user2.fill('input[type="password"]', 'password123');
      await user2.click('text=👩');
      await user2.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
      await user2.click('button:has-text("Continue")');
      await user2.waitForURL('http://localhost:5173/');

      // Start search for User 1 (Male looking for Female)
      await user1.click('button:has-text("Female")');
      
      // Start search for User 2 (Female looking for Male)  
      await user2.click('button:has-text("Male")');

      // Wait for match - both should see "You're now chatting!"
      await expect(user1.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      await expect(user2.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });

      console.log('✅ MATCH SUCCESSFUL - Both users matched!');

      // Test message exchange
      const input1 = user1.locator('input[placeholder="Type a message..."]');
      const input2 = user2.locator('input[placeholder="Type a message..."]');

      // User 1 sends message
      await input1.fill('Hello from User 1!');
      await input1.press('Enter');

      // Both users should see the message
      await expect(user1.locator('text=Hello from User 1!')).toBeVisible({ timeout: 5000 });
      await expect(user2.locator('text=Hello from User 1!')).toBeVisible({ timeout: 5000 });

      console.log('✅ MESSAGE EXCHANGE SUCCESSFUL - User 1 → User 2');

      // User 2 sends message
      await input2.fill('Hello from User 2!');
      await input2.press('Enter');

      // Both users should see the message
      await expect(user1.locator('text=Hello from User 2!')).toBeVisible({ timeout: 5000 });
      await expect(user2.locator('text=Hello from User 2!')).toBeVisible({ timeout: 5000 });

      console.log('✅ MESSAGE EXCHANGE SUCCESSFUL - User 2 → User 1');

      // Test typing indicators
      await input1.focus();
      await input1.type('Testing typing...');
      
      // User 2 should see typing indicator
      await expect(user2.locator('text=Someone is typing...')).toBeVisible({ timeout: 5000 });
      
      console.log('✅ TYPING INDICATORS WORKING');

      // Clear input and wait for typing to stop
      await input1.clear();
      await user1.waitForTimeout(3000);
      await expect(user2.locator('text=Someone is typing...')).not.toBeVisible();

      console.log('✅ TYPING INDICATORS STOP WORKING');

      // Test successful - all core functionality verified
      console.log('🎉 ALL CORE FEATURES VERIFIED SUCCESSFULLY!');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Quick Match Test: Both looking for Both', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Male looking for Both
      await user1.goto('http://localhost:5173/auth');
      await user1.fill('input[type="email"]', 'quick1@example.com');
      await user1.fill('input[type="password"]', 'password123');
      await user1.click('text=👨');
      await user1.waitForSelector('button:has-text("Continue")');
      await user1.click('button:has-text("Continue")');
      
      // User 2: Female looking for Both
      await user2.goto('http://localhost:5173/auth');
      await user2.fill('input[type="email"]', 'quick2@example.com');
      await user2.fill('input[type="password"]', 'password123');
      await user2.click('text=👩');
      await user2.waitForSelector('button:has-text("Continue")');
      await user2.click('button:has-text("Continue")');

      // Both search for "Both"
      await user1.click('button:has-text("Both")');
      await user2.click('button:has-text("Both")');

      // Should match quickly
      await expect(user1.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 10000 });

      console.log('✅ BOTH→BOTH MATCHING SUCCESSFUL');

      // Quick message test
      const input1 = user1.locator('input[placeholder="Type a message..."]');
      await input1.fill('Both test message');
      await input1.press('Enter');
      
      await expect(user2.locator('text=Both test message')).toBeVisible({ timeout: 5000 });
      
      console.log('✅ BOTH→BOTH CHAT SUCCESSFUL');

    } finally {
      await context1.close();
      await context2.close();
    }
  });
});