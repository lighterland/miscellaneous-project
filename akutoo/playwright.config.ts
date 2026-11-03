import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, workers: 1,
  use: { baseURL: 'http://localhost:5174', browserName: 'chromium', channel: process.env.AKUTOO_BROWSER_CHANNEL ?? 'chromium', acceptDownloads: true,
    permissions: ['camera'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } },
  webServer: { command: 'npm run preview', url: 'http://localhost:5174', reuseExistingServer: false },
});
