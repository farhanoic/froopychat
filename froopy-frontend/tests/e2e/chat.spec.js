import { test, expect, chromium } from '@playwright/test';

test.describe('Chat Flow', () => {
  let browser1, browser2, context1, context2, page1, page2;

  // Helper function to complete auth flow
  async function completeAuthFlow(page, email, gender) {
    await page.goto('/auth');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'password123');
    await page.locator(`button:has-text("${gender}")`).click();
    await page.locator('button:has-text("Continue")').click();
    await expect(page).toHaveURL('/');
  }

  test.beforeAll(async () => {
    // Create two separate browser instances for testing bidirectional chat
    browser1 = await chromium.launch();
    browser2 = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser1?.close();
    await browser2?.close();
  });

  test.beforeEach(async () => {
    // Create contexts with mobile viewport
    context1 = await browser1.newContext({ 
      viewport: { width: 375, height: 667 }
    });
    context2 = await browser2.newContext({ 
      viewport: { width: 375, height: 667 }
    });
    
    page1 = await context1.newPage();
    page2 = await context2.newPage();
  });

  test.afterEach(async () => {
    await context1?.close();
    await context2?.close();
  });

  test('should match two compatible users', async () => {
    // User 1: Male looking for Female
    await completeAuthFlow(page1, 'user1@test.com', '👨');
    await page1.locator('button', { hasText: 'Female' }).first().click();
    
    // Should show searching state
    await expect(page1.locator('h2')).toContainText('Finding someone...');
    
    // User 2: Female looking for Male (compatible match)
    await completeAuthFlow(page2, 'user2@test.com', '👩');
    await page2.locator('button', { hasText: 'Male' }).first().click();
    
    // Both should transition to chat state within reasonable time
    await expect(page1.locator('button:has-text("Skip")')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('button:has-text("Skip")')).toBeVisible({ timeout: 10000 });
    
    // Both should show "Anonymous" header
    await expect(page1.locator('span:has-text("Anonymous")')).toBeVisible();
    await expect(page2.locator('span:has-text("Anonymous")')).toBeVisible();
  });

  test('should show chat interface correctly', async () => {
    // Set up a match first
    await completeAuthFlow(page1, 'chat1@test.com', '👨');
    await expect(page1.locator('h2')).toContainText('I want to chat with');
    await page1.locator('button', { hasText: 'Both' }).first().click();
    
    await completeAuthFlow(page2, 'chat2@test.com', '👩');
    await expect(page2.locator('h2')).toContainText('I want to chat with');
    await page2.locator('button', { hasText: 'Both' }).first().click();
    
    // Wait for match - both should go to chat
    await expect(page1.locator('button:has-text("Skip")')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('button:has-text("Skip")')).toBeVisible({ timeout: 10000 });
    
    // Check chat interface elements
    await expect(page1.locator('span:has-text("Anonymous")')).toBeVisible();
    await expect(page1.locator('button:has-text("Skip")')).toBeVisible();
    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible();
    
    // Should show initial chat message
    await expect(page1.locator('text=You\'re now chatting!')).toBeVisible();
    await expect(page1.locator('text=Say hi 👋')).toBeVisible();
  });

  test('should exchange messages bidirectionally', async () => {
    // Set up match
    await completeAuthFlow(page1, 'msg1@test.com', '👨');
    await page1.locator('button', { hasText: 'Female' }).first().click();
    
    await completeAuthFlow(page2, 'msg2@test.com', '👩');
    await page2.locator('button', { hasText: 'Male' }).first().click();
    
    // Wait for both to be in chat
    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    
    // User 1 sends message
    const message1 = 'Hello from user 1!';
    await page1.fill('input[placeholder="Type a message..."]', message1);
    await page1.press('input[placeholder="Type a message..."]', 'Enter');
    
    // Check message appears for user 1 (sent message - blue)
    await expect(page1.locator('.bg-royal-blue')).toContainText(message1);
    
    // Check message appears for user 2 (received message - gray)
    await expect(page2.locator('.bg-white\\/10').filter({ hasText: message1 })).toBeVisible({ timeout: 5000 });
    
    // User 2 replies
    const message2 = 'Hi back from user 2!';
    await page2.fill('input[placeholder="Type a message..."]', message2);
    await page2.press('input[placeholder="Type a message..."]', 'Enter');
    
    // Check reply appears for user 2 (sent - blue)
    await expect(page2.locator('.bg-royal-blue')).toContainText(message2);
    
    // Check reply appears for user 1 (received - gray)
    await expect(page1.locator('.bg-white\\/10').filter({ hasText: message2 })).toBeVisible({ timeout: 5000 });
  });

  test('should show message timestamps', async () => {
    // Set up match
    await completeAuthFlow(page1, 'time1@test.com', '👨');
    await page1.locator('button', { hasText: 'Both' }).first().click();
    
    await completeAuthFlow(page2, 'time2@test.com', '👩');
    await page2.locator('button', { hasText: 'Both' }).first().click();
    
    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    
    // Send a message
    await page1.fill('input[placeholder="Type a message..."]', 'Test timestamp');
    await page1.press('input[placeholder="Type a message..."]', 'Enter');
    
    // Check for timestamp (should be in HH:MM format)
    const timestampRegex = /\d{1,2}:\d{2}/;
    await expect(page1.locator('.text-xs.text-white\\/40')).toHaveText(timestampRegex);
    await expect(page2.locator('.text-xs.text-white\\/40')).toHaveText(timestampRegex, { timeout: 5000 });
  });

  test('should handle skip functionality correctly', async () => {
    // Set up match
    await completeAuthFlow(page1, 'skip1@test.com', '👨');
    
    // Wait for preferences view and click Female preference
    await expect(page1.locator('h2')).toContainText('I want to chat with');
    await page1.locator('button:has-text("Female")').first().click();
    
    await completeAuthFlow(page2, 'skip2@test.com', '👩');
    
    // Wait for preferences view and click Male preference
    await expect(page2.locator('h2')).toContainText('I want to chat with');
    await page2.locator('button:has-text("Male")').first().click();
    
    await expect(page1.locator('button:has-text("Skip")')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('button:has-text("Skip")')).toBeVisible({ timeout: 10000 });
    
    // User 1 skips
    await page1.locator('button:has-text("Skip")').click();
    
    // User 1 should return to preferences
    await expect(page1.locator('h2')).toContainText('I want to chat with');
    
    // User 2 should get an alert and return to preferences
    // Set up alert handler for user 2
    page2.on('dialog', async dialog => {
      expect(dialog.message()).toContain('partner left');
      await dialog.accept();
    });
    
    // User 2 should return to preferences after alert
    await expect(page2.locator('h2')).toContainText('I want to chat with', { timeout: 5000 });
  });

  test('should prevent empty messages', async () => {
    // Set up match
    await completeAuthFlow(page1, 'empty1@test.com', '👨');
    await page1.locator('button', { hasText: 'Both' }).first().click();
    
    await completeAuthFlow(page2, 'empty2@test.com', '👩');
    await page2.locator('button', { hasText: 'Both' }).first().click();
    
    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    
    // Try to send empty message
    await page1.press('input[placeholder="Type a message..."]', 'Enter');
    
    // Should not create any message bubbles
    const messageBubbles = page1.locator('.bg-royal-blue, .bg-white\\/10');
    const initialCount = await messageBubbles.count();
    
    // Try with spaces only
    await page1.fill('input[placeholder="Type a message..."]', '   ');
    await page1.press('input[placeholder="Type a message..."]', 'Enter');
    
    // Should still not create message bubbles
    const finalCount = await messageBubbles.count();
    expect(finalCount).toBe(initialCount);
  });

  test('should handle message length validation', async () => {
    // Set up match
    await completeAuthFlow(page1, 'long1@test.com', '👨');
    await page1.locator('button', { hasText: 'Both' }).first().click();
    
    await completeAuthFlow(page2, 'long2@test.com', '👩');
    await page2.locator('button', { hasText: 'Both' }).first().click();
    
    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    
    // Try to send message over 500 characters
    const longMessage = 'a'.repeat(501);
    
    // Set up alert handler
    page1.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Message too long');
      await dialog.accept();
    });
    
    await page1.fill('input[placeholder="Type a message..."]', longMessage);
    await page1.press('input[placeholder="Type a message..."]', 'Enter');
    
    // Message should not be sent (input should still contain the text)
    const inputValue = await page1.inputValue('input[placeholder="Type a message..."]');
    expect(inputValue.length).toBeGreaterThan(500);
  });

  test('should auto-scroll to new messages', async () => {
    // Set up match
    await completeAuthFlow(page1, 'scroll1@test.com', '👨');
    await page1.locator('button', { hasText: 'Both' }).first().click();
    
    await completeAuthFlow(page2, 'scroll2@test.com', '👩');
    await page2.locator('button', { hasText: 'Both' }).first().click();
    
    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    
    // Send multiple messages to test scrolling
    for (let i = 1; i <= 5; i++) {
      await page1.fill('input[placeholder="Type a message..."]', `Message ${i}`);
      await page1.press('input[placeholder="Type a message..."]', 'Enter');
      await page1.waitForTimeout(500); // Small delay between messages
    }
    
    // Last message should be visible (auto-scrolled)
    await expect(page1.locator('.bg-royal-blue:has-text("Message 5")')).toBeVisible();
    await expect(page2.locator('.bg-white\\/10:has-text("Message 5")')).toBeVisible();
  });

  test('should handle both users chatting simultaneously', async () => {
    // Set up match
    await completeAuthFlow(page1, 'simul1@test.com', '👨');
    await page1.locator('button', { hasText: 'Both' }).first().click();
    
    await completeAuthFlow(page2, 'simul2@test.com', '👩');
    await page2.locator('button', { hasText: 'Both' }).first().click();
    
    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    
    // Both users type simultaneously
    await page1.fill('input[placeholder="Type a message..."]', 'From user 1');
    await page2.fill('input[placeholder="Type a message..."]', 'From user 2');
    
    // Send simultaneously
    await Promise.all([
      page1.press('input[placeholder="Type a message..."]', 'Enter'),
      page2.press('input[placeholder="Type a message..."]', 'Enter')
    ]);
    
    // Both messages should appear for both users
    await expect(page1.locator('text=From user 1')).toBeVisible();
    await expect(page1.locator('text=From user 2')).toBeVisible();
    await expect(page2.locator('text=From user 1')).toBeVisible();
    await expect(page2.locator('text=From user 2')).toBeVisible();
  });

  test('should handle partner disconnect during chat', async () => {
    // Set up match
    await completeAuthFlow(page1, 'disc1@test.com', '👨');
    await page1.locator('button', { hasText: 'Both' }).first().click();
    
    await completeAuthFlow(page2, 'disc2@test.com', '👩');
    await page2.locator('button', { hasText: 'Both' }).first().click();
    
    await expect(page1.locator('input[placeholder="Type a message..."]')).toBeVisible({ timeout: 10000 });
    
    // Set up disconnect handler for page1
    page1.on('dialog', async dialog => {
      expect(dialog.message()).toContain('partner disconnected');
      await dialog.accept();
    });
    
    // Simulate disconnect by closing page2
    await page2.close();
    
    // Page1 should eventually get disconnect notification and return to preferences
    await expect(page1.locator('h2')).toContainText('I want to chat with', { timeout: 10000 });
  });
});