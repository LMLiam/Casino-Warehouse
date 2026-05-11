import { defineConfig, devices } from '@playwright/test';

const playwrightHost = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '4173';
const playwrightBaseURL = `http://${playwrightHost}:${playwrightPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: playwrightBaseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `HOST=${playwrightHost} PORT=${playwrightPort} npm run dev:server`,
    url: playwrightBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'laptop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
  ],
});
