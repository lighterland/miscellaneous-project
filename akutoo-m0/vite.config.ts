import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const https = process.env.M0_HTTPS === '1'
  ? { key: readFileSync('.cert/key.pem'), cert: readFileSync('.cert/cert.pem') } : undefined;
export default defineConfig({
  base: './',
  server: { https, allowedHosts: process.env.M0_TUNNEL_HOST ? [process.env.M0_TUNNEL_HOST] : [] },
  plugins: [{
    name: 'third-party-notices',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.txt', source: readFileSync(new URL('./THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8') });
    },
  }, VitePWA({
    registerType: 'autoUpdate', injectRegister: 'auto',
    manifest: false,
    workbox: {
      globPatterns: ['**/*.{js,css,html,wasm,task}'],
      maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      // Model/WASM files are required offline, not fetched from a CDN at runtime.
      cleanupOutdatedCaches: true,
    },
  })],
  test: { include: ['tests/*.test.ts'] },
});
