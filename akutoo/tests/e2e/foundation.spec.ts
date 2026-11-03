import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';

test('local storage survives reload, trial ZIP is valid, and offline shell works', async ({ page, context }) => {
  const violations: string[] = [];
  context.on('request', request => {
    if (!['http:', 'https:'].includes(new URL(request.url()).protocol)) return;
    if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET', 'HEAD'].includes(request.method()) || request.postDataBuffer()) violations.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your sessions' })).toBeVisible();
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check local storage' }).click();
  await expect(page.getByText('Local storage is ready.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Local storage is ready.', { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download test ZIP' }).click();
  const download = await downloadEvent;
  const entries = unzipSync(await readFile((await download.path())!));
  const key = Object.keys(entries).find(name => name.endsWith('/metadata.json'))!;
  expect(JSON.parse(strFromU8(entries[key]))).toMatchObject({ trial: true, images: [] });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your sessions' })).toBeVisible();
  await expect(page.getByText('Local storage is ready.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check local storage' }).click();
  await expect(page.getByText('Local storage is ready.', { exact: true })).toBeVisible();
  expect(violations).toEqual([]);
});

test('install manifest and responsive home have no fabricated sessions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('No sessions yet')).toBeVisible();
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.impeccable/review/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.impeccable/review/desktop.png', fullPage: true });
});

test('persistent storage denial stays explicit and can be retried', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'persisted', { value: async () => false });
    Object.defineProperty(navigator.storage, 'persist', { value: async () => !!(window as any).grantPersistence });
  });
  await page.goto('/');
  await expect(page.getByText('Storage is best effort.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Request persistent storage', exact: true }).click();
  await expect(page.getByText('Storage is best effort.', { exact: false })).toBeVisible();
  await page.evaluate(() => { (window as any).grantPersistence = true; });
  await page.getByRole('button', { name: 'Request persistent storage', exact: true }).click();
  await expect(page.getByText('Persistent storage is granted.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request persistent storage', exact: true })).toHaveCount(0);
});

