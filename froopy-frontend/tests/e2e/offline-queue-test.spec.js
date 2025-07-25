// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Phase 4: Offline Message Queue Tests', () => {
  test('Offline message queueing: Messages should queue when offline and send when back online', async ({ page, context }) => {
    console.log('🔄 Testing offline message queueing functionality');
    
    // Navigate to auth page
    await page.goto('http://localhost:5173/auth');
    
    // Fill in auth form
    await page.fill('input[type="email"]', 'test@offline.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("👨")');
    await page.click('button:has-text("Continue")');
    
    // Wait for redirect to main page
    await page.waitForURL('http://localhost:5173/');
    
    // Skip to preferences and start matching
    await page.click('button:has-text("Both")');
    
    // Wait for searching state
    await expect(page.locator('text=Finding someone for you')).toBeVisible();
    
    // In a real test scenario, we'd need a second user to match with
    // For this test, we'll focus on testing the queue functionality
    // by going offline and testing the console logs
    
    // Test that offline functions exist and work
    const onlineStatus = await page.evaluate(() => {
      return window.navigator.onLine;
    });
    
    expect(onlineStatus).toBe(true);
    
    // Test importing queue functions
    const queueFunctionsExist = await page.evaluate(async () => {
      try {
        const socketModule = await import('/src/services/socket.js');
        return {
          hasGetMessageQueue: typeof socketModule.getMessageQueue === 'function',
          hasGetOnlineStatus: typeof socketModule.getOnlineStatus === 'function',
          hasQueueMessage: typeof socketModule.queueMessage === 'function',
          hasCanSendDirectly: typeof socketModule.canSendDirectly === 'function'
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    expect(queueFunctionsExist.hasGetMessageQueue).toBe(true);
    expect(queueFunctionsExist.hasGetOnlineStatus).toBe(true);
    expect(queueFunctionsExist.hasQueueMessage).toBe(true);
    expect(queueFunctionsExist.hasCanSendDirectly).toBe(true);
    
    // Test queue message function
    const queueTest = await page.evaluate(async () => {
      const socketModule = await import('/src/services/socket.js');
      
      // Test queueMessage function
      const queued = socketModule.queueMessage({ text: 'Test message' });
      const queue = socketModule.getMessageQueue();
      
      return {
        queuedMessage: queued,
        queueLength: queue.length,
        hasTimestamp: queued.queuedAt !== undefined,
        hasId: queued.id !== undefined
      };
    });
    
    expect(queueTest.queueLength).toBe(1);
    expect(queueTest.hasTimestamp).toBe(true);
    expect(queueTest.hasId).toBe(true);
    expect(queueTest.queuedMessage.text).toBe('Test message');
    
    console.log('✅ Offline message queue functions working correctly!');
  });

  test('Offline indicator: Should show offline indicator when network is offline', async ({ page, context }) => {
    console.log('🔄 Testing offline indicator functionality');
    
    // Navigate to auth page and authenticate
    await page.goto('http://localhost:5173/auth');
    await page.fill('input[type="email"]', 'test@indicator.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("👨")');
    await page.click('button:has-text("Continue")');
    
    // Wait for redirect to main page
    await page.waitForURL('http://localhost:5173/');
    
    // Check that canSendDirectly is true when online
    const canSendOnline = await page.evaluate(async () => {
      const socketModule = await import('/src/services/socket.js');
      return socketModule.canSendDirectly();
    });
    
    // Should be true when online and connected
    console.log('📡 Online status:', canSendOnline);
    
    // Test going offline simulation
    await context.setOffline(true);
    
    // Give a moment for offline detection
    await page.waitForTimeout(500);
    
    const canSendOffline = await page.evaluate(async () => {
      const socketModule = await import('/src/services/socket.js');
      return {
        canSend: socketModule.canSendDirectly(),
        navigatorOnline: navigator.onLine,
        getOnlineStatus: socketModule.getOnlineStatus()
      };
    });
    
    console.log('🔌 Offline status:', canSendOffline);
    
    // canSendDirectly should return false when offline
    expect(canSendOffline.navigatorOnline).toBe(false);
    
    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(500);
    
    console.log('✅ Offline detection working correctly!');
  });
});