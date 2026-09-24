import { test, expect } from '@playwright/test';

/**
 * CI smoke suite: runs against a locally built server backed by a disposable,
 * migrated and synthetically seeded PostgreSQL database. It must never need
 * production, real credentials, or third-party providers.
 */
test.describe('smoke: public pages', () => {
  test('marketing home renders', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/Fleetvera/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fleet operations');
  });

  test('pricing renders', async ({ page }) => {
    const response = await page.goto('/pricing');
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  for (const path of ['/about', '/privacy-policy', '/terms-of-service']) {
    test(`${path} renders`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.ok()).toBe(true);
      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  }

  test('login page renders the email code form', async ({ page }) => {
    const response = await page.goto('/auth/login');
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Login Code/ })).toBeVisible();
  });
});

test.describe('smoke: API', () => {
  test('health endpoint reports the database as reachable', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  for (const path of ['/api/auth/me', '/api/vehicles', '/api/subscription/status']) {
    test(`${path} rejects unauthenticated requests`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(401);
    });
  }
});
