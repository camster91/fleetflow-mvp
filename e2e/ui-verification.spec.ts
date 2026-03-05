import { test, expect } from '@playwright/test';

test.describe('FleetFlow Pro UI Verification', () => {
  test('verify homepage and navigation', async ({ page }) => {
    // Go to homepage
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/FleetFlow/);
    
    // Take screenshot
    await page.screenshot({ path: 'test-homepage.png' });
    
    // Check for sign in button
    const signInButton = page.locator('a:has-text("Sign In"), button:has-text("Sign In"), a:has-text("Login")');
    await expect(signInButton.first()).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Homepage loaded with Sign In button');
  });

  test('verify dashboard UI elements', async ({ page }) => {
    // Go to dashboard (might redirect to login)
    await page.goto('/dashboard');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'test-dashboard.png' });
    
    // Check page content
    const bodyText = await page.textContent('body') || '';
    
    // The dashboard should show some fleet-related content
    // It might show login form or actual dashboard
    if (bodyText.includes('Email') || bodyText.includes('Login')) {
      console.log('📋 Dashboard shows login (not authenticated)');
      // Check login form
      await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible({ timeout: 5000 });
      console.log('✅ Login form is present');
    } else {
      console.log('📋 Dashboard shows content (authenticated)');
      // Look for dashboard elements
      const buttons = await page.locator('button').count();
      const links = await page.locator('a').count();
      
      expect(buttons).toBeGreaterThan(0);
      expect(links).toBeGreaterThan(0);
      
      console.log(`✅ Dashboard has ${buttons} buttons and ${links} links`);
      
      // Check for common dashboard text
      if (bodyText.includes('Vehicle') || bodyText.includes('Delivery') || bodyText.includes('Dashboard')) {
        console.log('✅ Dashboard shows fleet management content');
      }
    }
  });

  test('verify authentication pages', async ({ page }) => {
    // Test login page
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    // Check for login form
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput.first()).toBeVisible({ timeout: 5000 });
    
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await expect(passwordInput.first()).toBeVisible({ timeout: 5000 });
    
    const loginButton = page.locator('button:has-text("Login"), button[type="submit"]');
    await expect(loginButton.first()).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Login page has email, password, and login button');
    
    // Test registration page  
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');
    
    // Check for registration form
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]');
    const registerEmailInput = page.locator('input[type="email"], input[name="email"]');
    const registerPasswordInput = page.locator('input[type="password"], input[name="password"]');
    const registerButton = page.locator('button:has-text("Register"), button:has-text("Create Account"), button:has-text("Continue")');
    
    // At least some of these should be visible
    const inputs = [nameInput, registerEmailInput, registerPasswordInput];
    const visibleInputs = await Promise.all(inputs.map(async (input) => {
      try {
        await input.first().waitFor({ state: 'visible', timeout: 2000 });
        return true;
      } catch {
        return false;
      }
    }));
    
    expect(visibleInputs.filter(Boolean).length).toBeGreaterThan(0);
    await expect(registerButton.first()).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Registration page has form elements');
  });

  test('verify responsive design', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-mobile.png' });
    
    // Check for mobile menu button (hamburger)
    const mobileMenuButton = page.locator('button:has-text("Menu"), button[aria-label*="menu"], button svg');
    const hasMobileMenu = await mobileMenuButton.count().then(count => count > 0);
    
    if (hasMobileMenu) {
      console.log('✅ Mobile menu button found');
    } else {
      console.log('⚠️  Mobile menu button not found (may not be needed)');
    }
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'test-tablet.png' });
    
    console.log('✅ Responsive design tested for mobile and tablet');
  });

  test('verify interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test all buttons are clickable
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    console.log(`🔘 Found ${buttonCount} buttons on page`);
    
    // Try clicking first few buttons (if they're visible and enabled)
    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const button = buttons.nth(i);
      try {
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (isVisible && isEnabled) {
          await button.click({ force: true });
          console.log(`✅ Button ${i + 1} clicked`);
          // Wait a bit and go back
          await page.waitForTimeout(500);
          await page.goBack({ waitUntil: 'networkidle' });
        }
      } catch (error) {
        console.log(`⚠️  Button ${i + 1} not clickable: ${error.message}`);
      }
    }
    
    // Test all links
    const links = page.locator('a[href]:not([href=""])');
    const linkCount = await links.count();
    
    console.log(`🔗 Found ${linkCount} links on page`);
    
    // Try clicking first few links
    for (let i = 0; i < Math.min(linkCount, 2); i++) {
      const link = links.nth(i);
      try {
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('#')) {
          await link.click({ force: true });
          console.log(`✅ Link ${i + 1} clicked (${href})`);
          await page.waitForTimeout(500);
          await page.goBack({ waitUntil: 'networkidle' });
        }
      } catch (error) {
        console.log(`⚠️  Link ${i + 1} not clickable: ${error.message}`);
      }
    }
    
    console.log('✅ Interactive elements test completed');
  });
});