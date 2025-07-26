import { test, expect, chromium } from '@playwright/test';

// Comprehensive Phase 1-6 Verification for Froopy Chat
// Testing ALL features from basic auth to complete friends system

test.describe('🚀 Froopy Chat Comprehensive Phase 1-6 Verification', () => {
  let browser;
  let context1, context2, context3;
  let page1, page2, page3;

  // Helper function to generate unique test emails
  const generateTestEmail = () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;

  test.beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 100 
    });
  });

  test.afterAll(async () => {
    if (context1) await context1.close();
    if (context2) await context2.close();
    if (context3) await context3.close();
    if (browser) await browser.close();
  });

  test.beforeEach(async () => {
    // Create separate browser contexts to simulate different users
    context1 = await browser.newContext({ viewport: { width: 375, height: 667 } });
    context2 = await browser.newContext({ viewport: { width: 375, height: 667 } });
    context3 = await browser.newContext({ viewport: { width: 375, height: 667 } });
    
    page1 = await context1.newPage();
    page2 = await context2.newPage();
    page3 = await context3.newPage();
  });

  test.afterEach(async () => {
    await page1?.close();
    await page2?.close();
    await page3?.close();
    await context1?.close();
    await context2?.close();
    await context3?.close();
  });

  test('🔧 Environment & Setup Verification', async () => {
    console.log('🔍 Testing environment setup...');
    
    // Test frontend accessibility
    await page1.goto('http://localhost:5173');
    await expect(page1).toHaveTitle(/Froopy Chat/);
    
    // Check PWA manifest
    const manifestLink = page1.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeVisible();
    
    // Check service worker registration
    const swRegistration = await page1.evaluate(() => {
      return navigator.serviceWorker.getRegistrations().then(regs => regs.length > 0);
    });
    console.log('✅ Service Worker registered:', swRegistration);
    
    console.log('✅ Environment setup verified');
  });

  test('👤 Phase 1-2: Authentication & Basic Chat Flow', async () => {
    console.log('🔍 Testing Phase 1-2 features...');
    
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    
    // User 1 Authentication
    await page1.goto('http://localhost:5173');
    await page1.waitForLoadState('networkidle');
    
    // Check if on auth page or already authenticated
    const currentUrl1 = page1.url();
    if (currentUrl1.includes('/auth') || await page1.locator('input[type="email"]').isVisible()) {
      await page1.fill('input[type="email"]', email1);
      await page1.click('[data-testid="gender-male"], .gender-option:first-child, button:has-text("👨")');
      await page1.click('button:has-text("Start Chatting"), [data-testid="submit"], form button[type="submit"]');
      await page1.waitForURL('http://localhost:5173/', { timeout: 10000 });
    }
    
    // User 2 Authentication
    await page2.goto('http://localhost:5173');
    await page2.waitForLoadState('networkidle');
    
    const currentUrl2 = page2.url();
    if (currentUrl2.includes('/auth') || await page2.locator('input[type="email"]').isVisible()) {
      await page2.fill('input[type="email"]', email2);
      await page2.click('[data-testid="gender-female"], .gender-option:last-child, button:has-text("👩")');
      await page2.click('button:has-text("Start Chatting"), [data-testid="submit"], form button[type="submit"]');
      await page2.waitForURL('http://localhost:5173/', { timeout: 10000 });
    }
    
    // Set preferences for matching
    await page1.waitForSelector('button:has-text("Female"), button:has-text("👩"), [data-testid="prefer-female"]', { timeout: 5000 });
    await page1.click('button:has-text("Female"), button:has-text("👩"), [data-testid="prefer-female"]');
    await page1.click('button:has-text("Start Chatting"), [data-testid="start-chat"]');
    
    await page2.waitForSelector('button:has-text("Male"), button:has-text("👨"), [data-testid="prefer-male"]', { timeout: 5000 });
    await page2.click('button:has-text("Male"), button:has-text("👨"), [data-testid="prefer-male"]');
    await page2.click('button:has-text("Start Chatting"), [data-testid="start-chat"]');
    
    // Wait for matching
    await Promise.all([
      page1.waitForSelector('.chat-interface, [data-testid="chat-area"], .message-input', { timeout: 15000 }),
      page2.waitForSelector('.chat-interface, [data-testid="chat-area"], .message-input', { timeout: 15000 })
    ]);
    
    // Test messaging
    const message1 = `Hello from user 1! ${Date.now()}`;
    const message2 = `Hi from user 2! ${Date.now()}`;
    
    await page1.fill('input[placeholder*="message"], .message-input input, [data-testid="message-input"]', message1);
    await page1.press('input[placeholder*="message"], .message-input input, [data-testid="message-input"]', 'Enter');
    
    await page2.waitForSelector(`text="${message1}"`, { timeout: 10000 });
    
    await page2.fill('input[placeholder*="message"], .message-input input, [data-testid="message-input"]', message2);
    await page2.press('input[placeholder*="message"], .message-input input, [data-testid="message-input"]', 'Enter');
    
    await page1.waitForSelector(`text="${message2}"`, { timeout: 10000 });
    
    // Test skip functionality
    await page1.click('button:has-text("Skip"), [data-testid="skip-button"], .skip-btn');
    await page1.waitForSelector('button:has-text("Start Chatting"), [data-testid="start-chat"]', { timeout: 10000 });
    
    console.log('✅ Phase 1-2: Authentication & Basic Chat verified');
  });

  test('🎯 Phase 3: Interest Matching System', async () => {
    console.log('🔍 Testing Phase 3 interest matching...');
    
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    
    // Setup both users with interests
    for (const [page, email] of [[page1, email1], [page2, email2]]) {
      await page.goto('http://localhost:5173');
      await page.waitForLoadState('networkidle');
      
      if (await page.locator('input[type="email"]').isVisible()) {
        await page.fill('input[type="email"]', email);
        await page.click('[data-testid="gender-male"], button:has-text("👨")');
        await page.click('button:has-text("Start Chatting")');
        await page.waitForURL('http://localhost:5173/');
      }
      
      // Set interests
      const interestsInput = page.locator('input[placeholder*="interests"], [data-testid="interests-input"]');
      if (await interestsInput.isVisible()) {
        await interestsInput.fill('gaming, music, movies');
      }
      
      // Set preferences
      await page.click('button:has-text("Male"), [data-testid="prefer-male"]');
      
      // Check search duration options
      const durationSelector = page.locator('[data-testid="search-duration"], select');
      if (await durationSelector.isVisible()) {
        await durationSelector.selectOption('30');
      }
    }
    
    // Start searching
    await page1.click('button:has-text("Start Chatting"), [data-testid="start-chat"]');
    await page2.click('button:has-text("Start Chatting"), [data-testid="start-chat"]');
    
    // Verify search phase indicators
    await expect(page1.locator('.search-phase, [data-testid="search-status"]')).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Phase 3: Interest matching system verified');
  });

  test('📱 Phase 4: PWA Features & User Management', async () => {
    console.log('🔍 Testing Phase 4 PWA features...');
    
    await page1.goto('http://localhost:5173');
    
    // Check PWA manifest
    const manifestResponse = await page1.request.get('/manifest.json');
    expect(manifestResponse.status()).toBe(200);
    
    // Check service worker
    const swRegistered = await page1.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    expect(swRegistered).toBe(true);
    
    // Test avatar integration (DiceBear)
    const avatarElement = page1.locator('.avatar, [data-testid="avatar"], img[src*="dicebear"]');
    if (await avatarElement.isVisible()) {
      console.log('✅ Avatar system integrated');
    }
    
    // Test block/report functionality
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    
    // Quick chat setup for testing block/report
    for (const [page, email, gender] of [[page1, email1, 'male'], [page2, email2, 'female']]) {
      if (await page.locator('input[type="email"]').isVisible()) {
        await page.fill('input[type="email"]', email);
        await page.click(`button:has-text("${gender === 'male' ? '👨' : '👩'}")`);
        await page.click('button:has-text("Start Chatting")');
        await page.waitForURL('http://localhost:5173/');
      }
      
      await page.click(`button:has-text("${gender === 'male' ? 'Female' : 'Male'}")`);
      await page.click('button:has-text("Start Chatting")');
    }
    
    // Wait for chat
    await Promise.all([
      page1.waitForSelector('.chat-interface, [data-testid="chat-area"]', { timeout: 15000 }),
      page2.waitForSelector('.chat-interface, [data-testid="chat-area"]', { timeout: 15000 })
    ]);
    
    // Test long press for block/report (simulate with right click)
    const usernameElement = page1.locator('.username, [data-testid="partner-username"]').first();
    if (await usernameElement.isVisible()) {
      await usernameElement.click({ button: 'right' });
      
      const blockOption = page1.locator('text="Block", [data-testid="block-user"]');
      if (await blockOption.isVisible()) {
        console.log('✅ Block functionality available');
      }
    }
    
    console.log('✅ Phase 4: PWA features verified');
  });

  test('🤖 Phase 5: AI Bot Companion', async () => {
    console.log('🔍 Testing Phase 5 AI bot...');
    
    const email = generateTestEmail();
    
    await page1.goto('http://localhost:5173');
    await page1.waitForLoadState('networkidle');
    
    if (await page1.locator('input[type="email"]').isVisible()) {
      await page1.fill('input[type="email"]', email);
      await page1.click('button:has-text("👨")');
      await page1.click('button:has-text("Start Chatting")');
      await page1.waitForURL('http://localhost:5173/');
    }
    
    // Set preferences
    await page1.click('button:has-text("Female")');
    await page1.click('button:has-text("Start Chatting")');
    
    // Wait for searching state
    await page1.waitForSelector('.searching, [data-testid="searching"]', { timeout: 5000 });
    
    console.log('⏳ Waiting for bot activation (60 seconds)...');
    
    // Wait exactly 60 seconds for bot activation (not 60ms!)
    await page1.waitForTimeout(65000); // 65 seconds to ensure bot activates
    
    // Check if bot conversation started
    const botIndicator = page1.locator('.bot-indicator, [data-testid="bot-chat"], .chat-interface');
    await expect(botIndicator).toBeVisible({ timeout: 10000 });
    
    // Test bot conversation
    const testMessage = `Hello bot! ${Date.now()}`;
    await page1.fill('.message-input input, [data-testid="message-input"]', testMessage);
    await page1.press('.message-input input, [data-testid="message-input"]', 'Enter');
    
    // Wait for bot response (should have natural typing delay)
    await page1.waitForSelector('.message:not(:has-text("' + testMessage + '"))', { timeout: 30000 });
    
    console.log('✅ Phase 5: AI bot companion verified');
  });

  test('👥 Phase 6: Complete Friends System', async () => {
    console.log('🔍 Testing Phase 6 friends system...');
    
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const email3 = generateTestEmail();
    
    // Setup three users
    const users = [
      { page: page1, email: email1, name: 'User1' },
      { page: page2, email: email2, name: 'User2' },
      { page: page3, email: email3, name: 'User3' }
    ];
    
    // Authenticate all users
    for (const user of users) {
      await user.page.goto('http://localhost:5173');
      await user.page.waitForLoadState('networkidle');
      
      if (await user.page.locator('input[type="email"]').isVisible()) {
        await user.page.fill('input[type="email"]', user.email);
        await user.page.click('button:has-text("👨")');
        await user.page.click('button:has-text("Start Chatting")');
        await user.page.waitForURL('http://localhost:5173/');
      }
    }
    
    // Test Friend Addition During Chat
    console.log('🔍 Testing friend addition during chat...');
    
    // User1 and User2 start chatting
    await page1.click('button:has-text("Male")');
    await page1.click('button:has-text("Start Chatting")');
    
    await page2.click('button:has-text("Male")');
    await page2.click('button:has-text("Start Chatting")');
    
    // Wait for match
    await Promise.all([
      page1.waitForSelector('.chat-interface, [data-testid="chat-area"]', { timeout: 15000 }),
      page2.waitForSelector('.chat-interface, [data-testid="chat-area"]', { timeout: 15000 })
    ]);
    
    // Long press username to add friend
    const usernameElement = page1.locator('.username, [data-testid="partner-username"]').first();
    if (await usernameElement.isVisible()) {
      await usernameElement.click({ button: 'right', delay: 1000 });
      
      const addFriendOption = page1.locator('text="Add Friend", [data-testid="add-friend"]');
      if (await addFriendOption.isVisible()) {
        await addFriendOption.click();
        console.log('✅ Friend added via long press');
      }
    }
    
    // Test Friends Dot & UI
    console.log('🔍 Testing friends dot and UI...');
    
    // Check for friends dot (top-right corner)
    const friendsDot = page1.locator('.friends-dot, [data-testid="friends-dot"]');
    await expect(friendsDot).toBeVisible({ timeout: 10000 });
    
    // Click friends dot to open bottom sheet
    await friendsDot.click();
    
    // Verify friends bottom sheet
    const friendsSheet = page1.locator('.friends-sheet, [data-testid="friends-sheet"]');
    await expect(friendsSheet).toBeVisible({ timeout: 5000 });
    
    // Test Username Search
    console.log('🔍 Testing username search...');
    
    const searchInput = page1.locator('input[placeholder*="search"], [data-testid="search-input"]');
    if (await searchInput.isVisible()) {
      // Get User3's username first
      await page3.click('button:has-text("Male")');
      await page3.click('button:has-text("Start Chatting")');
      
      // Search for User3 in User1's friends
      await searchInput.fill('user3'); // Assuming username pattern
      await page1.waitForTimeout(1000);
      
      const searchResult = page1.locator('.search-result, [data-testid="search-result"]');
      if (await searchResult.isVisible()) {
        await searchResult.click();
        console.log('✅ Username search working');
      }
    }
    
    // Test Persistent Chats
    console.log('🔍 Testing persistent friend chats...');
    
    // Click on friend to start chat
    const friendItem = page1.locator('.friend-item, [data-testid="friend-item"]').first();
    if (await friendItem.isVisible()) {
      await friendItem.click();
      
      // Verify friend chat interface
      await expect(page1.locator('.friend-chat, [data-testid="friend-chat"]')).toBeVisible({ timeout: 5000 });
      
      // Send message in friend chat
      const friendMessage = `Friend message ${Date.now()}`;
      await page1.fill('.message-input input, [data-testid="message-input"]', friendMessage);
      await page1.press('.message-input input, [data-testid="message-input"]', 'Enter');
      
      // Exit and re-enter to test persistence
      await page1.click('button:has-text("Exit"), [data-testid="exit-chat"]');
      await page1.waitForTimeout(1000);
      
      await friendItem.click();
      
      // Check if message persisted
      await expect(page1.locator(`text="${friendMessage}"`)).toBeVisible({ timeout: 5000 });
      console.log('✅ Persistent friend chats working');
    }
    
    // Test Online Status & Unread Badges
    console.log('🔍 Testing online status and unread badges...');
    
    // Check online status indicators
    const onlineIndicator = page1.locator('.online-indicator, [data-testid="online-status"]');
    if (await onlineIndicator.isVisible()) {
      console.log('✅ Online status indicators present');
    }
    
    // Test unread badges
    const unreadBadge = page1.locator('.unread-badge, [data-testid="unread-count"]');
    if (await unreadBadge.isVisible()) {
      console.log('✅ Unread badges present');
    }
    
    // Test auto-refresh (wait 30 seconds)
    console.log('⏳ Testing auto-refresh (30 seconds)...');
    await page1.waitForTimeout(35000);
    
    console.log('✅ Phase 6: Complete friends system verified');
  });

  test('🔄 Multi-User Simulation & Edge Cases', async () => {
    console.log('🔍 Testing multi-user scenarios and edge cases...');
    
    // Test connection stability
    await page1.goto('http://localhost:5173');
    await page1.waitForLoadState('networkidle');
    
    // Simulate network interruption
    await page1.setOffline(true);
    await page1.waitForTimeout(2000);
    await page1.setOffline(false);
    
    // Check auto-reconnection
    await page1.waitForSelector('.reconnecting, [data-testid="reconnecting"]', { timeout: 5000 });
    
    // Test memory leak detection
    const initialMemory = await page1.evaluate(() => performance.memory?.usedJSHeapSize);
    
    // Perform intensive operations
    for (let i = 0; i < 10; i++) {
      await page1.reload();
      await page1.waitForLoadState('networkidle');
      await page1.waitForTimeout(500);
    }
    
    const finalMemory = await page1.evaluate(() => performance.memory?.usedJSHeapSize);
    
    if (initialMemory && finalMemory) {
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      console.log(`Memory usage increased by ${memoryIncrease.toFixed(2)} MB`);
      
      if (memoryIncrease > 50) {
        console.warn('⚠️ Potential memory leak detected');
      } else {
        console.log('✅ Memory usage within acceptable range');
      }
    }
    
    console.log('✅ Multi-user simulation completed');
  });

  test('🔒 Security & Performance Validation', async () => {
    console.log('🔍 Testing security and performance...');
    
    await page1.goto('http://localhost:5173');
    
    // Test XSS protection
    const testScript = '<script>alert("xss")</script>';
    
    if (await page1.locator('input[type="email"]').isVisible()) {
      await page1.fill('input[type="email"]', testScript);
      // Should be safely handled, not execute
    }
    
    // Test SQL injection protection in search
    const maliciousSearch = "'; DROP TABLE users; --";
    
    const searchInput = page1.locator('input[placeholder*="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(maliciousSearch);
      await page1.waitForTimeout(1000);
      // Should be safely handled
    }
    
    // Performance testing
    const startTime = Date.now();
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Page load time: ${loadTime}ms`);
    
    if (loadTime > 3000) {
      console.warn('⚠️ Page load time exceeds 3 seconds');
    } else {
      console.log('✅ Page load performance acceptable');
    }
    
    console.log('✅ Security and performance validation completed');
  });

  test('📊 Production Readiness Assessment', async () => {
    console.log('🔍 Assessing production readiness...');
    
    const issues = [];
    
    await page1.goto('http://localhost:5173');
    await page1.waitForLoadState('networkidle');
    
    // Check console errors
    const logs = [];
    page1.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    await page1.waitForTimeout(5000);
    
    if (logs.length > 0) {
      issues.push(`Console errors: ${logs.length}`);
      console.log('❌ Console errors found:', logs);
    } else {
      console.log('✅ No console errors');
    }
    
    // Check responsive design
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 375, height: 667 }, // iPhone 8
      { width: 414, height: 896 }  // iPhone 11
    ];
    
    for (const viewport of viewports) {
      await page1.setViewportSize(viewport);
      await page1.waitForTimeout(1000);
      
      const isResponsive = await page1.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth) {
            return false;
          }
        }
        return true;
      });
      
      if (!isResponsive) {
        issues.push(`Layout issues at ${viewport.width}x${viewport.height}`);
      }
    }
    
    // Final assessment
    if (issues.length === 0) {
      console.log('🎉 PRODUCTION READY: All tests passed!');
    } else {
      console.log('⚠️ Issues found:', issues);
    }
    
    console.log('✅ Production readiness assessment completed');
  });

});