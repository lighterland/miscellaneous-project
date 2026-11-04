import { expect, test, type Page } from '@playwright/test';

async function capture(page: Page, name: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.evaluate(async () => { scrollTo(0, 0); await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true, animations: 'disabled' });
}

async function stored(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const open = indexedDB.open('akutoo'); open.onsuccess = () => resolve(open.result); });
    const all = (table: string) => new Promise<any[]>(resolve => { const get = database.transaction(table).objectStore(table).getAll(); get.onsuccess = () => resolve(get.result); });
    const sessions = await all('sessions'), photos = await all('photos'), settings = await all('settings'); database.close();
    const paths: string[] = []; async function walk(directory: FileSystemDirectoryHandle, prefix = '') { for await (const [name, item] of (directory as any).entries()) { if (item.kind === 'directory') await walk(item, prefix + name + '/'); else paths.push(prefix + name); } }
    await walk(await navigator.storage.getDirectory()); return { sessions, photos, settings, paths: paths.sort() };
  });
}
async function seedPhotos(page: Page) {
  await page.goto('/'); await expect(page.getByText('Ready offline', { exact: true })).toBeVisible({timeout:30000});
  await page.getByRole('button', { name: 'Start new session', exact: true }).click(); await page.getByRole('button', { name: 'Finish for now', exact: true }).click(); await page.getByRole('button', { name: 'Back to sessions', exact: true }).click();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const open = indexedDB.open('akutoo'); open.onsuccess = () => resolve(open.result); });
    const session: any = await new Promise(resolve => { const get = database.transaction('sessions').objectStore('sessions').getAll(); get.onsuccess = () => resolve(get.result[0]); });
    const root = await navigator.storage.getDirectory(), directory = await (await root.getDirectoryHandle('sessions', { create: true })).getDirectoryHandle(session.id, { create: true }), thumbs = await root.getDirectoryHandle('thumbs', { create: true });
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#c04080'; ctx.fillRect(0,0,64,64);
    const image = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/jpeg'));
    const photos: any[] = [];
    for (let i = 0; i < 3; i++) {
      const id = crypto.randomUUID();
      const file = await directory.getFileHandle(`${id}.jpg`, { create: true }), writer = await file.createWritable(); await writer.write(image); await writer.close();
      if (i < 2) {
        const writer = await (await thumbs.getFileHandle(`${id}.jpg`, { create: true })).createWritable(); await writer.write(image); await writer.close();
        photos.push({ id, sessionId: session.id, source: 'captured', opfsPath: `sessions/${session.id}/${id}.jpg`, thumbPath: `thumbs/${id}.jpg`, width: 64, height: 64, createdAt: i+1, override: true, quality: { tier: 'D', score: 0, hardFailure: true, reason: 'resolution' } });
      }
    }
    const notes = await (await directory.getFileHandle('keep-notes.txt', { create: true })).createWritable(); await notes.write('Unrecognized file must survive deletion'); await notes.close();
    await new Promise<void>(resolve => { const tx = database.transaction(['sessions','photos','settings'], 'readwrite'); photos.forEach(photo => tx.objectStore('photos').add(photo)); tx.objectStore('sessions').put({ ...session, progress: { ...session.progress, savedIds: photos.map(photo => photo.id) } }); tx.objectStore('settings').put({ key: 'preferences', value: { units: 'imperial', voice: true } }); tx.oncomplete = () => resolve(); }); database.close();
  });
  await page.reload(); await expect(page.getByText('2 photos saved', { exact: true })).toBeVisible();
}
async function confirmErase(page: Page) {
  await page.getByRole('button', { name: 'Delete all Akutoo data…', exact: true }).click();
  await page.getByRole('checkbox', { name: 'I have exported what I need and understand that local photos will be deleted.', exact: true }).check();
  await page.getByRole('textbox', { name: 'Type DELETE to confirm', exact: true }).fill('DELETE');
  await page.getByRole('button', { name: 'Delete data permanently', exact: true }).click();
}

test('preferences survive reload and the capture voice control updates the saved preference', async ({ page, context }) => {
  const violations: string[] = []; context.on('request', request => { if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET','HEAD'].includes(request.method()) || request.postDataBuffer()) violations.push(request.url()); });
  await page.addInitScript(() => {
    const media = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = () => media({ video: { width: { ideal: 1280 }, height: { ideal: 1024 } } });
    const Worker = window.Worker; window.Worker = class { constructor(url: string | URL, options?: WorkerOptions) { if (String(url).includes('worker-')) throw new Error('Synthetic unavailable model'); return new Worker(url, options); } } as any;
    speechSynthesis.speak = utterance => { (window as any).spokenInstruction = utterance.text; }; speechSynthesis.cancel = () => undefined;
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Voice guidance', exact: true }).check(); await page.getByRole('combobox', { name: 'Units', exact: true }).selectOption('imperial'); await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByText('Preferences saved on this device.', { exact: true })).toBeVisible();
  await capture(page, 'settings-mobile', 390, 844); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, 'settings-desktop', 1280, 900);
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await expect(page.getByRole('checkbox', { name: 'Voice guidance', exact: true })).toBeChecked(); await expect(page.getByRole('combobox', { name: 'Units', exact: true })).toHaveValue('imperial');
  await page.getByRole('button', { name: 'Back to sessions', exact: true }).click(); await page.getByRole('button', { name: 'Start new session', exact: true }).click(); await page.getByRole('button', { name: 'Start scan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Voice on', exact: true })).toBeVisible(); await expect.poll(() => page.evaluate(() => (window as any).spokenInstruction)).toBe('Face the camera. I will guide you through the scan.');
  await page.getByRole('button', { name: 'Voice on', exact: true }).click(); await expect(page.getByRole('button', { name: 'Voice off', exact: true })).toBeVisible();
  await expect.poll(async () => (await stored(page)).settings.find(item => item.key === 'preferences')?.value.voice).toBe(false);
  expect(violations).toEqual([]);
});

test('deletion requires acknowledgement and the exact keyword, cancel preserves data, and confirmed deletion keeps offline assets', async ({ page, context }) => {
  await seedPhotos(page); const before = await stored(page); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Delete all Akutoo data…', exact: true }).click();
  const erase = page.getByRole('button', { name: 'Delete data permanently', exact: true }); await expect(erase).toBeDisabled();
  await page.getByRole('textbox', { name: 'Type DELETE to confirm', exact: true }).fill('DELETE'); await expect(erase).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I have exported what I need and understand that local photos will be deleted.', exact: true }).check(); await page.getByRole('textbox', { name: 'Type DELETE to confirm', exact: true }).fill('delete'); await expect(erase).toBeDisabled();
  await capture(page, 'delete-confirm-mobile', 390, 844);
  await capture(page, 'delete-confirm-desktop', 1280, 900);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(await stored(page)).toEqual(before);
  await confirmErase(page); await expect(page.getByText('Akutoo sessions, recognized photo files and preferences were deleted from this browser.', { exact: true })).toBeVisible({ timeout: 30_000 });
  const after = await stored(page); expect(after.sessions).toEqual([]); expect(after.photos).toEqual([]); expect(after.settings).toEqual([]); expect(after.paths).toEqual(before.paths.filter(path => path.endsWith('keep-notes.txt')));
  await page.getByRole('button', { name: 'Back to sessions', exact: true }).click(); await expect(page.getByText('No sessions yet', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true); await context.setOffline(true); await page.reload(); await expect(page.getByRole('heading', { name: 'Your sessions', exact: true })).toBeVisible(); await expect(page.getByText('No sessions yet', { exact: true })).toBeVisible();
});

test('a partially failed confirmed deletion retains its intent and resumes safely after reopening', async ({ page }) => {
  await seedPhotos(page); const before = await stored(page); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.evaluate(() => { const remove = FileSystemDirectoryHandle.prototype.removeEntry; FileSystemDirectoryHandle.prototype.removeEntry = async function(name, options) { if (name.endsWith('.jpg')) throw new DOMException('Synthetic deletion error', 'UnknownError'); return remove.call(this, name, options); }; });
  await confirmErase(page); await expect(page.getByText('Deletion could not finish. The confirmed file list was kept; retry or reopen Akutoo to resume.', { exact: true })).toBeVisible();
  const interrupted = await stored(page); expect(interrupted.sessions).toEqual([]); expect(interrupted.photos).toEqual([]); expect(interrupted.paths).toEqual(before.paths);
  await expect(page.getByText('0 sessions · 0 photo entries', { exact: true })).toBeVisible();
  const intent = interrupted.settings.find(item => item.key === 'pending-deletion')?.value;
  expect(intent).toMatchObject({ confirmed: true, version: 1 });
  expect([...intent.paths].sort()).toEqual(before.paths.filter(path => path.endsWith('.jpg')).sort());
  await capture(page, 'delete-error-mobile', 390, 844); await capture(page, 'delete-error-desktop', 1280, 900);
  await page.reload(); await expect(page.getByText('The previously confirmed deletion finished. Local Akutoo data was removed.', { exact: true })).toBeVisible();
  const after = await stored(page); expect(after.settings).toEqual([]); expect(after.paths).toEqual(before.paths.filter(path => path.endsWith('keep-notes.txt')));
});
