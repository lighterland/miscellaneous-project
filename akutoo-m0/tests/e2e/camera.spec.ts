import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

function watchNetwork(context: BrowserContext) {
  const prefix = process.env.M0_DEPLOYED === '1' ? '/miscellaneous-project/akutoo-m0/' : '/';
  const violations: string[] = [];
  const watchSockets = (page: Page) => page.on('websocket', socket => violations.push(`WebSocket ${socket.url()}`));
  context.pages().forEach(watchSockets); context.on('page', watchSockets);
  context.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const path = url.pathname.startsWith(prefix) ? '/' + url.pathname.slice(prefix.length) : '';
      const staticAsset = /^\/(?:$|index\.html$|favicon\.ico$|(?:registerSW|sw|workbox-[\w-]+)\.js$|assets\/[\w.-]+\.(?:js|css)$|models\/face_landmarker\.task$|wasm\/vision_wasm_(?:nosimd_)?internal\.(?:js|wasm)$)/.test(path);
      if (url.origin !== 'http://localhost:5173' || !staticAsset || url.search || !['GET', 'HEAD'].includes(request.method()) || request.postDataBuffer())
        violations.push(`${request.method()} ${url.origin}${url.pathname}`);
    }
  });
  return violations;
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Start camera / new run' }).click();
  await expect(page.locator('#status')).toContainText('Running.', { timeout: 40000 });
  await expect(page.locator('#fps')).not.toHaveText('0.0');
}
async function capture(page: Page) {
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download JPEG' })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download JPEG' }).click();
  return readFile((await (await downloaded).path())!);
}

test('canvas capture, report, stopped tracks and offline reload send no image data', async ({ page, context }) => {
  const violations = watchNetwork(context);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(window, 'ImageCapture', { value: undefined }));
  await page.goto('./');
  await start(page);
  await expect(page.locator('#available')).toHaveText('No');
  const jpeg = await capture(page);
  expect(jpeg.subarray(0, 2).toString('hex')).toBe('ffd8');
  expect(jpeg.includes(Buffer.from('Exif\0\0'))).toBe(false);
  await expect(page.locator('#photo')).toContainText('canvas');
  expect(await page.locator('#photo-preview').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Copy report' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('User agent:');
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.srcObject)).toBeNull();
  await expect(page.getByRole('button', { name: 'Capture', exact: true })).toBeDisabled();
  await expect(page.locator('#offline')).toContainText('Offline files ready', { timeout: 40000 });
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(new URL('./', page.url()).href);
  await context.setOffline(true);
  await page.reload();
  await start(page);
  await capture(page);
  expect(violations).toEqual([]); expect(errors).toEqual([]);
});

test('takePhoto output is re-encoded without EXIF at the still-photo resolution', async ({ page, context }) => {
  const violations = watchNetwork(context);
  await page.addInitScript(() => {
    class TestImageCapture {
      async takePhoto() {
        const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
        canvas.getContext('2d')!.fillRect(0, 0, 800, 600);
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg'));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        // Insert a valid JPEG APP1 segment containing a minimal EXIF/TIFF header.
        const exif = new Uint8Array([255,225,0,22,69,120,105,102,0,0,73,73,42,0,8,0,0,0,0,0,0,0,0,0]);
        return new Blob([bytes.slice(0, 2), exif, bytes.slice(2)], { type: 'image/jpeg' });
      }
    }
    Object.defineProperty(window, 'ImageCapture', { value: TestImageCapture });
  });
  await page.goto('./'); await start(page);
  await expect(page.locator('#available')).toHaveText('Yes');
  const jpeg = await capture(page);
  await expect(page.locator('#photo')).toContainText('takePhoto · 800 × 600');
  expect(jpeg.includes(Buffer.from('Exif\0\0'))).toBe(false);
  expect(violations).toEqual([]);
});

test('takePhoto failure falls back and denied permission can be retried', async ({ page, context }) => {
  const violations = watchNetwork(context);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let denied = false;
    navigator.mediaDevices.getUserMedia = constraints => {
      if (!denied) { denied = true; return Promise.reject(new DOMException('Denied', 'NotAllowedError')); }
      return original(constraints);
    };
    class BrokenImageCapture { async takePhoto(): Promise<Blob> { throw new Error('Device failure'); } }
    Object.defineProperty(window, 'ImageCapture', { value: BrokenImageCapture });
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Start camera / new run' }).click();
  await expect(page.locator('#status')).toContainText('Could not complete');
  await page.locator('#camera').selectOption('environment');
  await start(page); await capture(page);
  await expect(page.locator('#photo')).toContainText('takePhoto failed');
  expect(violations).toEqual([]);
});

test('real face inference measures the captured image and resumes live analysis', async ({ page, context }, testInfo) => {
  const violations = watchNetwork(context);
  const fixture = (await readFile(new URL('../fixtures/portrait.jpg', import.meta.url))).toString('base64');
  await page.addInitScript(async (data) => {
    Object.defineProperty(window, 'ImageCapture', { value: undefined });
    navigator.mediaDevices.getUserMedia = async () => {
      const image = new Image(); image.src = `data:image/jpeg;base64,${data}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 820; canvas.height = 1024;
      const draw = () => { canvas.getContext('2d')!.drawImage(image, 0, 0); requestAnimationFrame(draw); }; draw();
      return canvas.captureStream(15);
    };
  }, fixture);
  await page.goto('./'); await start(page);
  await expect(page.locator('#detected')).toHaveText('Yes');
  await expect(page.locator('#angles')).not.toHaveText('N/A');
  expect(Number(await page.locator('#sharpness').textContent())).toBeGreaterThan(0);
  await capture(page);
  await expect(page.locator('#photo')).not.toContainText('N/A');
  await expect(page.locator('#status')).toContainText('Running.');
  await expect(page.locator('#detected')).toHaveText('Yes');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('mobile-preview.png'), fullPage: true });
  expect(violations).toEqual([]);
});
