// Debug Matching System Test
import { test, expect } from '@playwright/test';

test.describe('Matching System Debug', () => {
  test('should debug matching flow step by step', async ({ browser }) => {
    console.log('🔍 Debugging matching system...');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const timestamp = Date.now();
    const user1Email = `debug1_${timestamp}@test.com`;
    const user2Email = `debug2_${timestamp}@test.com`;
    const password = 'testpassword123';

    try {
      // User 1 setup
      console.log('📝 Setting up User 1...');
      await page1.goto('http://localhost:5173/auth');
      await page1.fill('input[type="email"]', user1Email);
      await page1.click('button:has-text("Continue")');
      await page1.waitForSelector('text=Create your account');
      await page1.fill('input[type="password"]', password);
      await page1.click('button:has-text("👨 Male")');
      await page1.click('button:has-text("Sign Up")');
      await page1.waitForURL('http://localhost:5173/');
      console.log('✅ User 1 authenticated');

      // User 2 setup
      console.log('📝 Setting up User 2...');
      await page2.goto('http://localhost:5173/auth');
      await page2.fill('input[type="email"]', user2Email);
      await page2.click('button:has-text("Continue")');
      await page2.waitForSelector('text=Create your account');
      await page2.fill('input[type="password"]', password);
      await page2.click('button:has-text("👩 Female")');
      await page2.click('button:has-text("Sign Up")');
      await page2.waitForURL('http://localhost:5173/');
      console.log('✅ User 2 authenticated');

      // Take screenshots of initial state
      await page1.screenshot({ path: 'debug-user1-initial.png' });
      await page2.screenshot({ path: 'debug-user2-initial.png' });

      // Check what buttons are available
      console.log('📝 Checking available buttons for User 1...');
      const buttons1 = await page1.locator('button').allTextContents();
      console.log('User 1 buttons:', buttons1);

      console.log('📝 Checking available buttons for User 2...');
      const buttons2 = await page2.locator('button').allTextContents();
      console.log('User 2 buttons:', buttons2);

      // Check page content
      console.log('📝 Checking page content for User 1...');
      const content1 = await page1.textContent('body');
      console.log('User 1 page text (first 200 chars):', content1.substring(0, 200));

      console.log('📝 Checking page content for User 2...');
      const content2 = await page2.textContent('body');
      console.log('User 2 page text (first 200 chars):', content2.substring(0, 200));

      // Try to start matching
      console.log('📝 User 1 trying to start matching...');
      
      // Look for gender preference buttons
      const femaleButton1 = page1.locator('button:has-text("Female")');
      if (await femaleButton1.isVisible({ timeout: 5000 })) {
        await femaleButton1.click();
        console.log('✅ User 1 clicked Female button');
        await page1.waitForTimeout(2000);
        await page1.screenshot({ path: 'debug-user1-after-female.png' });
      } else {
        console.log('❌ User 1 cannot find Female button');
      }

      console.log('📝 User 2 trying to start matching...');
      
      const maleButton2 = page2.locator('button:has-text("Male")');
      if (await maleButton2.isVisible({ timeout: 5000 })) {
        await maleButton2.click();
        console.log('✅ User 2 clicked Male button');
        await page2.waitForTimeout(2000);
        await page2.screenshot({ path: 'debug-user2-after-male.png' });
      } else {
        console.log('❌ User 2 cannot find Male button');
      }

      // Wait and check for searching state
      console.log('📝 Waiting for searching state...');
      await page1.waitForTimeout(5000);
      await page2.waitForTimeout(5000);

      // Check for searching indicators
      const searching1 = await page1.textContent('body');
      const searching2 = await page2.textContent('body');

      if (searching1.includes('Searching') || searching1.includes('Looking')) {
        console.log('✅ User 1 is in searching state');
      } else {
        console.log('❓ User 1 searching state unclear');
      }

      if (searching2.includes('Searching') || searching2.includes('Looking')) {
        console.log('✅ User 2 is in searching state');
      } else {
        console.log('❓ User 2 searching state unclear');
      }

      // Take final screenshots
      await page1.screenshot({ path: 'debug-user1-final.png' });
      await page2.screenshot({ path: 'debug-user2-final.png' });

      // Check for any error messages
      console.log('📝 Checking for console errors...');
      
      const errors1 = [];
      page1.on('console', msg => {
        if (msg.type() === 'error') {
          errors1.push(msg.text());
        }
      });

      const errors2 = [];
      page2.on('console', msg => {
        if (msg.type() === 'error') {
          errors2.push(msg.text());
        }
      });

      if (errors1.length > 0) {
        console.log('❌ User 1 console errors:', errors1);
      }
      if (errors2.length > 0) {
        console.log('❌ User 2 console errors:', errors2);
      }

      console.log('🎯 MATCHING DEBUG RESULTS:');
      console.log('='.repeat(50));
      console.log('✅ Both users created and authenticated');
      console.log('✅ Preference buttons detection attempted');
      console.log('✅ Screenshots captured for analysis');
      console.log('ℹ️ Check debug-user1-*.png and debug-user2-*.png files');

    } catch (error) {
      console.error('❌ Debug test failed:', error.message);
      await page1.screenshot({ path: 'debug-user1-error.png' });
      await page2.screenshot({ path: 'debug-user2-error.png' });
      throw error;
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});