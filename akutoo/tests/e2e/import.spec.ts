import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

async function fixtures(page: Page, unavailable = false) {
  await page.addInitScript(unavailable => {
    const Original = window.Worker;
    (window as any).originalMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async () => { throw new Error('Gallery import must not request a camera'); };
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(value, key) { if (this.name === 'photos' && (window as any).failImport) throw new DOMException('Fixture quota failure', 'QuotaExceededError'); return key === undefined ? add.call(this, value) : add.call(this, value, key); };
    window.Worker = class {
      onmessage: ((event: any) => void) | null = null;
      constructor(url: string | URL, options?: WorkerOptions) { if (!String(url).includes('worker-')) return new Original(url, options) as any; if (unavailable) throw new Error('Fixture worker unavailable'); }
      postMessage(message: any) {
        if (message.type === 'load') { (window as any).importModelLoads = ((window as any).importModelLoads ?? 0) + 1; setTimeout(() => this.onmessage?.({ data: { id: message.id, type: 'ready' } }), 5); return; }
        const { width, height } = message.bitmap, canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d')!;
        ctx.drawImage(message.bitmap, 0, 0); message.bitmap.close(); const pixel = ctx.getImageData(0,0,1,1).data;
        const result = { measurements: { faceCount: pixel[1] < 50 ? 2 : 1, occluded: false, occlusionVerified: false, headCutOff: false, sharpness: pixel[2] < 10 ? .5 : Math.round(pixel[2] / 10) * 10, clipped: .01, exposure: 120, faceRatio: .5, shortSide: Math.min(width,height), angleError: 0, expressionMatch: 1 }, pose: { yaw: Math.round((pixel[0] - 30) / 50) * 15, pitch: 0, roll: 0 }, blendshapes: { mouthSmileLeft: pixel[1] > 200 ? .8 : 0, mouthSmileRight: pixel[1] > 200 ? .8 : 0, jawOpen: 0 }, hash: '0000000000000000', ratios: { eyeSpan: .3, faceWidth: .7 }, occlusionVerified: false, durationMs: 5 };
        if ((window as any).captureFixture) { result.measurements.faceCount = 1; result.measurements.sharpness = 200; result.pose = { yaw: 0, pitch: 0, roll: 0 }; result.blendshapes.mouthSmileLeft = result.blendshapes.mouthSmileRight = 0; }
        setTimeout(() => this.onmessage?.({ data: { id: message.id, type: 'result', result } }), 5);
      }
      terminate() {}
    } as any;
  }, unavailable);
}
async function chooseFiles(page: Page, secondBatch = false) {
  await page.evaluate(async second => {
    const transfer = new DataTransfer();
    const specs = second ? [['new-angle.jpg',180,128,100,1280],['other-angle.jpg',230,128,100,1280],['smile.jpg',30,230,100,1280]] : [['front.jpg',30,128,100,1280],['turn.jpg',80,128,100,1280],['side.jpg',130,128,100,1280],['duplicate.jpg',30,128,80,1280],['blur.jpg',180,128,0,1280],['two-faces.jpg',230,0,100,1280],['small.jpg',180,128,100,800]];
    for (const [name,r,g,b,width] of specs) {
      const canvas = document.createElement('canvas'); canvas.width = Number(width); canvas.height = width === 800 ? 800 : 1024;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(0,0,canvas.width,canvas.height);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/jpeg', .92)); let bytes = new Uint8Array(await blob.arrayBuffer());
      if (name === 'front.jpg') {
        const tiff = new Uint8Array(256), view = new DataView(tiff.buffer), write = (offset: number, value: string) => tiff.set(new TextEncoder().encode(value), offset);
        tiff.set([73,73,42,0,8,0,0,0]); view.setUint16(8,3,true);
        view.setUint16(10,0x010f,true); view.setUint16(12,2,true); view.setUint32(14,5,true); view.setUint32(18,100,true); write(100,'Test\0');
        view.setUint16(22,0x0110,true); view.setUint16(24,2,true); view.setUint32(26,3,true); write(30,'Z9\0');
        view.setUint16(34,0x8769,true); view.setUint16(36,4,true); view.setUint32(38,1,true); view.setUint32(42,160,true);
        view.setUint16(160,1,true); view.setUint16(162,0x9003,true); view.setUint16(164,2,true); view.setUint32(166,20,true); view.setUint32(170,220,true); write(220,'2024:03:09 10:11:12\0');
        const segment = new Uint8Array(266); segment.set([255,225,1,8,69,120,105,102,0,0]); segment.set(tiff,10);
        const joined = new Uint8Array(bytes.length + segment.length); joined.set(bytes.subarray(0,2)); joined.set(segment,2); joined.set(bytes.subarray(2),268); bytes = joined;
      }
      transfer.items.add(new File([bytes], String(name), { type: 'image/jpeg', lastModified: 1700000000000 }));
    }
    if (!second) transfer.items.add(new File(['not an image'], 'broken.jpg', { type: 'image/jpeg' }));
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!; input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  }, secondBatch);
}
async function savedState(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const req = indexedDB.open('akutoo'); req.onsuccess = () => resolve(req.result); });
    const all = (table: string) => new Promise<any[]>(resolve => { const req = database.transaction(table).objectStore(table).getAll(); req.onsuccess = () => resolve(req.result); });
    const photos = await all('photos'), sessions = await all('sessions'); database.close();
    const root = await navigator.storage.getDirectory(), paths: string[] = [];
    async function walk(dir: FileSystemDirectoryHandle, prefix = '') { for await (const [name, entry] of (dir as any).entries()) { if (entry.kind === 'directory') await walk(entry, prefix + name + '/'); else paths.push(prefix + name); } }
    await walk(root);
    return { photos, session: sessions[0], paths: paths.sort() };
  });
}
async function importThree(page: Page, second = false) {
  await chooseFiles(page, second); await page.getByRole('checkbox', { name: 'I confirm that every selected photo is of me and I have the right to use it.', exact: true }).check();
  await page.getByRole('button', { name: 'Analyze photos', exact: true }).click(); await page.getByRole('button', { name: 'Add 3 photos to session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible({ timeout: 30_000 });
}

test('startup preserves unlinked generated files and reports a missing original without deleting its metadata', async ({ page }) => {
  await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Import photos', exact: true }).click(); await importThree(page);
  const before = await savedState(page);
  const extra = await page.evaluate(async state => {
    const root = await navigator.storage.getDirectory(), session = await (await root.getDirectoryHandle('sessions')).getDirectoryHandle(state.session.id), thumbs = await root.getDirectoryHandle('thumbs');
    const id = crypto.randomUUID();
    for (const [directory, name] of [[session, `${id}.jpg`], [thumbs, `${id}.jpg`], [session, 'keep-notes.txt']] as const) { const file = await directory.getFileHandle(name, { create: true }); const writer = await file.createWritable(); await writer.write('synthetic interrupted file'); await writer.close(); }
    await session.removeEntry(state.photos[0].opfsPath.split('/').at(-1));
    return { orphan: [`sessions/${state.session.id}/${id}.jpg`, `thumbs/${id}.jpg`], unknown: `sessions/${state.session.id}/keep-notes.txt` };
  }, before);
  await page.reload();
  await expect(page.getByText('Found 2 photo files without a metadata link. The files were kept; a missing link does not prove a failed save.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('1 saved photo is missing');
  const after = await savedState(page); expect(after.photos).toEqual(before.photos); expect(after.paths).toContain(extra.unknown);
  extra.orphan.forEach(path => expect(after.paths).toContain(path));
  before.photos.slice(1).forEach(photo => expect(after.paths).toContain(photo.opfsPath));
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.impeccable/review/storage-recovery-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: '.impeccable/review/storage-recovery-desktop.png', fullPage: true });
});

test('a stale window cannot delete photos or overwrite progress after another window imports', async ({ page, context }) => {
  await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Import photos', exact: true }).click(); await importThree(page);
  const stale = await context.newPage(); await fixtures(stale); await stale.goto('/'); await stale.getByRole('button', { name: 'Review photos', exact: true }).click(); await stale.getByRole('button', { name: 'Photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'Import photos', exact: true }).click(); await importThree(page, true); const current = await savedState(page);
  await stale.getByRole('button', { name: 'Delete this photo', exact: true }).click(); await stale.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(stale.getByRole('alert')).toHaveText('This session changed in another window. Go back to sessions and reopen it before changing photos.');
  expect(await savedState(stale)).toEqual(current);
  await stale.setViewportSize({ width: 390, height: 844 }); await stale.screenshot({ path: '.impeccable/review/session-conflict-mobile.png', fullPage: true });
  await stale.setViewportSize({ width: 1280, height: 900 }); await stale.screenshot({ path: '.impeccable/review/session-conflict-desktop.png', fullPage: true });
  await stale.close();
});

test('startup recovery waits for another window to commit a photo before considering its file unused', async ({ page, context }) => {
  await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Import photos', exact: true }).click(); await importThree(page);
  await page.evaluate(() => { void navigator.locks.request('akutoo-photo-files-v1', async () => { (window as any).holdingFiles = true; await new Promise<void>(resolve => { (window as any).releaseFiles = resolve; }); }); });
  await expect.poll(() => page.evaluate(() => !!(window as any).holdingFiles)).toBe(true);
  const before = await savedState(page), photo = before.photos[0];
  const pending = await page.evaluate(async photo => {
    const root = await navigator.storage.getDirectory(), directory = await (await root.getDirectoryHandle('sessions')).getDirectoryHandle(photo.sessionId), id = crypto.randomUUID();
    const file = await directory.getFileHandle(`${id}.jpg`, { create: true }), writer = await file.createWritable(); await writer.write(new Blob(['synthetic pending file'])); await writer.close();
    return { ...photo, id, opfsPath: `sessions/${photo.sessionId}/${id}.jpg`, thumbPath: undefined };
  }, photo);
  const opening = await context.newPage(); await opening.goto('/');
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).pending?.some(lock => lock.name === 'akutoo-photo-files-v1'))).toBe(true);
  await page.evaluate(async photo => {
    const database = await new Promise<IDBDatabase>(resolve => { const req = indexedDB.open('akutoo'); req.onsuccess = () => resolve(req.result); });
    await new Promise<void>((resolve, reject) => { const tx = database.transaction(['photos','sessions'],'readwrite'), sessionTable = tx.objectStore('sessions'), get = sessionTable.get(photo.sessionId); tx.objectStore('photos').add(photo); get.onsuccess = () => sessionTable.put({ ...get.result, revision: (get.result.revision ?? 0) + 1, progress: { ...get.result.progress, savedIds: [...get.result.progress.savedIds, photo.id] } }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    database.close(); (window as any).releaseFiles();
  }, pending);
  await expect.poll(() => opening.evaluate(async () => (await navigator.locks.query()).held?.some(lock => lock.name === 'akutoo-photo-files-v1') ?? false)).toBe(false);
  const after = await savedState(opening); expect(after.photos).toHaveLength(4); expect(after.paths).toContain(pending.opfsPath); await opening.close();
});

test('an imported retake replaces only its original and leaves guided slots untouched; unknown pose requires a choice', async ({ page }) => {
  test.setTimeout(90_000); await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Import photos', exact: true }).click(); await importThree(page);
  const before = await savedState(page);
  const original = before.photos.find(photo => photo.sourceName === 'front.jpg')!, unknown = before.photos.find(photo => photo.sourceName === 'turn.jpg')!;
  await page.getByRole('button', { name: 'Photo 1', exact: true }).click(); await expect(page.getByRole('combobox', { name: 'Instruction for the new photo', exact: true })).toHaveValue('turn-0');
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.impeccable/review/import-retake-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: '.impeccable/review/import-retake-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Retake this photo', exact: true }).click();
  await page.evaluate(() => { (window as any).captureFixture = true; navigator.mediaDevices.getUserMedia = () => (window as any).originalMedia({ video: { width: { ideal: 1280 }, height: { ideal: 1024 } } }); });
  await page.getByRole('button', { name: 'Start camera', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Your scan is saved', exact: true })).toBeVisible({ timeout: 30_000 });
  const after = await savedState(page); expect(after.photos).toHaveLength(3); expect(after.photos.filter(photo => photo.source === 'captured')).toHaveLength(1);
  expect(after.session.progress).toMatchObject({ index: 0, completed: [] }); expect(after.photos.some(photo => photo.id === original.id)).toBe(false);
  expect(after.paths).not.toContain(original.opfsPath); before.photos.filter(photo => photo.id !== original.id).forEach(photo => expect(after.paths).toContain(photo.opfsPath));
  await page.evaluate(async id => {
    const database = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('akutoo'); request.onsuccess = () => resolve(request.result); });
    await new Promise<void>(resolve => { const tx = database.transaction('photos','readwrite'), table = tx.objectStore('photos'), get = table.get(id); get.onsuccess = () => table.put({ ...get.result, pose: null, binId: undefined }); tx.oncomplete = () => resolve(); }); database.close();
  }, unknown.id);
  await page.reload(); await page.getByRole('button', { name: 'Review photos', exact: true }).click(); await page.getByRole('button', { name: 'Photo 1', exact: true }).click();
  const target = page.getByRole('combobox', { name: 'Instruction for the new photo', exact: true }); await expect(target).toHaveValue(''); await expect(page.getByRole('button', { name: 'Retake this photo', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.impeccable/review/import-retake-unknown-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: '.impeccable/review/import-retake-unknown-desktop.png', fullPage: true });
  await target.selectOption('chin-up'); await page.getByRole('button', { name: 'Retake this photo', exact: true }).click(); await expect(page.getByText('Raise your chin a little.', { exact: true })).toBeVisible();
  expect((await savedState(page)).photos).toHaveLength(3);
});
test('gallery import requires ownership, explains failures and saves local EXIF-free photos without advancing scan', async ({ page, context }) => {
  const violations: string[] = []; context.on('request', req => { if (new URL(req.url()).origin !== 'http://localhost:5174' || !['GET','HEAD'].includes(req.method()) || req.postDataBuffer()) violations.push(req.url()); });
  await fixtures(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Import photos', exact: true }).click();
  await page.screenshot({ path: '.impeccable/review/import-empty-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: '.impeccable/review/import-empty-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await chooseFiles(page);
  await expect(page.getByRole('button', { name: 'Analyze photos', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as any).importModelLoads ?? 0)).toBe(0);
  await page.getByRole('checkbox', { name: 'I confirm that every selected photo is of me and I have the right to use it.', exact: true }).check();
  await page.getByRole('button', { name: 'Analyze photos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add 3 photos to session', exact: true })).toBeVisible();
  await expect(page.getByText('This angle and expression are already covered.', { exact: true })).toBeVisible();
  await expect(page.getByText('Face sharpness is below the batch-relative minimum.', { exact: true })).toBeVisible();
  await expect(page.getByText('Keep a photo with exactly one face. Multiple-face photos are not cropped automatically.', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Keep blur.jpg anyway, marked risky', exact: true }).check();
  await page.locator('section[aria-labelledby="import-results-title"]').screenshot({ path: '.impeccable/review/import-results-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 }); await page.locator('section[aria-labelledby="import-results-title"]').screenshot({ path: '.impeccable/review/import-results-desktop.png' });
  await page.getByRole('button', { name: 'Add 4 photos to session', exact: true }).click();
  // Four full re-encodes and OPFS writes can exceed the default assertion window.
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible({ timeout: 30_000 });
  const state = await savedState(page); expect(state.photos).toHaveLength(4); expect(state.session.progress).toMatchObject({ index: 0, completed: [] });
  expect(state.session.progress.savedIds).toHaveLength(4); expect(state.photos.filter(photo => photo.override)).toHaveLength(1);
  expect(state.photos.every(photo => photo.source === 'imported' && photo.ownershipDeclared && !photo.identityConfirmed)).toBe(true);
  await page.getByRole('combobox', { name: 'Photos to include', exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'Create ZIP', exact: true }).click(); const save = page.getByRole('link', { name: 'Save ZIP', exact: true }); await expect(save).toBeVisible();
  const download = page.waitForEvent('download'); await save.click(); const zip = unzipSync(await readFile((await (await download).path())!));
  const metadata = JSON.parse(strFromU8(zip[Object.keys(zip).find(name => name.endsWith('/metadata.json'))!]));
  expect(metadata.images.find((photo: any) => photo.sourceProvenance.fileName === 'front.jpg').sourceProvenance).toMatchObject({ originalTakenAt: '2024-03-09T10:11:12', originalTimezone: null, camera: 'Test Z9', fileModifiedAt: 1700000000000 });
  for (const [path, bytes] of Object.entries(zip)) if (path.endsWith('.jpg')) { expect(Array.from(bytes.subarray(0,2))).toEqual([255,216]); expect(new TextDecoder().decode(bytes).includes('Exif')).toBe(false); }
  await page.reload(); await expect(page.getByText('4 photos saved', { exact: true })).toBeVisible(); expect(violations).toEqual([]);
});
test('failed import commit removes only its new files and can be retried without losing existing photos', async ({ page }) => {
  await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Import photos', exact: true }).click(); await chooseFiles(page);
  await page.getByRole('checkbox', { name: 'I confirm that every selected photo is of me and I have the right to use it.', exact: true }).check();
  await page.getByRole('button', { name: 'Analyze photos', exact: true }).click(); await page.getByRole('button', { name: 'Add 3 photos to session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible({ timeout: 30_000 }); const before = await savedState(page);
  await page.getByRole('button', { name: 'Import photos', exact: true }).click(); await chooseFiles(page, true);
  await page.getByRole('checkbox', { name: 'I confirm that every selected photo is of me and I have the right to use it.', exact: true }).check();
  await page.getByRole('button', { name: 'Analyze photos', exact: true }).click(); await expect(page.getByRole('button', { name: 'Add 3 photos to session', exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).failImport = true; }); await page.getByRole('button', { name: 'Add 3 photos to session', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Photos could not be added.'); const failed = await savedState(page);
  expect(failed.photos.map(photo => photo.id).sort()).toEqual(before.photos.map(photo => photo.id).sort()); expect(failed.paths).toEqual(before.paths);
  await page.screenshot({ path: '.impeccable/review/import-save-error-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.impeccable/review/import-save-error-mobile.png', fullPage: true });
  await page.evaluate(() => { (window as any).failImport = false; }); await page.getByRole('button', { name: 'Add 3 photos to session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible({ timeout: 30_000 }); expect((await savedState(page)).photos).toHaveLength(6);
});
test('unavailable analysis leaves decoded imports available only through explicit risky retention', async ({ page }) => {
  await fixtures(page, true); await page.goto('/'); await page.getByRole('button', { name: 'Import photos', exact: true }).click(); await chooseFiles(page);
  await page.getByRole('checkbox', { name: 'I confirm that every selected photo is of me and I have the right to use it.', exact: true }).check();
  await page.getByRole('button', { name: 'Analyze photos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add 0 photos to session', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Keep front.jpg anyway, marked risky', exact: true }).check();
  await page.getByRole('button', { name: 'Add 1 photo to session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible({ timeout: 30_000 });
  const state = await savedState(page); expect(state.photos).toHaveLength(1);
  expect(state.photos[0]).toMatchObject({ override: true, source: 'imported', importReason: 'analysis', quality: { tier: 'D' } });
  await expect(page.getByRole('button', { name: 'Create ZIP', exact: true })).toBeDisabled();
});
