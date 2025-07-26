import { test, expect } from '@playwright/test';

// Test configuration
const TEST_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

// Helper to generate unique test user
const generateTestUser = () => ({
  email: `test${Date.now()}@example.com`,
  password: 'Test123!',
  gender: 'male'
});

test.describe('Phase 5: AI Bot Integration - Complete Verification', () => {
  
  test.beforeEach(async ({ page, request }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Reset bot state before each test
    try {
      await request.post(`${API_URL}/test-bot-cleanup`);
    } catch (error) {
      console.log('Bot cleanup failed (may be okay):', error.message);
    }
  });

  test('1. Gemini API endpoints are working', async ({ request }) => {
    console.log('🧪 Testing Gemini API endpoints...');
    
    // Test basic Gemini endpoint
    const geminiResponse = await request.get(`${API_URL}/test-gemini`);
    expect(geminiResponse.ok()).toBeTruthy();
    const geminiData = await geminiResponse.json();
    expect(geminiData.success).toBe(true);
    expect(geminiData.response).toBeTruthy();
    console.log('✅ Basic Gemini endpoint working');
    
    // Test Hindi endpoint
    const hindiResponse = await request.get(`${API_URL}/test-gemini-hindi`);
    expect(hindiResponse.ok()).toBeTruthy();
    const hindiData = await hindiResponse.json();
    expect(hindiData.success).toBe(true);
    expect(hindiData.response).toMatch(/[\u0900-\u097F]/); // Contains Devanagari
    console.log('✅ Hindi Gemini endpoint working');
  });

  test('2. Bot persona generation works correctly', async ({ request }) => {
    console.log('🧪 Testing bot persona generation...');
    
    const response = await request.get(`${API_URL}/test-bot-persona`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Verify persona structure
    expect(data.success).toBe(true);
    expect(data.persona).toHaveProperty('name');
    expect(data.persona).toHaveProperty('age');
    expect(data.persona).toHaveProperty('city');
    expect(data.persona).toHaveProperty('username');
    expect(data.persona).toHaveProperty('avatar');
    
    // Verify Indian names and cities
    const indianNames = ['Priya', 'Neha', 'Shreya', 'Ananya', 'Divya', 'Pooja', 'Sakshi', 'Nidhi', 'Kavya', 'Riya'];
    const indianCities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Chennai', 'Hyderabad'];
    
    expect(indianNames).toContain(data.persona.name);
    expect(indianCities).toContain(data.persona.city);
    expect(data.persona.age).toBeGreaterThanOrEqual(19);
    expect(data.persona.age).toBeLessThanOrEqual(26);
    
    // Verify avatar URL
    expect(data.persona.avatar).toContain('dicebear.com');
    expect(data.persona.avatar).toContain('backgroundColor=2563EB');
    
    console.log('✅ Bot persona generation working correctly');
    console.log(`Generated persona: ${data.persona.name}, ${data.persona.age}, ${data.persona.city}`);
  });

  test('3. Bot activates after 60 seconds of searching', async ({ page }) => {
    console.log('🧪 Testing bot activation after 60 seconds...');
    
    // Create and register test user
    const testUser = generateTestUser();
    
    // Register - two-step auth process
    await page.goto(`${TEST_URL}/auth`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    
    // Select gender (this triggers username generation)
    await page.click('button:has-text("👨")');
    
    // Wait for Continue button to appear and click it
    await expect(page.locator('button:has-text("Continue")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Continue")');
    
    // Go to main page and start searching
    await page.waitForURL(`${TEST_URL}/`);
    await page.click('input[value="female"]');
    await page.click('button:has-text("Start Chatting")');
    
    // Wait for searching state
    await expect(page.locator('text=Looking for someone')).toBeVisible();
    console.log('⏳ User is searching, waiting 61 seconds for bot activation...');
    
    // Wait 61 seconds for bot activation
    await page.waitForTimeout(61000);
    
    // Verify bot match occurred
    await expect(page.locator('.chat-header')).toBeVisible({ timeout: 5000 });
    const username = await page.locator('.chat-header p').first().textContent();
    expect(username).toBeTruthy();
    
    // Verify avatar is visible
    await expect(page.locator('.chat-header img')).toBeVisible();
    
    console.log('✅ Bot activated successfully after 60 seconds');
    console.log(`Bot matched with username: ${username}`);
    
    // Cleanup: disconnect
    await page.click('button:has-text("Skip")');
  });

  test('4. Bot conversation in Hindi/Hinglish works', async ({ request }) => {
    console.log('🧪 Testing bot conversation capabilities...');
    
    // Test Hindi conversation
    const hindiTest = await request.post(`${API_URL}/test-bot-conversation`, {
      data: { message: 'नमस्ते' }
    });
    const hindiData = await hindiTest.json();
    expect(hindiData.success).toBe(true);
    expect(hindiData.detectedLanguage).toBe('hindi');
    expect(hindiData.botResponses).toBeTruthy();
    expect(Array.isArray(hindiData.botResponses)).toBe(true);
    console.log('✅ Hindi conversation working');
    
    // Test Hinglish conversation
    const hinglishTest = await request.post(`${API_URL}/test-bot-conversation`, {
      data: { message: 'kya kar rahi ho' }
    });
    const hinglishData = await hinglishTest.json();
    expect(hinglishData.success).toBe(true);
    expect(hinglishData.detectedLanguage).toBe('hinglish');
    console.log('✅ Hinglish conversation working');
    
    // Verify short messages (5-15 words)
    if (hinglishData.responseLengths) {
      hinglishData.responseLengths.forEach(length => {
        expect(length).toBeLessThanOrEqual(15);
      });
      console.log('✅ Message length constraints working');
    }
  });

  test('5. Bot 3-minute timer and graceful exit', async ({ request }) => {
    console.log('🧪 Testing bot 3-minute timer flow...');
    
    // Start bot conversation with test timers
    const startResponse = await request.post(`${API_URL}/test-bot-timer-flow`, {
      data: { testMode: true }
    });
    const startData = await startResponse.json();
    expect(startData.success).toBe(true);
    console.log('✅ Bot timer flow started');
    
    // Check initial timer state
    const check1 = await request.get(`${API_URL}/debug-bot-conversation-timers`);
    const timer1 = await check1.json();
    expect(timer1.activeConversations).toBe(1);
    console.log('✅ Timer initialized correctly');
    
    // Wait for warning time (10s in test mode)
    console.log('⏳ Waiting for warning message...');
    await new Promise(resolve => setTimeout(resolve, 11000));
    
    // Check warning reached
    const check2 = await request.get(`${API_URL}/debug-bot-conversation-timers`);
    const timer2 = await check2.json();
    if (timer2.timers && timer2.timers.length > 0) {
      expect(parseInt(timer2.timers[0].warningIn)).toBeLessThanOrEqual(0);
      console.log('✅ Warning timer reached');
    }
    
    // Wait for end (15s total in test mode)
    console.log('⏳ Waiting for conversation end...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify conversation ended
    const check3 = await request.get(`${API_URL}/debug-bot-conversation-timers`);
    const timer3 = await check3.json();
    expect(timer3.activeConversations).toBe(0);
    expect(timer3.botState.isAvailable).toBe(true);
    console.log('✅ Bot conversation ended gracefully');
    
    // Cleanup
    await request.post(`${API_URL}/test-bot-cleanup`);
  });

  test('6. Bot skip and disconnect handling', async ({ page, request }) => {
    console.log('🧪 Testing bot skip and disconnect handling...');
    
    const testUser = generateTestUser();
    
    // Register and login - two-step process
    await page.goto(`${TEST_URL}/auth`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("👨")');
    await expect(page.locator('button:has-text("Continue")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Continue")');
    
    // Start searching
    await page.waitForURL(`${TEST_URL}/`);
    await page.click('input[value="female"]');
    await page.click('button:has-text("Start Chatting")');
    
    // Wait for bot (using shorter timer for testing)
    console.log('⏳ Waiting for bot activation...');
    await page.waitForTimeout(61000);
    
    // Verify in chat
    await expect(page.locator('.chat-view')).toBeVisible();
    console.log('✅ Bot chat established');
    
    // Test skip
    await page.click('button:has-text("Skip")');
    
    // Should return to preferences
    await expect(page.locator('text=Looking for')).toBeVisible();
    console.log('✅ Skip functionality working');
    
    // Verify bot is available again via API
    const response = await request.get(`${API_URL}/debug-bot-timers`);
    const data = await response.json();
    expect(data.botState.isAvailable).toBe(true);
    console.log('✅ Bot available after disconnect');
  });

  test('7. No regression in Phase 1-4 features', async ({ page }) => {
    console.log('🧪 Testing Phase 1-4 feature regression...');
    
    const testUser = generateTestUser();
    
    // Test authentication still works
    await page.goto(`${TEST_URL}/auth`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("👨")');
    await expect(page.locator('button:has-text("Continue")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Continue")');
    console.log('✅ Authentication working');
    
    // Test interest input still visible
    await page.waitForURL(`${TEST_URL}/`);
    await expect(page.locator('input[placeholder*="gaming, music"]')).toBeVisible();
    console.log('✅ Interest input working');
    
    // Test gender selection still works
    await expect(page.locator('input[value="male"]')).toBeVisible();
    await expect(page.locator('input[value="female"]')).toBeVisible();
    await expect(page.locator('input[value="both"]')).toBeVisible();
    console.log('✅ Gender selection working');
    
    // Test settings still accessible
    await expect(page.locator('.settings-icon')).toBeVisible();
    console.log('✅ Settings icon visible');
  });

  test('8. Bot message length constraints', async ({ request }) => {
    console.log('🧪 Testing bot message length constraints...');
    
    // Test message splitting
    const splitTest = await request.post(`${API_URL}/test-message-split`, {
      data: { 
        message: "This is a very long message that should be split into multiple shorter messages because it exceeds the fifteen word limit that we have set for bot responses"
      }
    });
    
    const splitData = await splitTest.json();
    expect(splitData.success).toBe(true);
    expect(Array.isArray(splitData.parts)).toBe(true);
    
    // Verify each part is under 15 words
    splitData.parts.forEach(part => {
      const wordCount = part.split(' ').length;
      expect(wordCount).toBeLessThanOrEqual(15);
    });
    
    console.log('✅ Message length constraints working');
    console.log(`Split into ${splitData.parts.length} messages`);
  });

  test('9. Bot full flow integration test', async ({ request }) => {
    console.log('🧪 Testing complete bot flow integration...');
    
    const testUserId = 9999;
    
    // Test full bot flow
    const flowResponse = await request.get(`${API_URL}/test-full-bot-flow/${testUserId}`);
    const flowData = await flowResponse.json();
    
    expect(flowData.success).toBe(true);
    expect(flowData.steps).toHaveProperty('personaGenerated');
    expect(flowData.steps).toHaveProperty('timerStarted');
    expect(flowData.steps).toHaveProperty('conversationSetup');
    
    console.log('✅ Full bot flow integration working');
    
    // Cleanup
    await request.post(`${API_URL}/test-bot-cleanup`);
  });
});

// Code quality and stability tests
test.describe('Code Quality and Stability Checks', () => {
  
  test('10. Check for console errors during bot operations', async ({ page }) => {
    console.log('🧪 Checking for console errors...');
    
    const errors = [];
    const warnings = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });
    
    // Test normal flow with potential bot activation
    const testUser = generateTestUser();
    await page.goto(`${TEST_URL}/auth`);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("👨")');
    await expect(page.locator('button:has-text("Continue")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Continue")');
    
    await page.waitForURL(`${TEST_URL}/`);
    await page.click('input[value="female"]');
    await page.click('button:has-text("Start Chatting")');
    
    // Wait a bit for any errors to surface
    await page.waitForTimeout(5000);
    
    // Check for critical errors (warnings are often acceptable)
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('manifest') &&
      !error.includes('Failed to load resource')
    );
    
    expect(criticalErrors).toHaveLength(0);
    console.log('✅ No critical console errors found');
    
    if (warnings.length > 0) {
      console.log(`⚠️ Found ${warnings.length} warnings (acceptable)`);
    }
  });

  test('11. Check for memory leaks in bot timers', async ({ request }) => {
    console.log('🧪 Testing for memory leaks in bot timers...');
    
    // Start multiple bot conversations and ensure cleanup
    for (let i = 0; i < 3; i++) {
      console.log(`Starting bot session ${i + 1}/3...`);
      
      // Activate bot
      await request.get(`${API_URL}/test-bot-activation/${9000 + i}`);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Deactivate
      await request.get(`${API_URL}/test-bot-deactivation`);
    }
    
    // Check no lingering timers
    const timersCheck = await request.get(`${API_URL}/debug-bot-timers`);
    const timersData = await timersCheck.json();
    expect(timersData.activeTimers).toBe(0);
    console.log('✅ No lingering activation timers');
    
    const convTimersCheck = await request.get(`${API_URL}/debug-bot-conversation-timers`);
    const convTimersData = await convTimersCheck.json();
    expect(convTimersData.activeConversations).toBe(0);
    console.log('✅ No lingering conversation timers');
    
    // Final cleanup
    await request.post(`${API_URL}/test-bot-cleanup`);
  });

  test('12. Bot state consistency check', async ({ request }) => {
    console.log('🧪 Testing bot state consistency...');
    
    // Check initial bot state
    const initialState = await request.get(`${API_URL}/debug-bot-timers`);
    const initialData = await initialState.json();
    expect(initialData.botState.isAvailable).toBe(true);
    console.log('✅ Initial bot state correct');
    
    // Start bot conversation
    const startResponse = await request.get(`${API_URL}/test-bot-activation/8888`);
    const startData = await startResponse.json();
    expect(startData.success).toBe(true);
    
    // Check bot is now busy
    const busyState = await request.get(`${API_URL}/debug-bot-timers`);
    const busyData = await busyState.json();
    expect(busyData.botState.isAvailable).toBe(false);
    console.log('✅ Bot correctly marked as busy');
    
    // End conversation
    await request.get(`${API_URL}/test-bot-deactivation`);
    
    // Check bot is available again
    const finalState = await request.get(`${API_URL}/debug-bot-timers`);
    const finalData = await finalState.json();
    expect(finalData.botState.isAvailable).toBe(true);
    console.log('✅ Bot correctly returned to available state');
    
    // Final cleanup
    await request.post(`${API_URL}/test-bot-cleanup`);
  });
});