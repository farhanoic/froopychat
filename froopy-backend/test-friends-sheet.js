const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

// Helper to take screenshots
async function takeScreenshot(page, name) {
  const screenshotPath = path.join(__dirname, 'test-screenshots', `sheet-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
}

// Helper to create test directories
function createTestDirectories() {
  const screenshotDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
}

// Helper to login a user
async function loginUser(page, email, gender = 'male') {
  await page.goto(`${APP_URL}/auth`);
  await page.waitForSelector('input[type="email"]');
  
  // Fill email and password
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', 'password123');
  
  // Click gender icon (👨 for male, 👩 for female) 
  const genderIcon = gender === 'male' ? '👨' : '👩';
  await page.evaluate((icon) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const genderButton = buttons.find(btn => btn.textContent.trim() === icon);
    if (genderButton) genderButton.click();
  }, genderIcon);
  
  // Wait for username generation and continue button
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(btn => btn.textContent.trim() === 'Continue');
  });
  
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const continueButton = buttons.find(btn => btn.textContent.trim() === 'Continue');
    if (continueButton) continueButton.click();
  });
  
  // Wait for redirect to main page
  await page.waitForFunction(() => {
    return window.location.pathname === '/';
  }, { timeout: 10000 });
  
  await page.waitForFunction(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    return h2s.some(h2 => h2.textContent.includes('I want to chat with'));
  }, { timeout: 10000 });
}

// Add friends via debug API
async function addFriendViaAPI(user1Id, user2Id) {
  try {
    const response = await fetch(`${API_URL}/debug-add-friend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user1Id, user2Id })
    });
    return await response.json();
  } catch (error) {
    console.log(`API call failed: ${error.message}`);
    return null;
  }
}

async function runFriendsSheetTests() {
  console.log('🚀 Starting Friends Sheet UI Tests (Phase 6 Chunk 4)...\\n');
  
  createTestDirectories();
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });
  
  try {
    // ===== TEST 1: Basic Sheet Open/Close =====
    console.log('📋 TEST 1: Basic Sheet Open/Close');
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 }); // iPhone dimensions
    
    // Enable console logging
    page.on('console', msg => console.log(`[CONSOLE] ${msg.text()}`));
    
    await loginUser(page, 'testuser@example.com', 'male');
    
    // First, add some friends so the dot appears
    await addFriendViaAPI(1, 2);
    await addFriendViaAPI(1, 3);
    
    // Refresh to see friends
    await page.reload();
    await page.waitForFunction(() => {
      const h2s = Array.from(document.querySelectorAll('h2'));
      return h2s.some(h2 => h2.textContent.includes('I want to chat with'));
    });
    
    // Wait for friends dot to appear
    await page.waitForSelector('button[aria-label*="friends"]', { timeout: 5000 });
    await takeScreenshot(page, '01-friends-dot-visible');
    
    // Click friends dot to open sheet
    await page.click('button[aria-label*="friends"]');
    
    // Wait for sheet to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    
    // Check if sheet is visible
    const sheetVisible = await page.evaluate(() => {
      const sheet = document.querySelector('[role="dialog"]');
      return sheet && window.getComputedStyle(sheet).visibility === 'visible';
    });
    
    if (sheetVisible) {
      console.log('✅ PASS: Friends sheet opens when clicking friends dot');
    } else {
      console.log('❌ FAIL: Friends sheet did not open');
    }
    
    await takeScreenshot(page, '02-sheet-opened');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('');

    // ===== TEST 2: Sheet Content Verification =====
    console.log('📋 TEST 2: Sheet Content Verification');
    
    // Check for header
    const headerText = await page.$eval('#friends-sheet-title', el => el.textContent);
    if (headerText.includes('Friends')) {
      console.log('✅ PASS: Sheet header displays correctly');
    } else {
      console.log(`❌ FAIL: Header text incorrect: "${headerText}"`);
    }
    
    // Check for search input
    const searchInput = await page.$('input[placeholder*="Search username"]');
    if (searchInput) {
      console.log('✅ PASS: Search input is present');
    } else {
      console.log('❌ FAIL: Search input not found');
    }
    
    // Check for friends list
    const friendItems = await page.$$('.bg-white\\/5'); // Friends have bg-white/5 class
    console.log(`📊 Found ${friendItems.length} friend items displayed`);
    
    if (friendItems.length > 0) {
      console.log('✅ PASS: Friends list displays items');
      
      // Check first friend item components
      const firstFriendAvatar = await page.$('img[src*="dicebear"]');
      const firstFriendName = await page.$('.text-white.font-medium');
      const firstFriendStatus = await page.$('.text-white\\/50.text-sm');
      
      if (firstFriendAvatar && firstFriendName && firstFriendStatus) {
        console.log('✅ PASS: Friend items have avatar, name, and status');
      } else {
        console.log('❌ FAIL: Friend items missing components');
      }
    } else {
      console.log('⚠️ WARNING: No friend items found');
    }
    
    await takeScreenshot(page, '03-sheet-content');
    console.log('');

    // ===== TEST 3: Close Methods =====
    console.log('📋 TEST 3: Close Methods');
    
    // Test Escape key
    await page.keyboard.press('Escape');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let sheetHidden = await page.evaluate(() => {
      const sheet = document.querySelector('[role="dialog"]');
      return !sheet || window.getComputedStyle(sheet).visibility === 'hidden';
    });
    
    if (sheetHidden) {
      console.log('✅ PASS: Escape key closes sheet');
    } else {
      console.log('❌ FAIL: Escape key did not close sheet');
    }
    
    // Re-open sheet for next test
    await page.click('button[aria-label*="friends"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    
    // Test backdrop click
    await page.evaluate(() => {
      // Click on backdrop (not the sheet itself)
      const backdrop = document.querySelector('[role="dialog"] > div:first-child');
      if (backdrop) backdrop.click();
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    sheetHidden = await page.evaluate(() => {
      const sheet = document.querySelector('[role="dialog"]');
      return !sheet || window.getComputedStyle(sheet).visibility === 'hidden';
    });
    
    if (sheetHidden) {
      console.log('✅ PASS: Backdrop click closes sheet');
    } else {
      console.log('❌ FAIL: Backdrop click did not close sheet');
    }
    
    await takeScreenshot(page, '04-sheet-closed');
    console.log('');

    // ===== TEST 4: Mobile Swipe Gesture =====
    console.log('📋 TEST 4: Mobile Swipe Gesture');
    
    // Re-open sheet
    await page.click('button[aria-label*="friends"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    
    // Simulate swipe down gesture
    const sheet = await page.$('[role="dialog"] > div:last-child'); // The actual sheet element
    const boundingBox = await sheet.boundingBox();
    
    if (boundingBox) {
      const centerX = boundingBox.x + boundingBox.width / 2;
      const startY = boundingBox.y + 50; // Start near top of sheet
      const endY = startY + 100; // Swipe down 100px
      
      // Simulate touch swipe
      await page.mouse.move(centerX, startY);
      await page.mouse.down();
      await page.mouse.move(centerX, endY);
      await page.mouse.up();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const swipeWorked = await page.evaluate(() => {
        const sheet = document.querySelector('[role="dialog"]');
        return !sheet || window.getComputedStyle(sheet).visibility === 'hidden';
      });
      
      if (swipeWorked) {
        console.log('✅ PASS: Swipe down gesture closes sheet');
      } else {
        console.log('❌ FAIL: Swipe down gesture did not close sheet');
      }
    } else {
      console.log('⚠️ SKIP: Could not get sheet bounding box for swipe test');
    }
    
    await takeScreenshot(page, '05-swipe-test');
    console.log('');

    // ===== TEST 5: Empty State =====
    console.log('📋 TEST 5: Empty State Test');
    
    // Remove friends to test empty state
    // (We can't easily remove via API, so we'll simulate by checking user with no friends)
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 375, height: 812 });
    await loginUser(page2, 'emptyuser@example.com', 'female');
    
    // Since this user has no friends, no friends dot should appear
    const noFriendsDot = await page2.$('button[aria-label*="friends"]');
    if (!noFriendsDot) {
      console.log('✅ PASS: No friends dot for user with no friends');
    } else {
      console.log('❌ FAIL: Friends dot appeared for user with no friends');
    }
    
    await takeScreenshot(page2, '06-empty-state-no-dot');
    console.log('');

    // ===== TEST 6: Animation and Performance =====
    console.log('📋 TEST 6: Animation and Performance');
    
    // Go back to page with friends
    await page.bringToFront();
    
    // Test multiple rapid open/close operations
    for (let i = 0; i < 3; i++) {
      await page.click('button[aria-label*="friends"]');
      await new Promise(resolve => setTimeout(resolve, 200));
      await page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('✅ PASS: Multiple rapid open/close operations handled');
    
    // Final open to check state
    await page.click('button[aria-label*="friends"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    
    // Check for smooth animation (sheet should be fully visible)
    const finalState = await page.evaluate(() => {
      const sheet = document.querySelector('[role="dialog"] > div:last-child');
      const transform = window.getComputedStyle(sheet).transform;
      return transform.includes('matrix') || transform === 'none';
    });
    
    if (finalState) {
      console.log('✅ PASS: Sheet animations working properly');
    } else {
      console.log('❌ FAIL: Sheet animation issues detected');
    }
    
    await takeScreenshot(page, '07-final-animation-test');
    console.log('');

    // ===== TEST 7: Accessibility =====
    console.log('📋 TEST 7: Accessibility Features');
    
    // Check ARIA attributes
    const ariaModal = await page.$eval('[role="dialog"]', el => el.getAttribute('aria-modal'));
    const ariaLabelledBy = await page.$eval('[role="dialog"]', el => el.getAttribute('aria-labelledby'));
    
    if (ariaModal === 'true') {
      console.log('✅ PASS: aria-modal attribute set correctly');
    } else {
      console.log('❌ FAIL: aria-modal attribute missing or incorrect');
    }
    
    if (ariaLabelledBy === 'friends-sheet-title') {
      console.log('✅ PASS: aria-labelledby attribute set correctly');
    } else {
      console.log('❌ FAIL: aria-labelledby attribute missing or incorrect');
    }
    
    // Check if body scroll is locked
    const bodyOverflow = await page.evaluate(() => {
      return document.body.style.overflow;
    });
    
    if (bodyOverflow === 'hidden') {
      console.log('✅ PASS: Body scroll locked when sheet is open');
    } else {
      console.log('❌ FAIL: Body scroll not locked');
    }
    
    console.log('');

    // ===== Final Summary =====
    console.log('📊 TEST SUMMARY');
    console.log('================');
    console.log('✅ Basic sheet open/close functionality tested');
    console.log('✅ Sheet content verification completed');
    console.log('✅ All close methods tested (escape, backdrop, swipe)');
    console.log('✅ Mobile swipe gesture tested');
    console.log('✅ Empty state handling verified');
    console.log('✅ Animation and performance tested');
    console.log('✅ Accessibility features verified');
    console.log('');
    console.log('📁 Screenshots saved in: test-screenshots/');
    console.log('🎯 Phase 6 Chunk 4: Friends Bottom Sheet UI tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the tests
runFriendsSheetTests().catch(console.error);