import { test, expect, chromium } from '@playwright/test';

// Quick verification to understand current state
test.describe('🔍 Quick Froopy Chat State Verification', () => {
  
  test('Check current UI state and identify issues', async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    
    try {
      console.log('🔍 Navigating to app...');
      await page.goto('http://localhost:5173');
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of initial state
      await page.screenshot({ path: 'initial-state.png', fullPage: true });
      
      console.log('📸 Initial state screenshot taken');
      
      // Check current URL
      const currentUrl = page.url();
      console.log('📍 Current URL:', currentUrl);
      
      // Check what h2 elements exist
      const h2Elements = await page.locator('h2').all();
      console.log('📝 Found h2 elements:', h2Elements.length);
      
      for (let i = 0; i < h2Elements.length; i++) {
        const text = await h2Elements[i].textContent();
        const isVisible = await h2Elements[i].isVisible();
        console.log(`  H2 ${i + 1}: "${text}" (visible: ${isVisible})`);
      }
      
      // Check if we're on auth page
      const emailInput = page.locator('input[type="email"]');
      const emailVisible = await emailInput.isVisible();
      console.log('📧 Email input visible:', emailVisible);
      
      if (emailVisible) {
        console.log('🔑 On auth page - testing auth flow...');
        
        // Complete auth flow
        const testEmail = `test_${Date.now()}@example.com`;
        await page.fill('input[type="email"]', testEmail);
        
        const passwordInput = page.locator('input[type="password"]');
        if (await passwordInput.isVisible()) {
          await page.fill('input[type="password"]', 'password123');
        }
        
        await page.click('button:has-text("👨")');
        await page.click('button:has-text("Continue")');
        
        await page.waitForURL('http://localhost:5173/');
        await page.waitForLoadState('networkidle');
        
        console.log('✅ Auth completed, now on main page');
        
        // Take screenshot after auth
        await page.screenshot({ path: 'after-auth.png', fullPage: true });
      }
      
      // Check main page elements
      console.log('🔍 Checking main page elements...');
      
      // Check for preferences section
      const preferencesHeading = page.locator('h2:has-text("I want to chat with")');
      if (await preferencesHeading.isVisible()) {
        console.log('✅ Preferences section visible');
      }
      
      // Check for friends dot
      const friendsDot = page.locator('.friends-dot, [data-testid="friends-dot"]');
      if (await friendsDot.isVisible()) {
        console.log('✅ Friends dot visible');
        await friendsDot.click();
        await page.waitForTimeout(1000);
        
        const friendsSheet = page.locator('.friends-sheet, [data-testid="friends-sheet"]');
        if (await friendsSheet.isVisible()) {
          console.log('✅ Friends sheet opens correctly');
        }
      } else {
        console.log('ℹ️ Friends dot not visible (no friends yet)');
      }
      
      // Check for settings
      const settingsButton = page.locator('button:has-text("Settings"), [data-testid="settings-button"]');
      if (await settingsButton.isVisible()) {
        console.log('✅ Settings button visible');
      }
      
      // Test preference selection
      const maleButton = page.locator('button:has-text("Male")');
      const femaleButton = page.locator('button:has-text("Female")');
      const bothButton = page.locator('button:has-text("Both")');
      
      if (await maleButton.isVisible()) {
        console.log('✅ Gender preference buttons visible');
        await maleButton.click();
        console.log('🎯 Selected Male preference');
      }
      
      // Check for start chat button
      const startChatButton = page.locator('button:has-text("Start Chatting")');
      if (await startChatButton.isVisible()) {
        console.log('✅ Start Chatting button visible');
        
        // Take screenshot before starting chat
        await page.screenshot({ path: 'before-chat.png', fullPage: true });
        
        await startChatButton.click();
        await page.waitForTimeout(2000);
        
        // Check what happens after clicking
        const afterClickUrl = page.url();
        console.log('📍 URL after clicking Start Chat:', afterClickUrl);
        
        // Take screenshot after clicking
        await page.screenshot({ path: 'after-click-start.png', fullPage: true });
        
        // Check for searching state
        const searchingText = page.locator('text="Finding someone", text="Searching", .searching');
        if (await searchingText.isVisible()) {
          console.log('✅ Searching state active');
        }
        
        // Check what h2 elements exist now
        const newH2Elements = await page.locator('h2').all();
        console.log('📝 H2 elements after starting search:', newH2Elements.length);
        
        for (let i = 0; i < newH2Elements.length; i++) {
          const text = await newH2Elements[i].textContent();
          const isVisible = await newH2Elements[i].isVisible();
          console.log(`  H2 ${i + 1}: "${text}" (visible: ${isVisible})`);
        }
      }
      
      console.log('🎉 Verification complete');
      
    } catch (error) {
      console.error('❌ Error during verification:', error.message);
      await page.screenshot({ path: 'error-state.png', fullPage: true });
    } finally {
      await context.close();
      await browser.close();
    }
  });
  
});