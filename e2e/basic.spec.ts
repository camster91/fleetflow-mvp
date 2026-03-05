import { test, expect } from '@playwright/test';

test.describe('FleetFlow Pro Basic UI Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/FleetFlow/);
    
    // Check for loading state or content
    const loadingOrContent = await page.locator('body').textContent();
    expect(loadingOrContent?.length).toBeGreaterThan(100);
  });

  test('dashboard shows main elements', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for common elements that should exist
    const bodyText = await page.locator('body').textContent() || '';
    
    // Check for any fleet-related text
    expect(bodyText.toLowerCase()).toContain('fleet');
    
    // Look for buttons or tabs (might be rendered with JS)
    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThan(0);
    
    // Check for navigation
    const links = await page.locator('a').count();
    expect(links).toBeGreaterThan(0);
  });

  test('login page accessible', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Check for login form elements
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible({ timeout: 5000 });
    
    // Check for login button
    await expect(page.locator('button:has-text("Login"), button[type="submit"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-screenshot-dashboard.png' });
    
    // Check page has some content
    const text = await page.locator('body').textContent() || '';
    expect(text.length).toBeGreaterThan(100);
  });
});