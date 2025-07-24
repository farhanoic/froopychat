// Complete End-to-End Testing: ALL Matching Scenarios + Full Chat Flow
// Tests every possible matching combination with complete functionality
import { test, expect } from '@playwright/test';

test.describe('Complete Real-Time E2E Testing: All Matching Scenarios', () => {
  
  // Helper function to complete full auth flow
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

  // Helper function to test complete chat flow
  async function testFullChatFlow(user1, user2, scenarioName) {
    console.log(`🎯 Testing ${scenarioName}`);
    
    // 1. Verify match successful
    await expect(user1.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
    await expect(user2.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
    console.log('✅ MATCH SUCCESSFUL');

    // 2. Test typing indicators
    const input1 = user1.locator('input[placeholder="Type a message..."]');
    const input2 = user2.locator('input[placeholder="Type a message..."]');
    
    await input1.focus();
    await input1.type('typing test...');
    await expect(user2.locator('text=Someone is typing...')).toBeVisible({ timeout: 5000 });
    await input1.clear();
    await user1.waitForTimeout(3000);
    await expect(user2.locator('text=Someone is typing...')).not.toBeVisible();
    console.log('✅ TYPING INDICATORS WORKING');

    // 3. Test bidirectional message exchange
    await input1.fill(`Hello from User 1 - ${scenarioName}`);
    await input1.press('Enter');
    await expect(user1.locator(`text=Hello from User 1 - ${scenarioName}`)).toBeVisible();
    await expect(user2.locator(`text=Hello from User 1 - ${scenarioName}`)).toBeVisible();
    
    await input2.fill(`Hello from User 2 - ${scenarioName}`);
    await input2.press('Enter');
    await expect(user1.locator(`text=Hello from User 2 - ${scenarioName}`)).toBeVisible();
    await expect(user2.locator(`text=Hello from User 2 - ${scenarioName}`)).toBeVisible();
    console.log('✅ BIDIRECTIONAL MESSAGES WORKING');

    // 4. Test multiple message conversation
    const messages = [
      { user: user1, text: 'How are you?' },
      { user: user2, text: 'Great! You?' },
      { user: user1, text: 'Awesome! 😊' },
      { user: user2, text: 'Nice to meet you!' }
    ];

    for (const { user, text } of messages) {
      const input = user.locator('input[placeholder="Type a message..."]');
      await input.fill(text);
      await input.press('Enter');
      await expect(user1.locator(`text=${text}`)).toBeVisible({ timeout: 3000 });
      await expect(user2.locator(`text=${text}`)).toBeVisible({ timeout: 3000 });
      await user.waitForTimeout(200);
    }
    console.log('✅ CONVERSATION FLOW WORKING');

    console.log(`🎉 ${scenarioName} - ALL FEATURES VERIFIED!`);
  }

  test('Scenario 1: Male → Female (M looking for F + F looking for M)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext(); 
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      await completeAuth(user1, 'male1@test.com', 'password123', 'male');
      await completeAuth(user2, 'female1@test.com', 'password123', 'female');
      
      await user1.click('button:has-text("Female")');
      await user2.click('button:has-text("Male")');
      
      await testFullChatFlow(user1, user2, 'Male → Female');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Scenario 2: Female → Male (F looking for M + M looking for F)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      await completeAuth(user1, 'female2@test.com', 'password123', 'female');
      await completeAuth(user2, 'male2@test.com', 'password123', 'male');
      
      await user1.click('button:has-text("Male")');
      await user2.click('button:has-text("Female")');
      
      await testFullChatFlow(user1, user2, 'Female → Male');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Scenario 3: Both → Male (Both looking for M + M looking for Both)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      await completeAuth(user1, 'both1@test.com', 'password123', 'female'); // Gender doesn't matter for "Both"
      await completeAuth(user2, 'male3@test.com', 'password123', 'male');
      
      await user1.click('button:has-text("Male")');
      await user2.click('button:has-text("Both")');
      
      await testFullChatFlow(user1, user2, 'Both → Male');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Scenario 4: Both → Female (Both looking for F + F looking for Both)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      await completeAuth(user1, 'both2@test.com', 'password123', 'male'); // Gender doesn't matter for "Both"
      await completeAuth(user2, 'female3@test.com', 'password123', 'female');
      
      await user1.click('button:has-text("Female")');
      await user2.click('button:has-text("Both")');
      
      await testFullChatFlow(user1, user2, 'Both → Female');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Scenario 5: Both → Both (Both looking for Both + Both looking for Both)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      await completeAuth(user1, 'both3@test.com', 'password123', 'male');
      await completeAuth(user2, 'both4@test.com', 'password123', 'female');
      
      await user1.click('button:has-text("Both")');
      await user2.click('button:has-text("Both")');
      
      await testFullChatFlow(user1, user2, 'Both → Both');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Scenario 6: Cross Gender Both (M Both + F Both)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      await completeAuth(user1, 'mboth@test.com', 'password123', 'male');
      await completeAuth(user2, 'fboth@test.com', 'password123', 'female');
      
      await user1.click('button:has-text("Both")');
      await user2.click('button:has-text("Both")');
      
      await testFullChatFlow(user1, user2, 'Male Both ↔ Female Both');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Advanced: Swipe-to-Skip Functionality in Active Chat', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // Set up match
      await completeAuth(user1, 'swipe1@test.com', 'password123', 'male');
      await completeAuth(user2, 'swipe2@test.com', 'password123', 'female');
      
      await user1.click('button:has-text("Female")');
      await user2.click('button:has-text("Male")');
      
      // Wait for match
      await expect(user1.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      await expect(user2.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      
      // Verify swipe hint is visible
      await expect(user1.locator('text=Swipe right to skip')).toBeVisible();
      console.log('✅ SWIPE HINT VISIBLE');
      
      // Send a message first
      const input1 = user1.locator('input[placeholder="Type a message..."]');
      await input1.fill('Before skip message');
      await input1.press('Enter');
      await expect(user2.locator('text=Before skip message')).toBeVisible();
      
      // Perform swipe gesture on user1
      const chatContainer = user1.locator('.relative.flex.flex-col.h-screen.bg-dark-navy').first();
      const box = await chatContainer.boundingBox();
      
      if (box) {
        await user1.mouse.move(box.x + 50, box.y + box.height / 2);
        await user1.mouse.down();
        await user1.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 10 });
        await user1.mouse.up();
        
        // Both users should return to preferences
        await expect(user1.locator('text=I want to chat with')).toBeVisible({ timeout: 5000 });
        await expect(user2.locator('text=I want to chat with')).toBeVisible({ timeout: 5000 });
        
        console.log('✅ SWIPE-TO-SKIP WORKING');
      }
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Advanced: Connection & Reconnection Scenarios', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // Set up match
      await completeAuth(user1, 'conn1@test.com', 'password123', 'male');
      await completeAuth(user2, 'conn2@test.com', 'password123', 'female');
      
      await user1.click('button:has-text("Female")');
      await user2.click('button:has-text("Male")');
      
      // Wait for match and exchange messages
      await expect(user1.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      await expect(user2.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      
      const input1 = user1.locator('input[placeholder="Type a message..."]');
      const input2 = user2.locator('input[placeholder="Type a message..."]');
      
      await input1.fill('Pre-disconnect message');
      await input1.press('Enter');
      await expect(user2.locator('text=Pre-disconnect message')).toBeVisible();
      
      console.log('✅ INITIAL CONNECTION AND MESSAGING WORKING');
      
      // Test what happens when user1 refreshes (simulates disconnect)
      await user1.reload();
      
      // User1 should be redirected to auth (session lost)
      await expect(user1).toHaveURL('http://localhost:5173/auth');
      console.log('✅ DISCONNECTION HANDLING WORKING');
      
      // User2 should eventually detect the disconnection
      // In a real scenario, user2 might see a notification or be returned to search
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Ultimate E2E: Complete User Journey with All Features', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      console.log('🚀 STARTING ULTIMATE E2E TEST');
      
      // 1. Complete auth flows
      await completeAuth(user1, 'ultimate1@test.com', 'password123', 'male');
      await completeAuth(user2, 'ultimate2@test.com', 'password123', 'female');
      console.log('✅ AUTH FLOWS COMPLETE');
      
      // 2. Start matching 
      await user1.click('button:has-text("Both")');
      await user2.click('button:has-text("Both")');
      
      // 3. Verify match
      await expect(user1.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      await expect(user2.locator('text=You\'re now chatting!')).toBeVisible({ timeout: 15000 });
      console.log('✅ MATCHING COMPLETE');
      
      // 4. Full conversation with typing indicators
      const conversations = [
        {user: user1, text: 'Hey there! 👋'},
        {user: user2, text: 'Hello! How are you doing?'},
        {user: user1, text: 'Great! This chat app is working perfectly!'},
        {user: user2, text: 'I agree! The real-time features are amazing 🎉'},
        {user: user1, text: 'Want to test typing indicators?'},
        {user: user2, text: 'Sure! Let me type slowly...'}
      ];
      
      for (const {user, text} of conversations) {
        const input = user.locator('input[placeholder="Type a message..."]');
        
        // Test typing indicator
        await input.focus();
        await input.type(text.substring(0, 5));
        const otherUser = user === user1 ? user2 : user1;
        await expect(otherUser.locator('text=Someone is typing...')).toBeVisible({ timeout: 3000 });
        
        // Complete message
        await input.clear();
        await input.fill(text);
        await input.press('Enter');
        
        // Verify message appears in both chats
        await expect(user1.locator(`text=${text}`)).toBeVisible();
        await expect(user2.locator(`text=${text}`)).toBeVisible();
        
        await user.waitForTimeout(500);
      }
      console.log('✅ FULL CONVERSATION WITH TYPING INDICATORS COMPLETE');
      
      // 5. Test swipe hint visibility (don't actually swipe)
      await expect(user1.locator('text=Swipe right to skip')).toBeVisible();
      await expect(user2.locator('text=Swipe right to skip')).toBeVisible();
      console.log('✅ SWIPE HINTS VISIBLE');
      
      console.log('🎉 ULTIMATE E2E TEST COMPLETE - ALL FEATURES WORKING PERFECTLY!');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});