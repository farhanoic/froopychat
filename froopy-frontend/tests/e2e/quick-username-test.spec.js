// Quick Username Display Test - Focused test for username consistency
import { test, expect } from '@playwright/test';

test.describe('Quick Username Test', () => {
  test('should display real usernames not socket IDs when users match', async ({ browser }) => {
    console.log('🧪 Quick username consistency test...');

    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const timestamp = Date.now();
    const user1Email = `user1_${timestamp}@test.com`;
    const user2Email = `user2_${timestamp}@test.com`;

    try {
      // Register User 1
      console.log('📝 Registering User 1...');
      await page1.goto('http://localhost:5173/auth');
      await page1.fill('input[type="email"]', user1Email);
      await page1.fill('input[type="password"]', 'password123');
      await page1.click('button:has-text("👨")');
      
      // Wait for username generation and capture it
      await page1.waitForSelector('text=You\'ll be known as:', { timeout: 10000 });
      const user1Username = await page1.locator('p.text-white.text-xl.font-medium').textContent();
      console.log(`User 1 username: ${user1Username}`);
      
      await page1.click('button:has-text("Continue")');
      await page1.waitForURL('http://localhost:5173/', { timeout: 15000 });

      // Register User 2
      console.log('📝 Registering User 2...');
      await page2.goto('http://localhost:5173/auth');
      await page2.fill('input[type="email"]', user2Email);
      await page2.fill('input[type="password"]', 'password123');
      await page2.click('button:has-text("👩")');
      
      await page2.waitForSelector('text=You\'ll be known as:', { timeout: 10000 });
      const user2Username = await page2.locator('p.text-white.text-xl.font-medium').textContent();
      console.log(`User 2 username: ${user2Username}`);
      
      await page2.click('button:has-text("Continue")');
      await page2.waitForURL('http://localhost:5173/', { timeout: 15000 });

      // Start matching - User 1 (male looking for female)
      console.log('🔍 Starting match process...');
      await page1.waitForSelector('button:has-text("Female")', { timeout: 10000 });
      await page1.click('button:has-text("Female")');
      await page1.click('button:has-text("Start Chatting")');
      
      // Start matching - User 2 (female looking for male)
      await page2.waitForSelector('button:has-text("Male")', { timeout: 10000 });
      await page2.click('button:has-text("Male")');
      await page2.click('button:has-text("Start Chatting")');

      // Wait for match
      console.log('⏳ Waiting for match...');
      await Promise.all([
        page1.waitForSelector('text=Matched partner', { timeout: 20000 }),
        page2.waitForSelector('text=Matched partner', { timeout: 20000 })
      ]);

      console.log('🎉 Match found! Checking usernames...');

      // Get the displayed partner usernames from chat headers
      const user1SeesPartner = await page1.locator('.text-white.font-semibold').first().textContent();
      const user2SeesPartner = await page2.locator('.text-white.font-semibold').first().textContent();

      console.log(`👀 User 1 sees partner: "${user1SeesPartner}"`);
      console.log(`👀 User 2 sees partner: "${user2SeesPartner}"`);
      console.log(`✅ Expected User 1 to see: "${user2Username}"`);
      console.log(`✅ Expected User 2 to see: "${user1Username}"`);

      // CRITICAL CHECKS
      // 1. Users should see each other's real usernames
      expect(user1SeesPartner).toBe(user2Username);
      expect(user2SeesPartner).toBe(user1Username);

      // 2. Usernames should NOT be socket IDs (no AAAA pattern)
      expect(user1SeesPartner).not.toMatch(/AAAA/);
      expect(user2SeesPartner).not.toMatch(/AAAA/);

      // 3. Usernames should follow the expected format (word+word+numbers)
      expect(user1SeesPartner).toMatch(/^[a-z]+[a-z]+\d+$/);
      expect(user2SeesPartner).toMatch(/^[a-z]+[a-z]+\d+$/);

      // 4. Usernames should not be identical
      expect(user1Username).not.toBe(user2Username);

      console.log('🏆 SUCCESS: Usernames display correctly!');
      console.log('✅ No socket IDs found');
      console.log('✅ Real usernames displayed');
      console.log('✅ Proper format validation passed');

      // Test message exchange to ensure consistency
      await page1.fill('input[placeholder="Type a message..."]', 'Hello from user 1!');
      await page1.press('input[placeholder="Type a message..."]', 'Enter');
      
      // Verify message appears
      await page2.waitForSelector('text=Hello from user 1!', { timeout: 5000 });
      console.log('✅ Message exchange working');

    } finally {
      await context1.close();
      await context2.close();
    }
  });
});