import { defineConfig, devices } from '@playwright/test';

/**
 * Salesforce-tuned Playwright defaults:
 *  - longer action timeouts (Lightning is slow on first navigation)
 *  - storageState reused across tests (login once)
 *  - trace + video on first retry for easier debugging
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: process.env['SFDC_STORAGE_STATE'] ?? undefined,
  },
  projects: [
    {
      name: 'chrome',
      // Uses the system-installed Chrome (no Playwright download needed).
      // Required in environments where the Playwright CDN is firewalled.
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
