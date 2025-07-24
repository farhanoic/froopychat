// Comprehensive Two-User E2E Tests - Real Matching and Chat Flow
// Tests all matching combinations and complete chat functionality
import { test, expect } from '@playwright/test';

test.describe('Comprehensive Two-User Real-Time Testing', () => {
  
  // Helper function to complete auth flow for a user
  async function completeAuth(page, email, password, gender) {
    await page.goto('http://localhost:5173/auth');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    // Select gender
    const genderButton = gender === 'male' ? 'text=👨' : 'text=👩';
    await page.click(genderButton);
    
    // Wait for username generation and continue
    await expect(page.locator('text=You\'ll be known as:')).toBeVisible();
    await page.click('button:has-text("Continue")');
    
    // Should be on main page
    await expect(page).toHaveURL('http://localhost:5173/');
  }

  // Helper function to start search with preference
  async function startSearch(page, preference) {
    const buttonText = preference === 'male' ? 'Male' : 
                      preference === 'female' ? 'Female' : 'Both';
    await page.click(`button:has-text("${buttonText}")`);
    await expect(page.locator('text=Searching...')).toBeVisible();
  }

  test('Matching Scenario 1: Male looking for Female + Female looking for Male', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Male looking for Female
      await completeAuth(user1, 'male1@test.com', 'password123', 'male');
      await startSearch(user1, 'female');

      // User 2: Female looking for Male  
      await completeAuth(user2, 'female1@test.com', 'password123', 'female');
      await startSearch(user2, 'male');

      // Both should get matched
      await expect(user1.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });

      // Test chat functionality
      await testChatFlow(user1, user2, 'Hello from male user', 'Hello from female user');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Matching Scenario 2: Male looking for Both + Female looking for Male', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Male looking for Both
      await completeAuth(user1, 'male2@test.com', 'password123', 'male');
      await startSearch(user1, 'both');

      // User 2: Female looking for Male
      await completeAuth(user2, 'female2@test.com', 'password123', 'female');  
      await startSearch(user2, 'male');

      // Both should get matched
      await expect(user1.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });

      // Test chat functionality
      await testChatFlow(user1, user2, 'Hello from male (both)', 'Hello from female (male)');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Matching Scenario 3: Female looking for Both + Male looking for Female', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Female looking for Both
      await completeAuth(user1, 'female3@test.com', 'password123', 'female');
      await startSearch(user1, 'both');

      // User 2: Male looking for Female
      await completeAuth(user2, 'male3@test.com', 'password123', 'male');
      await startSearch(user2, 'female');

      // Both should get matched
      await expect(user1.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });

      // Test chat functionality
      await testChatFlow(user1, user2, 'Hello from female (both)', 'Hello from male (female)');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Matching Scenario 4: Both looking for Male + Male looking for Both', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Both looking for Male
      await completeAuth(user1, 'both1@test.com', 'password123', 'female'); // Can be any gender
      await startSearch(user1, 'male');

      // User 2: Male looking for Both
      await completeAuth(user2, 'male4@test.com', 'password123', 'male');
      await startSearch(user2, 'both');

      // Both should get matched
      await expect(user1.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });

      // Test chat functionality
      await testChatFlow(user1, user2, 'Hello from both->male', 'Hello from male->both');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Matching Scenario 5: Both looking for Female + Female looking for Both', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Both looking for Female
      await completeAuth(user1, 'both2@test.com', 'password123', 'male'); // Can be any gender
      await startSearch(user1, 'female');

      // User 2: Female looking for Both
      await completeAuth(user2, 'female4@test.com', 'password123', 'female');
      await startSearch(user2, 'both');

      // Both should get matched
      await expect(user1.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });

      // Test chat functionality
      await testChatFlow(user1, user2, 'Hello from both->female', 'Hello from female->both');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Matching Scenario 6: Both looking for Both + Both looking for Both', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();  
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // User 1: Both looking for Both
      await completeAuth(user1, 'both3@test.com', 'password123', 'male');
      await startSearch(user1, 'both');

      // User 2: Both looking for Both
      await completeAuth(user2, 'both4@test.com', 'password123', 'female');
      await startSearch(user2, 'both');

      // Both should get matched
      await expect(user1.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });

      // Test chat functionality
      await testChatFlow(user1, user2, 'Hello from both->both 1', 'Hello from both->both 2');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  // Helper function to test complete chat flow between two users
  async function testChatFlow(user1, user2, message1, message2) {
    // Test typing indicators
    await testTypingIndicators(user1, user2);
    
    // Test message exchange
    await testMessageExchange(user1, user2, message1, message2);
    
    // Test swipe to skip
    await testSwipeToSkip(user1, user2);
  }

  async function testTypingIndicators(user1, user2) {
    // User1 starts typing
    const input1 = user1.locator('input[placeholder="Type a message..."]');
    await input1.focus();
    await input1.type('Test');
    
    // User2 should see typing indicator
    await expect(user2.locator('text=Someone is typing...')).toBeVisible({ timeout: 3000 });
    
    // Stop typing - indicator should disappear
    await user1.waitForTimeout(3000); // Wait for typing timeout
    await expect(user2.locator('text=Someone is typing...')).not.toBeVisible({ timeout: 5000 });
    
    // Clear the input
    await input1.clear();
  }

  async function testMessageExchange(user1, user2, message1, message2) {
    // User1 sends message
    const input1 = user1.locator('input[placeholder="Type a message..."]');
    await input1.fill(message1);
    await input1.press('Enter');
    
    // Both users should see the message
    await expect(user1.locator(`text=${message1}`)).toBeVisible({ timeout: 3000 });
    await expect(user2.locator(`text=${message1}`)).toBeVisible({ timeout: 3000 });
    
    // User2 sends message
    const input2 = user2.locator('input[placeholder="Type a message..."]');
    await input2.fill(message2);
    await input2.press('Enter');
    
    // Both users should see the message
    await expect(user1.locator(`text=${message2}`)).toBeVisible({ timeout: 3000 });
    await expect(user2.locator(`text=${message2}`)).toBeVisible({ timeout: 3000 });
  }

  async function testSwipeToSkip(user1, user2) {
    // Check swipe hint is visible
    await expect(user1.locator('text=Swipe right to skip')).toBeVisible();
    
    // Simulate swipe gesture on user1
    const chatContainer = user1.locator('.relative.flex.flex-col.h-screen.bg-dark-navy').first();
    const box = await chatContainer.boundingBox();
    
    if (box) {
      // Simulate swipe right
      await user1.mouse.move(box.x + 50, box.y + box.height / 2);
      await user1.mouse.down();
      await user1.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 10 });
      await user1.mouse.up();
      
      // User1 should return to preferences
      await expect(user1.locator('text=I want to chat with')).toBeVisible({ timeout: 5000 });
      
      // User2 should also return to preferences (partner disconnected)
      await expect(user2.locator('text=I want to chat with')).toBeVisible({ timeout: 5000 });
    }
  }

  test('Connection/Reconnection Scenarios', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // Set up match
      await completeAuth(user1, 'conn1@test.com', 'password123', 'male');
      await completeAuth(user2, 'conn2@test.com', 'password123', 'female');
      
      await startSearch(user1, 'female');
      await startSearch(user2, 'male');
      
      // Wait for match
      await expect(user1.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      
      // Send initial message
      const input1 = user1.locator('input[placeholder="Type a message..."]');
      await input1.fill('Before reconnection');
      await input1.press('Enter');
      await expect(user2.locator('text=Before reconnection')).toBeVisible();
      
      // Test reconnection by refreshing user1's page
      await user1.reload();
      
      // User1 should be redirected to auth (lost session)
      await expect(user1).toHaveURL('http://localhost:5173/auth');
      
      // User2 should eventually detect disconnection
      // (In real implementation, user2 might see connection status change)
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Complete End-to-End User Journey', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // Complete auth flows
      await completeAuth(user1, 'journey1@test.com', 'password123', 'male');
      await completeAuth(user2, 'journey2@test.com', 'password123', 'female');
      
      // Start searching
      await startSearch(user1, 'female');
      await startSearch(user2, 'male');
      
      // Get matched
      await expect(user1.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      await expect(user2.locator('text=Chatting with')).toBeVisible({ timeout: 10000 });
      
      // Exchange multiple messages
      const messages = [
        { user: user1, text: 'Hello there!' },
        { user: user2, text: 'Hi! How are you?' },
        { user: user1, text: 'Great! Nice to meet you' },
        { user: user2, text: 'Likewise! 😊' }
      ];
      
      for (const { user, text } of messages) {
        const input = user.locator('input[placeholder="Type a message..."]');
        await input.fill(text);
        await input.press('Enter');
        
        // Verify message appears in both chats
        await expect(user1.locator(`text=${text}`)).toBeVisible({ timeout: 3000 });
        await expect(user2.locator(`text=${text}`)).toBeVisible({ timeout: 3000 });
        
        await user1.waitForTimeout(500); // Small delay between messages
      }
      
      // Test typing indicators during conversation
      const input2 = user2.locator('input[placeholder="Type a message..."]');
      await input2.focus();
      await input2.type('Testing typing...');
      
      // User1 should see typing indicator
      await expect(user1.locator('text=Someone is typing...')).toBeVisible({ timeout: 3000 });
      
      // Complete the message
      await input2.press('Enter');
      await expect(user1.locator('text=Testing typing...')).toBeVisible();
      
      // User1 skips to find new match
      const chatContainer = user1.locator('.relative.flex.flex-col.h-screen.bg-dark-navy').first();
      const box = await chatContainer.boundingBox();
      
      if (box) {
        await user1.mouse.move(box.x + 50, box.y + box.height / 2);
        await user1.mouse.down();
        await user1.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 10 });
        await user1.mouse.up();
      }
      
      // Both users should return to search
      await expect(user1.locator('text=I want to chat with')).toBeVisible({ timeout: 5000 });
      await expect(user2.locator('text=I want to chat with')).toBeVisible({ timeout: 5000 });
      
      // Complete end-to-end journey successful
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});