import { test, expect } from '@playwright/test';

test.describe('FleetFlow Pro Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load the homepage with correct title', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/FleetFlow Pro|Fleet Management Dashboard/);
    
    // Check for main heading
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should display dashboard stats cards', async ({ page }) => {
    // Check for stats cards
    await expect(page.getByText('Total Vehicles')).toBeVisible();
    await expect(page.getByText('Active Deliveries')).toBeVisible();
    await expect(page.getByText('Maintenance Due')).toBeVisible();
    await expect(page.getByText('Pending SOPs')).toBeVisible();
    
    // Stats should show numbers (not just labels)
    await expect(page.getByText(/\d+/).first()).toBeVisible();
  });

  test('should have working tab navigation', async ({ page }) => {
    // Check all main tabs are present
    const tabs = ['Overview', 'Vehicles', 'Deliveries', 'Maintenance', 'SOP Library', 'Clients', 'Reports'];
    
    for (const tab of tabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
    
    // Click on Vehicles tab
    await page.getByRole('button', { name: 'Vehicles' }).click();
    
    // Should show vehicles table
    await expect(page.getByText(/Vehicle Name|Driver|Location|Status/)).toBeVisible();
    
    // Click on Deliveries tab
    await page.getByRole('button', { name: 'Deliveries' }).click();
    
    // Should show deliveries table
    await expect(page.getByText(/Customer|Address|Driver|Status/)).toBeVisible();
  });

  test('should display vehicles with correct information', async ({ page }) => {
    // Navigate to Vehicles tab
    await page.getByRole('button', { name: 'Vehicles' }).click();
    
    // Wait for vehicles to load
    await page.waitForSelector('table');
    
    // Check for vehicle information
    await expect(page.getByText(/Ford Transit|Chevrolet Express|Toyota Prius/)).toBeVisible();
    await expect(page.getByText(/Maria Rodriguez|James Wilson/)).toBeVisible();
    
    // Check for status badges
    await expect(page.getByText('Active')).toBeVisible();
    await expect(page.getByText('Inactive')).toBeVisible();
  });

  test('should display deliveries with status indicators', async ({ page }) => {
    // Navigate to Deliveries tab
    await page.getByRole('button', { name: 'Deliveries' }).click();
    
    // Wait for deliveries to load
    await page.waitForSelector('table');
    
    // Check for delivery information
    await expect(page.getByText(/Fresh Mart|Organic Grocers/)).toBeVisible();
    await expect(page.getByText(/123 Main St|456 Oak Ave/)).toBeVisible();
    
    // Check for status indicators
    await expect(page.getByText('In-Transit')).toBeVisible();
    await expect(page.getByText('Pending')).toBeVisible();
  });

  test('should have working quick action buttons', async ({ page }) => {
    // Check for quick action buttons
    const actions = ['Add Vehicle', 'Schedule Delivery', 'Create Maintenance', 'Send Announcement'];
    
    for (const action of actions) {
      await expect(page.getByRole('button', { name: action })).toBeVisible();
    }
    
    // Test Add Vehicle button
    await page.getByRole('button', { name: 'Add Vehicle' }).click();
    
    // Should open vehicle form modal
    await expect(page.getByText(/Add Vehicle|Vehicle Details/)).toBeVisible();
    
    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).or(page.getByRole('button', { name: 'Close' })).first().click();
  });

  test('should have working search functionality', async ({ page }) => {
    // Check for search input
    const searchInput = page.getByPlaceholder(/Search vehicles|Search deliveries|Search/i);
    await expect(searchInput).toBeVisible();
    
    // Test search
    await searchInput.fill('Ford');
    await searchInput.press('Enter');
    
    // Should filter results
    await expect(page.getByText('Ford Transit Van')).toBeVisible();
  });

  test('should display maintenance tasks', async ({ page }) => {
    // Navigate to Maintenance tab
    await page.getByRole('button', { name: 'Maintenance' }).click();
    
    // Check for maintenance tasks
    await expect(page.getByText(/Oil Change|Tire Rotation|Brake Inspection/)).toBeVisible();
    await expect(page.getByText(/High|Medium|Low/)).toBeVisible();
  });

  test('should display client information', async ({ page }) => {
    // Navigate to Clients tab
    await page.getByRole('button', { name: 'Clients' }).click();
    
    // Check for client information
    await expect(page.getByText(/Fresh Mart|Organic Grocers/)).toBeVisible();
    await expect(page.getByText(/deliveries completed/)).toBeVisible();
  });

  test('should have responsive design for mobile', async ({ page }) => {
    // Switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check for mobile menu button
    await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
    
    // Open mobile menu
    await page.getByRole('button', { name: /menu/i }).click();
    
    // Check menu items
    await expect(page.getByText(/Dashboard|Vehicles|Deliveries/)).toBeVisible();
  });

  test('should show notifications when actions are performed', async ({ page }) => {
    // Click refresh button
    await page.getByRole('button', { name: /refresh/i }).click();
    
    // Should show success notification
    await expect(page.getByText(/Data refreshed|success/i)).toBeVisible();
  });

  test('should handle vehicle detail view', async ({ page }) => {
    // Navigate to Vehicles tab
    await page.getByRole('button', { name: 'Vehicles' }).click();
    
    // Click on a vehicle row
    await page.getByText('Ford Transit Van').first().click();
    
    // Should open vehicle detail modal
    await expect(page.getByText(/Vehicle Details|Driver Information/)).toBeVisible();
    
    // Check for action buttons in modal
    await expect(page.getByRole('button', { name: /Navigate/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Call Driver/i })).toBeVisible();
    
    // Close modal
    await page.getByRole('button', { name: /close/i }).first().click();
  });
});