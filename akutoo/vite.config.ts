import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  worker: { format: 'iife' },
  plugins: [tailwindcss(), VitePWA({
    registerType: 'prompt',
    manifest: { name: 'Akutoo', short_name: 'Akutoo', description: 'Your personal photo dataset, on your device.', start_url: './', scope: './', display: 'standalone', theme_color: '#F4F1FB', background_color: '#F4F1FB', icons: [192, 512].map(size => ({ src: `icons/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })) },
    workbox: { globPatterns: ['**/*.{html,js,css,png,svg,woff2,wasm,task,tflite}'], maximumFileSizeToCacheInBytes: 20000000, cleanupOutdatedCaches: true, navigateFallback: 'index.html' },
  })],
  test: { include: ['tests/unit/**/*.test.ts'] },
});
