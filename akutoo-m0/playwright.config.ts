import { defineConfig } from '@playwright/test';
const deployed = process.env.M0_DEPLOYED === '1';
export default defineConfig({
  testDir: 'tests/e2e', timeout: 60000, workers: 1,
  use: {
    baseURL: deployed ? 'http://localhost:5173/miscellaneous-project/akutoo-m0/' : 'http://localhost:5173/', browserName: 'chromium', channel: process.env.M0_BROWSER_CHANNEL ?? 'chromium',
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    permissions: ['camera', 'clipboard-read', 'clipboard-write'],
  },
  webServer: { command: deployed ? 'node scripts/serve-site.mjs' : 'npm run preview', url: deployed ? 'http://localhost:5173/miscellaneous-project/akutoo-m0/' : 'http://localhost:5173/', reuseExistingServer: false },
});
