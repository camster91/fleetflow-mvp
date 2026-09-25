import { defineConfig, devices } from '@playwright/test'
import { LOCAL_BASE_URL, resolveBaseURL } from './e2e/support/base-url'
import { E2E_EMAIL_CAPTURE_DIR } from './e2e/support/mail-capture'

// Defaults to a local server; remote/production targets are opt-in (see e2e/support/base-url.ts).
const { baseURL, remote } = resolveBaseURL()

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: { timeout: 15 * 1000 },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /*
   * chromium runs on every PR (`npm run test:e2e:ci`). firefox and webkit are
   * always defined for the release scripts; the 375px mobile project is only
   * added for the nightly cross-browser run (E2E_ALL_BROWSERS=1, see
   * .github/workflows/e2e-nightly.yml) so a bare `npx playwright test` stays
   * desktop-only.
   */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    ...(process.env.E2E_ALL_BROWSERS === '1'
      ? [
          {
            name: 'mobile-375',
            // Chromium at a 375px-wide phone viewport with touch input.
            use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } },
          },
        ]
      : []),
  ],

  /*
   * Serve the production build locally unless an explicit remote target was
   * given. Run `npm run build` first; locally an already-running server on
   * :3000 is reused.
   */
  webServer: !remote
    ? {
        command: 'npm run start',
        url: LOCAL_BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        // Test-only outbound mail capture for auth flows (lib/emailCapture.ts); ignored unless the app URL is loopback http.
        env: { E2E_EMAIL_CAPTURE_DIR },
      }
    : undefined,
})
