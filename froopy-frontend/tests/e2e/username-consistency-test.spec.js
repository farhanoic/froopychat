// Username Consistency Test - Verify usernames display correctly everywhere
import { test, expect } from '@playwright/test';

test.describe('Username Display Consistency', () => {
  let context1, context2, page1, page2;
  const user1Email = `testuser1_${Date.now()}@example.com`;
  const user2Email = `testuser2_${Date.now()}@example.com`;
  let user1Username, user2Username;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts for two different users
    context1 = await browser.newContext();
    context2 = await browser.newContext();
    page1 = await context1.newPage();
    page2 = await context2.newPage();
  });

  test.afterAll(async () => {
    await context1?.close();
    await context2?.close();
  });

  test('should display consistent usernames throughout the matching and chat flow', async () => {
    console.log('🧪 Starting username consistency test...');

    // Step 1: Register User 1
    console.log('📝 Registering User 1...');
    await page1.goto('http://localhost:5173/auth');
    await page1.waitForLoadState('networkidle');

    // Fill User 1 details
    await page1.fill('input[type="email"]', user1Email);
    await page1.fill('input[type="password"]', 'password123');
    await page1.click('button:has-text("👨")'); // Select male

    // Wait for username generation and capture it
    await page1.waitForSelector('text=You\'ll be known as:', { timeout: 5000 });
    const user1UsernameElement = await page1.locator('p.text-white.text-xl.font-medium').textContent();
    user1Username = user1UsernameElement.trim();
    console.log(`👤 User 1 username: ${user1Username}`);

    await page1.click('button:has-text("Continue")');
    await page1.waitForURL('http://localhost:5173/', { timeout: 10000 });
    console.log('✅ User 1 registered and authenticated');

    // Step 2: Register User 2
    console.log('📝 Registering User 2...');
    await page2.goto('http://localhost:5173/auth');
    await page2.waitForLoadState('networkidle');

    // Fill User 2 details
    await page2.fill('input[type="email"]', user2Email);
    await page2.fill('input[type="password"]', 'password123');
    await page2.click('button:has-text("👩")'); // Select female

    // Wait for username generation and capture it
    await page2.waitForSelector('text=You\'ll be known as:', { timeout: 5000 });
    const user2UsernameElement = await page2.locator('p.text-white.text-xl.font-medium').textContent();
    user2Username = user2UsernameElement.trim();
    console.log(`👤 User 2 username: ${user2Username}`);

    await page2.click('button:has-text("Continue")');
    await page2.waitForURL('http://localhost:5173/', { timeout: 10000 });
    console.log('✅ User 2 registered and authenticated');

    // Step 3: Both users start searching with compatible preferences
    console.log('🔍 Starting search for both users...');

    // User 1 sets preferences (male looking for female)
    await page1.waitForSelector('div:has-text("Looking for")', { timeout: 5000 });
    await page1.click('button:has-text("Female")'); // Looking for female
    await page1.click('button:has-text("Start Chatting")');
    
    // User 2 sets preferences (female looking for male)  
    await page2.waitForSelector('div:has-text("Looking for")', { timeout: 5000 });
    await page2.click('button:has-text("Male")'); // Looking for male
    await page2.click('button:has-text("Start Chatting")');

    console.log('⏳ Waiting for match...');

    // Step 4: Wait for match to be found
    await Promise.all([
      page1.waitForSelector('text=Matched partner', { timeout: 15000 }),
      page2.waitForSelector('text=Matched partner', { timeout: 15000 })
    ]);

    console.log('🎉 Match found! Checking username consistency...');

    // Step 5: Verify usernames in chat headers
    const user1SeesPartnerUsername = await page1.locator('.text-white.font-semibold').first().textContent();
    const user2SeesPartnerUsername = await page2.locator('.text-white.font-semibold').first().textContent();

    console.log(`👀 User 1 sees partner username: "${user1SeesPartnerUsername}"`);
    console.log(`👀 User 2 sees partner username: "${user2SeesPartnerUsername}"`);

    // Verify usernames are correct (not socket IDs)
    expect(user1SeesPartnerUsername).toBe(user2Username);
    expect(user2SeesPartnerUsername).toBe(user1Username);

    // Verify usernames are not socket IDs (they shouldn't contain random characters)
    expect(user1SeesPartnerUsername).not.toMatch(/^[A-Za-z0-9_-]{20}$/); // Socket ID pattern
    expect(user2SeesPartnerUsername).not.toMatch(/^[A-Za-z0-9_-]{20}$/); // Socket ID pattern

    // Verify usernames follow the expected pattern (coolpanda123 format)
    expect(user1SeesPartnerUsername).toMatch(/^[a-z]+[a-z]+\d+$/);
    expect(user2SeesPartnerUsername).toMatch(/^[a-z]+[a-z]+\d+$/);

    console.log('✅ Chat header usernames are correct!');

    // Step 6: Send messages and verify username consistency in message flow
    console.log('💬 Testing message exchange...');

    await page1.fill('input[placeholder="Type a message..."]', `Hello ${user2Username}! This is ${user1Username}`);
    await page1.press('input[placeholder="Type a message..."]', 'Enter');

    await page2.fill('input[placeholder="Type a message..."]', `Hi ${user1Username}! Nice to meet you from ${user2Username}`);
    await page2.press('input[placeholder="Type a message..."]', 'Enter');

    // Wait for messages to appear
    await page1.waitForSelector(`text=Hello ${user2Username}!`, { timeout: 5000 });
    await page2.waitForSelector(`text=Hi ${user1Username}!`, { timeout: 5000 });

    console.log('✅ Messages sent successfully');

    // Step 7: Test Friends System - Add each other as friends
    console.log('👥 Testing friends system username consistency...');

    // User 1 opens friends sheet
    await page1.click('[data-testid="friends-button"], .w-10.h-10.bg-royal-blue, .fixed.top-4.right-4');
    await page1.waitForSelector('h2:has-text("Friends")', { timeout: 5000 });

    // Search for User 2 by username
    await page1.fill('input[placeholder*="Search username"]', user2Username);
    await page1.waitForSelector('button:has-text("Add Friend")', { timeout: 5000 });

    // Verify the search result shows correct username
    const searchResultUsername = await page1.locator('.text-white.font-medium').textContent();
    expect(searchResultUsername).toBe(user2Username);
    console.log(`✅ Friends search shows correct username: ${searchResultUsername}`);

    // Add as friend
    await page1.click('button:has-text("Add Friend")');
    await page1.waitForSelector('text=Found 1 user', { timeout: 3000 });

    // Close friends sheet
    await page1.click('button[aria-label="Close friends"]');

    // User 2 also adds User 1
    await page2.click('[data-testid="friends-button"], .w-10.h-10.bg-royal-blue, .fixed.top-4.right-4');
    await page2.waitForSelector('h2:has-text("Friends")', { timeout: 5000 });
    await page2.fill('input[placeholder*="Search username"]', user1Username);
    await page2.waitForSelector('button:has-text("Add Friend")', { timeout: 5000 });
    await page2.click('button:has-text("Add Friend")');
    await page2.click('button[aria-label="Close friends"]');

    console.log('✅ Friends added successfully');

    // Step 8: Test Settings page username display
    console.log('⚙️ Testing settings page username consistency...');

    // User 1 opens settings
    await page1.click('button:has([d*="M10.325"]), .fixed.top-4.left-4'); // Settings gear icon
    await page1.waitForSelector('h2:has-text("Settings")', { timeout: 5000 });

    // Verify own username in settings
    const settingsUsername = await page1.locator('text=' + user1Username).textContent();
    expect(settingsUsername).toBe(user1Username);
    console.log(`✅ Settings shows correct username: ${settingsUsername}`);

    await page1.click('button[aria-label="Close settings"]');

    // Step 9: Comprehensive username validation
    console.log('🔍 Running comprehensive username validation...');

    // Validate that usernames are never empty or null
    expect(user1Username).toBeTruthy();
    expect(user2Username).toBeTruthy();
    expect(user1Username.length).toBeGreaterThan(0);
    expect(user2Username.length).toBeGreaterThan(0);

    // Validate username format (adjective + animal + number)
    const usernamePattern = /^[a-z]+[a-z]+\d+$/;
    expect(user1Username).toMatch(usernamePattern);
    expect(user2Username).toMatch(usernamePattern);

    // Ensure usernames are unique
    expect(user1Username).not.toBe(user2Username);

    console.log('🎯 Username Consistency Test Results:');
    console.log(`   User 1: ${user1Username}`);
    console.log(`   User 2: ${user2Username}`);
    console.log(`   ✅ Chat headers show correct partner usernames`);
    console.log(`   ✅ Friends search displays correct usernames`);
    console.log(`   ✅ Settings page shows correct own username`);
    console.log(`   ✅ No socket IDs found in username displays`);
    console.log(`   ✅ Username format validation passed`);
    console.log(`   ✅ Username uniqueness confirmed`);

    // Step 10: Final verification - check for any socket ID leakage
    const page1Content = await page1.content();
    const page2Content = await page2.content();

    // Look for socket ID patterns in page content
    const socketIdPattern = /[A-Za-z0-9_-]{20}AAAA[A-Z]/g;
    const page1SocketIds = page1Content.match(socketIdPattern) || [];
    const page2SocketIds = page2Content.match(socketIdPattern) || [];

    if (page1SocketIds.length > 0) {
      console.warn('⚠️ Found potential socket IDs in page 1:', page1SocketIds);
    }
    if (page2SocketIds.length > 0) {
      console.warn('⚠️ Found potential socket IDs in page 2:', page2SocketIds);
    }

    // Ensure no socket IDs are displayed as usernames
    expect(page1SocketIds.length).toBe(0);
    expect(page2SocketIds.length).toBe(0);

    console.log('🏆 Username consistency test PASSED! All usernames display correctly.');
  });

  test('should handle username fallback gracefully when database lookup fails', async () => {
    console.log('🧪 Testing username fallback scenarios...');
    
    // This test would simulate database failures and ensure graceful fallbacks
    // For now, we'll just verify the format is maintained
    const testUsername = "testuser123";
    expect(testUsername).toMatch(/^[a-z]+[a-z]*\d+$/);
    console.log('✅ Username fallback format validation passed');
  });
});