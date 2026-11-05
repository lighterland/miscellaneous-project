import { test, expect, type Page } from '@playwright/test';
import { shots } from '../../src/session/shotlist';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

// Only the analysis boundary is deterministic here. Camera pixels, JPEG encoding,
// OPFS and IndexedDB use real browser APIs. analysis.spec.ts executes the real model.
async function injectAnalysis(page: Page, unavailable = false, snapshotPose = false) {
  await page.addInitScript(({ unavailable, snapshotPose }) => {
    const OriginalWorker = window.Worker;
    // Expose the optional sharing UI without opening an OS share target in tests.
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data: ShareData) => !!data.files?.length });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { (window as any).sharedNames = data.files?.map(file => file.name); } });
    (window as any).fixture = { clipped: .01 };
    if(snapshotPose){
      // Encode synthetic pose into captured pixels so JPEG reanalysis observes
      // the original frame, even while the simulated head continues moving.
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,...args:any[]){
        (draw as any).apply(this,args);
        if(args[0] instanceof HTMLVideoElement){const p=(window as any).fixture.pose??{yaw:0,pitch:0};this.fillStyle=`rgb(${p.yaw+100} ${p.pitch+100} 222)`;this.fillRect(0,0,64,64);}
      } as typeof draw;
    }
    window.Worker = class {
      onmessage: ((event: any) => void) | null = null; onerror = null;
      constructor(url: string | URL, options?: WorkerOptions) { if (!String(url).includes('worker-')) return new OriginalWorker(url, options) as any; }
      postMessage(message: any) {
        if (message.type === 'load') { setTimeout(() => this.onmessage?.({ data: unavailable ? { id: message.id, type: 'error', error: 'fixture unavailable' } : { id: message.id, type: 'ready' } }), 5); return; }
        const width = message.bitmap.width, height = message.bitmap.height;
        let snapshot:any;
        if(snapshotPose){const c=new OffscreenCanvas(1,1),ctx=c.getContext('2d')!;ctx.drawImage(message.bitmap,20,20,1,1,0,0,1,1);const rgb=ctx.getImageData(0,0,1,1).data;if(Math.abs(rgb[2]-222)<4)snapshot={yaw:rgb[0]-100,pitch:rgb[1]-100,roll:0};}
        message.bitmap.close();
        const fixture = (window as any).fixture;
        if(!message.still)(window as any).liveMeasurements=((window as any).liveMeasurements??0)+1;
        else (window as any).stillMeasurements=((window as any).stillMeasurements??0)+1;
        const result = { measurements: { faceCount: fixture.faceCount??1, occluded: false, occlusionVerified: false, headCutOff: false, sharpness: width === 2048 ? fixture.sensorSharpness ?? 200 : fixture.sharpness ?? 100, clipped: fixture.clipped, exposure: 120, faceRatio: fixture.faceRatio ?? .5, shortSide: Math.min(width, height), angleError: 0, expressionMatch: 1 }, pose: 'pose' in fixture?fixture.pose:{ yaw: 0, pitch: 0, roll: 0 }, blendshapes: fixture.blendshapes ?? {}, hash: fixture.hash ?? '0000000000000000', durationMs: 5, occlusionVerified: false, ratios: fixture.ratios ?? { eyeSpan: .3, faceWidth: .7 } };
        if(snapshot)result.pose=snapshot;
        if(message.still&&fixture.stillBlendshapes)result.blendshapes=fixture.stillBlendshapes;
        setTimeout(() => this.onmessage?.({ data: { id: message.id, type: 'result', result } }), fixture.delay??5);
      }
      terminate() {}
    } as any;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      // Bound synthetic-camera workload; the production CameraSource still requests 4K.
      const stream = await original({ ...constraints, video: { width: { ideal: 1280 }, height: { ideal: 1024 } } }); (window as any).captureTracks = stream.getTracks(); return stream;
    };
  }, { unavailable, snapshotPose });
}
async function openCamera(page: Page, guided = false) {
  await page.goto('/'); await page.getByRole('button', { name: 'Start new session' }).click();
  if(!guided){
    // Preserve regression coverage for existing free-sweep sessions. New-mode tests
    // below use the real default session without modifying its progress.
    await page.getByRole('button',{name:'Finish for now',exact:true}).click();
    await page.getByRole('button',{name:'Back to sessions',exact:true}).click();
    await page.evaluate(async()=>{
      const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('akutoo');r.onsuccess=()=>resolve(r.result);});
      await new Promise<void>(resolve=>{const tx=database.transaction('sessions','readwrite'),table=tx.objectStore('sessions'),r=table.getAll();r.onsuccess=()=>{const session=r.result[0];delete session.progress.guidedScan;table.put(session);};tx.oncomplete=()=>resolve();});database.close();
    });
    await page.reload();await page.getByRole('button',{name:'Continue session',exact:true}).click();
  }
  await page.getByRole('button', { name: guided?'Start scan':'Start camera', exact: true }).click();
}
async function photoInfo(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('akutoo'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const photos: any[] = await new Promise((resolve, reject) => { const request = database.transaction('photos').objectStore('photos').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    database.close();
    if (!photos.length) return null;
    const photo = photos[0]; let dir = await navigator.storage.getDirectory(); const parts = photo.opfsPath.split('/');
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const file = await (await dir.getFileHandle(parts.at(-1)!)).getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hasExif = bytes.some((_, index) => bytes[index] === 69 && bytes[index+1] === 120 && bytes[index+2] === 105 && bytes[index+3] === 102);
    return { id: photo.id, sharpness: photo.measurements?.sharpness, method: photo.method, streamDimensions: photo.streamDimensions, count: photos.length, width: photo.width, height: photo.height, override: photo.override, tier: photo.quality.tier, jpeg: bytes[0] === 255 && bytes[1] === 216, hasExif, size: bytes.length };
  });
}

async function injectSensor(page: Page, behavior: 'good' | 'throw' | 'pending') {
  await page.addInitScript(behavior => {
    (window as any).sensorCalls = 0;
    (window as any).ImageCapture = class {
      async takePhoto() {
        (window as any).sensorCalls++;
        if (behavior === 'throw') throw new DOMException('Synthetic sensor failure', 'UnknownError');
        if (behavior === 'pending') await new Promise<void>(resolve => { (window as any).releaseSensor = resolve; });
        const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 3072; canvas.getContext('2d')!.fillRect(0,0,2048,3072);
        const encoded = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/jpeg'));
        const bytes = new Uint8Array(await encoded.arrayBuffer());
        return new Blob([new Uint8Array([255,216,255,225,0,8,69,120,105,102,0,0]), bytes.slice(2)], { type: 'image/jpeg' });
      }
    };
  }, behavior);
}

test.describe('Android sensor-photo selection', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/155.0.0.0 Mobile Safari/537.36' });
  for (const behavior of ['good','throw','poor'] as const) test(`sensor ${behavior} preserves measured JPEG evidence and a usable fallback`, async ({ page, context }) => {
    const violations: string[] = []; context.on('request', request => { if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET','HEAD'].includes(request.method()) || request.postDataBuffer()) violations.push(request.url()); });
    await injectAnalysis(page); await injectSensor(page, behavior === 'throw' ? 'throw' : 'good'); await openCamera(page);
    if (behavior === 'poor') await page.evaluate(() => { (window as any).fixture.sensorSharpness = 1; });
    await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => (window as any).sensorCalls)).toBe(1);
    expect(await photoInfo(page)).toMatchObject({ count:1, method:behavior === 'good' ? 'takePhoto' : 'canvas', width:behavior === 'good' ? 2048 : 1280, height:behavior === 'good' ? 3072 : 1024, sharpness:behavior === 'good' ? 200 : 100, jpeg:true, hasExif:false, override:false, streamDimensions:{width:1280,height:1024} });
    expect(violations).toEqual([]);
  });
  test('interrupting a pending sensor photo never saves its late result', async ({ page }) => {
    await injectAnalysis(page); await injectSensor(page, 'pending'); await openCamera(page);
    await expect.poll(() => page.evaluate(() => (window as any).sensorCalls), { timeout:30_000 }).toBe(1);
    await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); (window as any).releaseSensor(); });
    await expect(page.getByText('Camera was interrupted. Start the camera again to continue.', { exact:true })).toBeVisible();
    await expect(page.getByRole('button', { name:'Start camera', exact:true })).toBeEnabled();
    expect(await photoInfo(page)).toBeNull();
  });
});

test('live tracking continues while a guided photo waits for durable storage',async({page})=>{
 test.setTimeout(60000);await injectAnalysis(page,false,true);await openCamera(page,true);
 await expect(page.getByText('1 of 9 angles saved',{exact:true})).toBeVisible({timeout:30000});
 await page.evaluate(()=>{
  const close=FileSystemWritableFileStream.prototype.close;let delay=true;
  FileSystemWritableFileStream.prototype.close=async function(){await close.call(this);if(delay){delay=false;await new Promise<void>(resolve=>{(window as any).releaseWrite=resolve;});}};
  (window as any).fixture.pose={yaw:-15,pitch:0,roll:0};
 });
 await expect.poll(()=>page.evaluate(()=>typeof(window as any).releaseWrite)).toBe('function');
 const before=await page.evaluate(()=>(window as any).liveMeasurements);
 await page.evaluate(()=>{(window as any).fixture.pose={yaw:-30,pitch:0,roll:0};});
 await expect.poll(()=>page.evaluate(()=>(window as any).liveMeasurements),{timeout:1500}).toBeGreaterThan(before+2);
 expect((await photoInfo(page))?.count).toBe(1);
 await page.evaluate(()=>{(window as any).fixture.pose={yaw:-45,pitch:0,roll:0};(window as any).releaseWrite();});
 await expect.poll(async()=>(await photoInfo(page))?.count,{timeout:15000}).toBeGreaterThanOrEqual(3);
});
test.describe('iOS stream capture', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/26.6.1 Mobile/15E148 Safari/604.1' });
  test('keeps the stream path even when a takePhoto API is exposed', async ({ page }) => {
    await injectAnalysis(page); await injectSensor(page, 'good'); await openCamera(page);
    await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout:30_000 });
    expect(await page.evaluate(() => (window as any).sensorCalls)).toBe(0);
    expect(await photoInfo(page)).toMatchObject({ method:'canvas', width:1280, height:1024, jpeg:true, hasExif:false });
  });
});

test('capture silently reuses duplicate coverage, replaces only when sharper and removes shared fulfillment on deletion', async ({ page, context }) => {
  test.setTimeout(120_000);
  const violations: string[] = []; context.on('request', request => { if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET','HEAD'].includes(request.method()) || request.postDataBuffer()) violations.push(request.url()); });
  await injectAnalysis(page); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const original = await photoInfo(page);
  // This identical frontal result cannot fulfill the current left-15 request.
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await expect(page.getByText('Choosing and saving photo…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible(); expect(await photoInfo(page)).toMatchObject({ id: original!.id, count: 1 });
  async function arrangeNeutral(sharpness: number) {
    await page.getByRole('button', { name: 'Finish for now', exact: true }).click(); await page.getByRole('button', { name: 'Back to sessions', exact: true }).click();
    // Seed the requested instruction, never a successful photo or measurement.
    await page.evaluate(async index => {
      const database = await new Promise<IDBDatabase>(resolve => { const open = indexedDB.open('akutoo'); open.onsuccess = () => resolve(open.result); });
      await new Promise<void>(resolve => { const tx = database.transaction('sessions', 'readwrite'), table = tx.objectStore('sessions'), get = table.getAll(); get.onsuccess = () => { const session = get.result[0]; table.put({ ...session, revision: (session.revision ?? 0)+1, progress: { ...session.progress, index, completed: session.progress.completed.filter((id: string) => id !== 'expression-neutral') } }); }; tx.oncomplete = () => resolve(); }); database.close();
    }, shots.findIndex(shot => shot.id === 'expression-neutral'));
    await page.reload(); await page.getByRole('button', { name: 'Continue session', exact: true }).click();
    await page.evaluate(sharpness => { (window as any).fixture.sharpness = sharpness; }, sharpness);
    await page.getByRole('button', { name: 'Start camera', exact: true }).click();
    await expect(page.getByText('2 of 28 shots saved')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
  }
  await arrangeNeutral(100); expect(await photoInfo(page)).toMatchObject({ id: original!.id, count: 1, sharpness: 100 });
  await arrangeNeutral(200); const replacement = await photoInfo(page); expect(replacement).toMatchObject({ count: 1, sharpness: 200 }); expect(replacement!.id).not.toBe(original!.id);
  const evidence = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const open = indexedDB.open('akutoo'); open.onsuccess = () => resolve(open.result); });
    const all = (table: string) => new Promise<any[]>(resolve => { const get = database.transaction(table).objectStore(table).getAll(); get.onsuccess = () => resolve(get.result); });
    const photos = await all('photos'), sessions = await all('sessions'); database.close();
    const paths: string[] = []; async function walk(dir: FileSystemDirectoryHandle, prefix='') { for await (const [name,item] of (dir as any).entries()) { if (item.kind === 'directory') await walk(item,prefix+name+'/'); else paths.push(prefix+name); } } await walk(await navigator.storage.getDirectory());
    return { photos, session: sessions[0], paths };
  });
  expect(evidence.photos[0].fulfilledShotIds).toEqual(expect.arrayContaining(['turn-0','expression-neutral']));
  expect(evidence.session.progress.attempts.prompts).toBe(0); expect(evidence.session.stats.failures).toBe(0);
  expect(evidence.paths.filter(path => path.endsWith('.jpg'))).toHaveLength(2); expect(evidence.paths.some(path => path.includes(original!.id))).toBe(false);
  await page.getByRole('button', { name: 'Finish for now', exact: true }).click(); await page.getByRole('button', { name: 'Photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'Delete this photo', exact: true }).click(); await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await page.getByRole('button', { name: 'Back to sessions', exact: true }).click(); await page.getByRole('button', { name: 'Continue session', exact: true }).click();
  await expect(page.getByText('0 of 28 shots saved')).toBeVisible(); expect(await photoInfo(page)).toBeNull(); expect(violations).toEqual([]);
});

test('legacy progress keeps its photo and target; an exhausted retry budget offers skip instead of another retry', async ({ page }) => {
  await injectAnalysis(page); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30_000 });
  const original = await photoInfo(page);
  await page.getByRole('button', { name: 'Finish for now', exact: true }).click();
  await page.getByRole('button', { name: 'Back to sessions', exact: true }).click();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('akutoo'); request.onsuccess = () => resolve(request.result); });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('sessions', 'readwrite'), table = tx.objectStore('sessions'), get = table.getAll();
      get.onsuccess = () => { const session = get.result[0]; delete session.progress.shotlistVersion; session.progress.index = 9; session.progress.attempts.prompts = 10; session.progress.attempts.relaxed = true; table.put(session); };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); database.close();
  });
  await page.reload(); await page.getByRole('button', { name: 'Continue session', exact: true }).click();
  await expect(page.locator('.pose-guide').getByText('Turn slowly to your left. Use the shutter when positioned.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  // No new calibration yet: this manual attempt must remain an explicit failure.
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check this photo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Discard and try again', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Let’s fix this once', exact: true })).toHaveCount(0);
  await page.screenshot({ path: '.impeccable/review/retry-budget-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.impeccable/review/retry-budget-mobile.png', fullPage: true });
  await expect(page.getByText('The retry limit is reached. Keep this photo only if useful, or skip this shot.', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: /^(Skip this shot|Next pose)$/, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check this photo', exact: true })).toHaveCount(0);
  expect(await photoInfo(page)).toMatchObject({ id: original!.id, count: 1 });
});

test('camera interruption cancels an unfinished burst and resumes the saved session after reload', async ({ page }) => {
  await injectAnalysis(page); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30_000 });
  const saved = await photoInfo(page);
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Take photo"]')!.click();
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
  });
  await expect(page.getByText('Camera was interrupted. Start the camera again to continue.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).captureTracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Start camera', exact: true })).toBeEnabled();
  expect(await photoInfo(page)).toMatchObject({ id: saved!.id, count: 1 });
  await page.screenshot({ path: '.impeccable/review/interrupted-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.impeccable/review/interrupted-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByText('1 photo saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue session', exact: true }).click();
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible();
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByText('Opening camera and local analysis…', { exact: true })).toHaveCount(0);
  expect(await photoInfo(page)).toMatchObject({ id: saved!.id, count: 1 });
});

test('calibrated auto-capture is saved locally; three matching failures show Session fix', async ({ page, context }) => {
  test.setTimeout(120000);
  const violations: string[] = [];
  context.on('request', request => { if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET','HEAD'].includes(request.method()) || request.postDataBuffer()) violations.push(request.url()); });
  await injectAnalysis(page); await page.setViewportSize({ width: 390, height: 844 }); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30000 });
  expect(await photoInfo(page)).toMatchObject({ count: 1, override: false, tier: 'C', jpeg: true, hasExif: false });
  await expect(page.locator('.scan-ring path')).toHaveCount(15);
  await expect(page.locator('.scan-ring path[data-pose-bin="yaw:0"]')).toHaveClass('complete');
  await expect(page.locator('.scan-ring path[data-pose-bin="yaw:-15"]')).not.toHaveClass('complete');
  await page.screenshot({ path: '.impeccable/review/capture-mobile.png', fullPage: true });
  expect((await page.getByRole('button', { name: 'Take photo', exact: true }).boundingBox())!.y + 76).toBeLessThan(844);
  await page.setViewportSize({ width: 390, height: 667 });
  await page.screenshot({ path: '.impeccable/review/capture-short.png', fullPage: true });
  expect((await page.getByRole('button', { name: 'Take photo', exact: true }).boundingBox())!.y + 76).toBeLessThan(667);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.impeccable/review/capture-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { (window as any).fixture.clipped = .3; });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole('button', { name: 'Take photo', exact: true }).click();
    if (attempt < 2) {
      await expect(page.getByRole('heading', { name: 'Check this photo' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Discard and try again' }).click();
    }
  }
  await expect(page.getByRole('heading', { name: 'Let’s fix this once' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/session-fix-mobile.png', fullPage: true });
  await page.getByRole('button', { name: /^(Skip this shot|Next pose)$/, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Let’s fix this once' })).toHaveCount(0);
  expect(await page.locator('video').evaluate(video => !!(video as HTMLVideoElement).srcObject)).toBe(true);
  await page.getByRole('button', { name: 'Finish for now' }).click();
  expect(await page.evaluate(() => (window as any).captureTracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  await page.reload(); await expect(page.getByText('1 photo saved')).toBeVisible();
  expect(await photoInfo(page)).toMatchObject({ count: 1, jpeg: true, hasExif: false });
  expect(violations).toEqual([]);
  await page.getByRole('button', { name: 'Continue session', exact: true }).click();
  await expect(page.locator('.scan-ring path[data-pose-bin="yaw:0"]')).toHaveClass('complete');
});

test('model failure preserves a usable manual capture path with explicit risky retention', async ({ page }) => {
  await injectAnalysis(page, true); await openCamera(page);
  await expect(page.getByText('Analysis is unavailable. Manual photos will need your review and stay out of Recommended export.')).toBeVisible();
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check this photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep this photo anyway', exact: true }).click();
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible();
  expect(await photoInfo(page)).toMatchObject({ override: true, tier: 'D', jpeg: true, hasExif: false });
  await expect(page.locator('.scan-ring path.complete')).toHaveCount(0);
});

test('all 28 guided shots can be completed with saved photos in under 15 minutes', async ({ page }) => {
  test.setTimeout(180000);
  const began = Date.now(); await injectAnalysis(page); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  for (let index = 1; index < shots.length; index++) {
    const shot = shots[index];
    const smile = ['closed-smile','toothy-smile','laugh','smirk'].includes(shot.expression) ? .8 : 0;
    const jaw = shot.expression === 'toothy-smile' ? .2 : ['laugh','surprise'].includes(shot.expression) ? .5 : 0;
    await page.evaluate(({ yaw, pitch, smile, jaw, expression, hash }) => {
      (window as any).fixture.pose = { yaw, pitch, roll: 0 };
      (window as any).fixture.hash = hash;
      (window as any).fixture.blendshapes = { mouthSmileLeft: smile, mouthSmileRight: expression === 'smirk' ? .1 : smile, jawOpen: jaw, browInnerUp: expression === 'surprise' ? .8 : 0 };
    // The full-scan fixture provides a distinct second neutral sample. The
    // dedicated duplicate test above keeps identical hashes to prove reuse.
    }, { yaw: shot.yaw, pitch: shot.pitch, smile, jaw, expression: shot.expression, hash: shot.id === 'expression-neutral' ? 'ffffffffffffffff' : '0000000000000000' });
    await page.getByRole('button', { name: 'Take photo', exact: true }).click();
    await expect(page.getByText(`${index + 1} of 28 shots saved`)).toBeVisible({ timeout: 15000 });
  }
  await expect(page.getByRole('heading', { name: 'Your scan is saved' })).toBeVisible();
  expect(await photoInfo(page)).toMatchObject({ count: 28, jpeg: true, hasExif: false });
  expect(Date.now() - began).toBeLessThan(15 * 60000);
  await page.getByRole('button', { name: 'Review photos', exact: true }).click();
  for (let index = 0; index < shots.length; index++) {
    await page.getByRole('button', { name: `Photo ${index + 1}`, exact: true }).click();
    await page.getByRole('button', { name: 'I checked: this is me and my face is clear', exact: true }).click();
    if (shots[index].context) await page.getByRole('button', { name: 'I checked: this matches the instruction', exact: true }).click();
    await page.getByRole('button', { name: 'Back to photos', exact: true }).click();
  }
  const readiness = page.getByRole('region', { name: 'Dataset readiness', exact: true });
  await expect(readiness.getByText('Ready', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await readiness.screenshot({ path: '.impeccable/review/readiness-panel-mobile.png' });
  await page.screenshot({ path: '.impeccable/review/readiness-ready-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await readiness.screenshot({ path: '.impeccable/review/readiness-panel-desktop.png' });
  await page.screenshot({ path: '.impeccable/review/readiness-ready-desktop.png', fullPage: true });
  // Inject a proportion outlier into fixture metadata, then require explicit review.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('akutoo'); request.onsuccess = () => resolve(request.result); });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('photos', 'readwrite'), table = tx.objectStore('photos'), get = table.getAll();
      get.onsuccess = () => { const target = get.result.find(photo => photo.shotId === 'expression-neutral'); table.put({ ...target, ratios: { eyeSpan: .7, faceWidth: .7 } }); };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); database.close();
  });
  await page.reload(); await page.getByRole('button', { name: 'Review photos', exact: true }).click();
  await page.getByRole('button', { name: 'Review flagged photo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check face proportions', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.impeccable/review/proportion-flag-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.impeccable/review/proportion-flag-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'I checked: this is the same person', exact: true }).click();
  await page.getByRole('button', { name: 'Back to photos', exact: true }).click();
  await expect(readiness.getByText('Ready', { exact: true })).toBeVisible();
});

test('review confirmation enables Recommended ZIP with a real JPEG and accurate metadata', async ({ page, context }) => {
  const violations: string[] = [];
  context.on('request', request => { if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET','HEAD'].includes(request.method()) || request.postDataBuffer()) violations.push(request.url()); });
  await injectAnalysis(page); await page.setViewportSize({ width: 390, height: 844 }); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Finish for now' }).click();
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
  await expect(page.getByText('1 of 15 pose bins measured', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create ZIP', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to sessions', exact: true }).click();
  // Photo review must keep its capture reference even if a later session loses calibration.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('akutoo'); request.onsuccess = () => resolve(request.result); });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('sessions', 'readwrite'), table = tx.objectStore('sessions'), get = table.getAll();
      get.onsuccess = () => { for (const session of get.result) { delete session.baseline; table.put(session); } };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); database.close();
  });
  await page.reload(); await page.getByRole('button', { name: 'Review photos', exact: true }).click();
  await page.getByRole('button', { name: 'Photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect full size', exact: true }).click();
  const inspection = page.getByRole('region', { name: 'Photo inspection area', exact: true });
  await expect.poll(() => inspection.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect(await inspection.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await inspection.focus(); const scrollBefore = await inspection.evaluate(element => element.scrollLeft);
  await inspection.press('ArrowRight');
  await expect.poll(() => inspection.evaluate(element => element.scrollLeft)).toBeGreaterThan(scrollBefore);
  await page.screenshot({ path: '.impeccable/review/photo-inspection-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.impeccable/review/photo-inspection-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fit photo to screen', exact: true }).click();
  expect((await inspection.locator('img').boundingBox())!.width).toBeLessThanOrEqual((await inspection.boundingBox())!.width);
  await page.getByRole('button', { name: 'I checked: this is me and my face is clear' }).click();
  await page.getByRole('button', { name: 'Back to photos' }).click();
  await page.screenshot({ path: '.impeccable/review/review-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.impeccable/review/review-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Create ZIP', exact: true }).click();
  const share = page.getByRole('button', { name: 'Share ZIP', exact: true });
  await expect(share).toBeVisible({ timeout: 30_000 });
  const contrast = await share.evaluate(element => {
    const parse = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = (rgb: number[]) => rgb.slice(0,3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126,.7152,.0722][index], 0);
    let parent: Element | null = element, bg = [0,0,0,0];
    while (parent && bg[3] === 0) { bg = parse(getComputedStyle(parent).backgroundColor); parent = parent.parentElement; }
    const a = luminance(parse(getComputedStyle(element).color)), b = luminance(bg);
    return (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({ path: '.impeccable/review/export-ready-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.impeccable/review/export-ready-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await share.click(); expect(await page.evaluate(() => (window as any).sharedNames.length)).toBe(1);
  const downloaded = page.waitForEvent('download'); await page.getByRole('link', { name: 'Save ZIP', exact: true }).click();
  const zip = unzipSync(await readFile((await (await downloaded).path())!));
  const metadata = JSON.parse(strFromU8(zip[Object.keys(zip).find(key => key.endsWith('/metadata.json'))!]));
  expect(metadata.images).toHaveLength(1);
  expect(metadata.poseCoverage.filled).toEqual(['yaw:0']);
  expect(metadata.poseCoverage.missing).toContain('yaw:90');
  expect(metadata.images[0]).toMatchObject({ identityConfirmed: true, override: false, pose: { yaw: 0 }, requestedPose: { yaw: 0 }, measurements: { occlusionVerified: true }, baseline: { sharpness: 100 } });
  const image = zip[Object.keys(zip).find(key => key.endsWith('.jpg'))!];
  expect(Array.from(image.slice(0,2))).toEqual([255,216]);
  await page.getByRole('combobox', { name: 'Photo format', exact: true }).selectOption('png');
  await expect(page.getByRole('link', { name: 'Save ZIP', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create ZIP', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Save ZIP', exact: true })).toBeVisible({ timeout: 30_000 });
  const pngDownload = page.waitForEvent('download'); await page.getByRole('link', { name: 'Save ZIP', exact: true }).click();
  const pngZip = unzipSync(await readFile((await (await pngDownload).path())!));
  const pngMetadata = JSON.parse(strFromU8(pngZip[Object.keys(pngZip).find(key => key.endsWith('/metadata.json'))!]));
  const pngImage = pngZip[Object.keys(pngZip).find(key => key.endsWith('.png'))!];
  expect(pngMetadata.format).toBe('png'); expect(pngMetadata.images[0].file).toMatch(/\.png$/);
  expect(Array.from(pngImage.slice(0,8))).toEqual([137,80,78,71,13,10,26,10]);
  const pngHeader = new DataView(pngImage.buffer, pngImage.byteOffset, pngImage.byteLength);
  expect(pngHeader.getUint32(16)).toBe(pngMetadata.images[0].width); expect(pngHeader.getUint32(20)).toBe(pngMetadata.images[0].height);
  expect(new TextDecoder().decode(pngImage).includes('eXIf')).toBe(false);
  await page.screenshot({ path: '.impeccable/review/png-ready-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.impeccable/review/png-ready-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'Delete this photo', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByText('No photos are saved in this session yet.')).toBeVisible();
  expect(await photoInfo(page)).toBeNull(); expect(violations).toEqual([]);
});

test('custom export presets persist and produce a fitted PNG without cropping', async ({ page, context }) => {
  test.setTimeout(90000); const violations: string[] = [];
  context.on('request', request => { if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET','HEAD'].includes(request.method()) || request.postDataBuffer()) violations.push(request.url()); });
  await injectAnalysis(page); await page.setViewportSize({ width: 390, height: 844 }); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Finish for now', exact: true }).click();
  await page.getByRole('button', { name: 'Photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'I checked: this is me and my face is clear', exact: true }).click();
  await page.getByRole('button', { name: 'Back to photos', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Dataset readiness', exact: true }).getByText('Some checks are not measured', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Photo format', exact: true }).selectOption('png');
  await page.getByText('Export settings and saved presets', { exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Photo limit (optional)', exact: true }).fill('1');
  await page.getByRole('combobox', { name: 'Maximum edge', exact: true }).selectOption('2048');
  await page.getByRole('combobox', { name: 'Fit to aspect ratio', exact: true }).selectOption('square');
  await page.getByRole('textbox', { name: 'File name prefix (optional)', exact: true }).fill('avatar');
  await page.getByRole('textbox', { name: 'Preset name or tool name', exact: true }).fill('My avatar tool');
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await expect(page.getByText('Preset saved on this device.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create ZIP', exact: true }).click();
  const ready = page.getByRole('link', { name: 'Save ZIP', exact: true }); await expect(ready).toBeVisible({ timeout: 30_000 });
  await page.locator('.export-panel').screenshot({ path: '.impeccable/review/preset-panel-mobile.png' });
  await page.screenshot({ path: '.impeccable/review/preset-ready-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('.export-panel').screenshot({ path: '.impeccable/review/preset-panel-desktop.png' });
  await page.screenshot({ path: '.impeccable/review/preset-ready-desktop.png', fullPage: true });
  const download = page.waitForEvent('download'); await ready.click();
  const archive = unzipSync(await readFile((await (await download).path())!));
  const metadata = JSON.parse(strFromU8(archive[Object.keys(archive).find(name => name.endsWith('/metadata.json'))!]));
  expect(metadata.exportSettings).toEqual({ maxPhotos: 1, maxEdge: 2048, aspect: 'square', prefix: 'avatar' });
  expect(metadata.images).toHaveLength(1); expect(metadata.images[0].file).toMatch(/^face\/avatar_.*\.png$/);
  expect(metadata.images[0].width).toBe(metadata.images[0].height);
  const png = archive[Object.keys(archive).find(name => name.endsWith('.png'))!];
  const pngHeader = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect(pngHeader.getUint32(16)).toBe(metadata.images[0].width); expect(pngHeader.getUint32(20)).toBe(metadata.images[0].height);
  const corner = await page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })), canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  }, Array.from(png));
  expect(corner).toEqual([20,16,31,255]);
  await page.reload(); await page.getByRole('button', { name: 'Review photos', exact: true }).click();
  await page.getByText('Export settings and saved presets', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Export setup', exact: true }).selectOption({ label: 'My avatar tool' });
  await expect(page.getByRole('combobox', { name: 'Photo format', exact: true })).toHaveValue('png');
  await expect(page.getByRole('textbox', { name: 'File name prefix (optional)', exact: true })).toHaveValue('avatar');
  await expect(page.getByRole('combobox', { name: 'Fit to aspect ratio', exact: true })).toHaveValue('square');
  expect(violations).toEqual([]);
});

test('retake preserves the earlier photo unless the new one passes and is sharper', async ({ page }) => {
  test.setTimeout(120000); await injectAnalysis(page); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30000 });
  const original = await photoInfo(page);
  await page.getByRole('button', { name: 'Finish for now' }).click();
  await page.getByRole('button', { name: 'Photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'Retake this photo' }).click();
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByText('Your earlier photo was kept because the retake was not sharper or did not pass the checks.')).toBeVisible({ timeout: 30000 });
  expect((await photoInfo(page))!.id).toBe(original!.id);
  await page.getByRole('button', { name: 'Review photos', exact: true }).click();
  await page.getByRole('button', { name: 'Photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'Retake this photo' }).click();
  await page.evaluate(() => { (window as any).fixture.sharpness = 200; });
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your scan is saved' })).toBeVisible({ timeout: 30000 });
  const replaced = await photoInfo(page);
  expect(replaced).toMatchObject({ count: 1, sharpness: 200 }); expect(replaced!.id).not.toBe(original!.id);
});

test('a capture write failure after closing its file leaves no partial files and preserves the earlier photo', async ({ page }) => {
  test.setTimeout(90_000); await injectAnalysis(page); await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout: 30_000 }); const original = await photoInfo(page);
  await page.getByRole('button', { name: 'Finish for now', exact: true }).click(); await page.getByRole('button', { name: 'Photo 1', exact: true }).click(); await page.getByRole('button', { name: 'Retake this photo', exact: true }).click();
  const paths = () => page.evaluate(async () => {
    const result: string[] = [];
    async function walk(directory: FileSystemDirectoryHandle, prefix = '') { for await (const [name, entry] of (directory as any).entries()) { if (entry.kind === 'directory') await walk(entry, `${prefix}${name}/`); else result.push(prefix + name); } }
    await walk(await navigator.storage.getDirectory()); return result.sort();
  });
  const before = await paths();
  await page.evaluate(() => {
    (window as any).fixture.sharpness = 200; (window as any).failCaptureWrite = true;
    const create = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function(options) {
      const writer = await create.call(this, options), close = writer.close.bind(writer);
      if (this.name.endsWith('.jpg')) Object.defineProperty(writer, 'close', { value: async () => { await close(); if ((window as any).failCaptureWrite) { (window as any).failCaptureWrite = false; throw new DOMException('Synthetic close failure', 'QuotaExceededError'); } } });
      return writer;
    };
  });
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Photo could not be saved. Your earlier photos are safe. Check free space, then try again.', { timeout: 30_000 });
  expect(await paths()).toEqual(before); expect(await photoInfo(page)).toMatchObject({ id: original!.id, count: 1 });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your scan is saved', exact: true })).toBeVisible({ timeout: 30_000 });
  const saved = await photoInfo(page); expect(saved!.id).not.toBe(original!.id); expect(saved).toMatchObject({ count: 1, sharpness: 200 });
});

test('green readiness follows the real auto trigger and saves without a shutter tap',async({page})=>{
 test.setTimeout(90000);await injectAnalysis(page);await openCamera(page);await page.evaluate(()=>{(window as any).fixture.delay=2000;});
 await expect(page.locator('.auto-status')).toHaveAttribute('data-ready','true',{timeout:30000});
 for(const [suffix,width,height]of [['mobile',390,844],['desktop',1280,900]]as const){await page.setViewportSize({width,height});await page.screenshot({path:`.impeccable/review/auto-ready-${suffix}.png`,fullPage:true});}
 await page.evaluate(()=>{(window as any).fixture.delay=5;});await expect.poll(async()=>(await photoInfo(page))?.count,{timeout:20000}).toBe(1);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('.auto-status')).toHaveAttribute('data-ready','false');await expect(page.getByText('Auto capture paused',{exact:true})).toBeVisible();
 for(const [suffix,width,height]of [['mobile',390,844],['desktop',1280,900]]as const){await page.setViewportSize({width,height});await page.screenshot({path:`.impeccable/review/auto-paused-${suffix}.png`,fullPage:true});}
});


test('live pose guidance corrects undershoot and overshoot before automatic capture', async ({ page }) => {
  await injectAnalysis(page);
  await page.addInitScript(()=>{ (window as any).spoken=[]; Object.defineProperty(speechSynthesis,'speak',{value:(utterance:SpeechSynthesisUtterance)=>(window as any).spoken.push(utterance.text)}); });
  await openCamera(page);
  await expect(page.getByText('1 of 28 shots saved')).toBeVisible({ timeout:30000 });
  await expect(page.getByText('Turn a little to your left.', {exact:true})).toBeVisible();
  await expect(page.getByRole('img', {name:'Target head direction: your left, 15 degrees'})).toBeVisible();
  await page.getByRole('button',{name:'Voice off',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).spoken.some((text:string)=>text.includes('Turn a little to your left.')))).toBe(true);
  for(const [name,width,height] of [['mobile',390,844],['desktop',1280,900]] as const) {
    await page.setViewportSize({width,height});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`.impeccable/review/pose-${name}.png`,fullPage:true});
  }
  await page.evaluate(() => { (window as any).fixture.pose={yaw:-30,pitch:0,roll:0}; });
  await expect(page.getByText('Turn a little to your right.', {exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).spoken.some((text:string)=>text.includes('Turn a little to your right.'))),{timeout:6000}).toBe(true);
  const spokenCount=await page.evaluate(()=>(window as any).spoken.length);
  await page.waitForTimeout(700);
  expect(await page.evaluate(()=>(window as any).spoken.length)).toBe(spokenCount);
  await page.evaluate(()=>{(window as any).fixture.faceRatio=.2;});
  await expect(page.getByText('Turn a little to your right.',{exact:true})).toBeVisible();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-ready','false');
  await page.evaluate(()=>{(window as any).fixture.faceRatio=.5;});
  await page.evaluate(() => { (window as any).fixture.pose={yaw:-15,pitch:0,roll:0}; });
  await expect(page.getByText('2 of 28 shots saved')).toBeVisible({timeout:15000});
  expect(await photoInfo(page)).toMatchObject({count:2,override:false});
});


test('a gentle head sweep collects automatic angles despite small pose jitter and imperfect soft targets',async({page})=>{
 test.setTimeout(120000);
 await injectAnalysis(page);await openCamera(page);
 await expect(page.getByText('1 of 28 shots saved')).toBeVisible({timeout:30000});
 await expect(page.locator('.camera-frame .pose-guide')).toBeVisible();
 await page.evaluate(()=>{const f=(window as any).fixture;f.faceRatio=.30;f.blendshapes={jawOpen:.3};let flip=false;(window as any).sweepTimer=setInterval(()=>{flip=!flip;f.pose={yaw:(f.target??-15)+(flip?1:-1),pitch:flip?1:-1,roll:0};},70);});
 for(const [index,yaw] of [-15,-30,-45,15,30,45].entries()) {
  await page.evaluate(yaw=>{(window as any).fixture.target=yaw;},yaw);
  await expect(page.getByText(`${index+2} of 28 shots saved`)).toBeVisible({timeout:15000});
 }
 await page.evaluate(()=>clearInterval((window as any).sweepTimer));
 expect(await photoInfo(page)).toMatchObject({count:7,override:false});
 await expect(page.getByRole('button',{name:'Left profile · hands-free',exact:true})).toBeVisible();
});


test('free movement collects out-of-order yaw and chin angles without skipping earlier gaps',async({page})=>{
 await injectAnalysis(page);await openCamera(page);
 await expect(page.getByText('1 of 28 shots saved')).toBeVisible({timeout:30000});
 for(const [index,pose] of [{yaw:45,pitch:0,roll:0},{yaw:0,pitch:15,roll:0},{yaw:-30,pitch:0,roll:0},{yaw:75,pitch:0,roll:0}].entries()){
  await page.evaluate(pose=>{(window as any).fixture.pose=pose;},pose);
  await expect(page.getByText(`${index+2} of 28 shots saved`)).toBeVisible({timeout:15000});
 }
 await expect(page.getByRole('heading',{name:'Free head scan'})).toBeVisible();
 expect(await photoInfo(page)).toMatchObject({count:5,override:false});
 await page.getByRole('button',{name:'Continue with collected angles',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Expressions',exact:true})).toBeVisible();
});

test('hands-free profile countdown can cancel, capture without a shutter, and retain unmeasured results only for explicit review',async({page})=>{
 test.setTimeout(120000);await injectAnalysis(page);
 await page.addInitScript(()=>{(window as any).spoken=[];Object.defineProperty(speechSynthesis,'speak',{value:(u:SpeechSynthesisUtterance)=>(window as any).spoken.push(u.text)});});
 await openCamera(page);await expect(page.getByText('1 of 28 shots saved')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Left profile · hands-free',exact:true}).click();
 await expect(page.locator('.handsfree-countdown')).toBeVisible();
 for(const [name,width,height] of [['mobile',390,844],['desktop',1280,900]] as const){await page.setViewportSize({width,height});await page.screenshot({path:`.impeccable/review/handsfree-${name}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await expect(page.locator('.handsfree-countdown')).toHaveCount(0);
 await page.waitForTimeout(8500);expect(await photoInfo(page)).toMatchObject({count:1});
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.getByRole('button',{name:'Left profile · hands-free',exact:true}).click();
 await page.evaluate(()=>{(window as any).fixture.pose={yaw:-90,pitch:0,roll:0};});
 await expect(page.getByText('2 of 28 shots saved')).toBeVisible({timeout:20000});
 await expect(page.getByText('Face the screen. Check the photo below, or resume the scan if it was saved.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).spoken.includes('Photo captured. Face the screen to check it.'))).toBe(true);
 await page.evaluate(()=>{(window as any).fixture.pose={yaw:0,pitch:0,roll:0};});
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.getByRole('button',{name:'Right profile · hands-free',exact:true}).click();
 await page.evaluate(()=>{(window as any).fixture.pose=null;(window as any).fixture.faceCount=0;});
 await expect(page.getByRole('heading',{name:'Check this photo',exact:true})).toBeVisible({timeout:20000});
 expect(await photoInfo(page)).toMatchObject({count:2});
 await expect(page.locator('.scan-ring path[data-pose-bin="yaw:90"]')).not.toHaveClass('complete');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.impeccable/review/handsfree-review-mobile.png',fullPage:true});
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'.impeccable/review/handsfree-review-desktop.png',fullPage:true});
});


test('leaving the page cancels a hands-free countdown without a late photo',async({page})=>{
 await injectAnalysis(page);await openCamera(page);
 await expect(page.getByText('1 of 28 shots saved')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Left profile · hands-free',exact:true}).click();
 await expect(page.locator('.handsfree-countdown')).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
 await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();
 await page.waitForTimeout(8500);
 expect(await photoInfo(page)).toMatchObject({count:1});
 await expect(page.getByRole('heading',{name:'Check this photo',exact:true})).toHaveCount(0);
});


test('the final timed shot still tells the solo user to face the screen after camera shutdown',async({page})=>{
 await injectAnalysis(page);
 await page.addInitScript(()=>{(window as any).spoken=[];Object.defineProperty(speechSynthesis,'speak',{value:(u:SpeechSynthesisUtterance)=>(window as any).spoken.push(u.text)});});
 await openCamera(page);await expect(page.getByText('1 of 28 shots saved')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Finish for now',exact:true}).click();
 await page.getByRole('button',{name:'Back to sessions',exact:true}).click();
 await page.evaluate(async()=>{
  const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('akutoo');r.onsuccess=()=>resolve(r.result);});
  await new Promise<void>((resolve,reject)=>{const tx=database.transaction('sessions','readwrite'),table=tx.objectStore('sessions'),r=table.getAll();r.onsuccess=()=>{const session=r.result[0];session.progress.index=27;table.put(session);};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});database.close();
 });
 await page.reload();await page.getByRole('button',{name:'Continue session',exact:true}).click();
 await page.getByRole('button',{name:'Start camera',exact:true}).click();
 await page.getByRole('button',{name:'Take after countdown',exact:true}).click({timeout:30000});
 await expect(page.getByRole('heading',{name:'Your scan is saved',exact:true})).toBeVisible({timeout:20000});
 await expect.poll(()=>page.evaluate(()=>(window as any).spoken.includes('Photo captured. Face the screen to check it.'))).toBe(true);
 expect(await photoInfo(page)).toMatchObject({count:2});
});


test('starting a countdown cannot inherit green readiness from the previous live pose',async({page})=>{
 await injectAnalysis(page);await openCamera(page);
 await page.evaluate(()=>{(window as any).fixture.delay=2000;});
 // Enter the timer in the same UI update as readiness, before the next analysis tick.
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
  const observer=new MutationObserver(check);
  const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Ready state not reached'));},30000);
  function check(){
   if(document.querySelector('.auto-status')?.getAttribute('data-ready')!=='true')return;
   const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Left profile'));
   if(!button||button.disabled)return;
   observer.disconnect();clearTimeout(timeout);button.click();resolve();
  }
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-ready']});check();
 }));
 await expect(page.locator('.handsfree-countdown')).toBeVisible();
 await expect(page.locator('.auto-status')).toHaveAttribute('data-ready','false');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
});


test('continuous movement collects primary and extra angles without per-angle holds',async({page})=>{
 test.setTimeout(90000);await injectAnalysis(page,false,true);await openCamera(page,true);
 await expect(page.getByText('1 of 9 angles saved',{exact:true})).toBeVisible({timeout:30000});
 // Each angle window is crossed in under 500 ms: no stop at an individual target.
 const sweep=async(points:{yaw:number;pitch:number}[])=>{
  await page.evaluate(async points=>{for(const pose of points){(window as any).fixture.pose={...pose,roll:0};await new Promise(r=>setTimeout(r,160));}},points);
 };
 const side=(sign:number,end:number)=>Array.from({length:end/5},(_,i)=>({yaw:sign*(i+1)*5,pitch:0}));
 await sweep([...side(-1,50),{yaw:0,pitch:0},...side(1,50),{yaw:0,pitch:0},...[ -5,-10,-15,-20,-25,0,5,10,15,20,25,0].map(pitch=>({yaw:0,pitch}))]);
 await expect(page.getByRole('heading',{name:'Main scan saved',exact:true})).toBeVisible({timeout:10000});
 expect((await photoInfo(page))?.count).toBe(9);
 await page.getByRole('button',{name:'Add extra angles',exact:true}).click();
 await sweep([...side(-1,90),{yaw:0,pitch:0},...side(1,90),{yaw:0,pitch:0}]);
 await expect.poll(async()=>(await photoInfo(page))?.count,{timeout:10000}).toBe(15);
});

test('guided main scan collects nine angles hands-free with stable cues and a separate extras summary',async({page,context})=>{
 test.setTimeout(120000);const violations:string[]=[];
 context.on('request',r=>{if(!['GET','HEAD'].includes(r.method())||r.postDataBuffer()||new URL(r.url()).origin!=='http://localhost:5174')violations.push(r.url());});
 await injectAnalysis(page);await page.setViewportSize({width:390,height:844});await openCamera(page,true);
 await expect(page.getByText('1 of 9 angles saved',{exact:true})).toBeVisible({timeout:30000});
 await expect(page.locator('.instruction')).toHaveText('Slowly sweep to your left.');
 for(const [name,width,height]of [['mobile',390,844],['short',375,667],['desktop',1280,900]]as const){
  await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const pause=await page.getByRole('button',{name:'Pause',exact:true}).boundingBox();expect(pause!.y+pause!.height).toBeLessThan(height);
  await page.screenshot({path:`.impeccable/review/guided-${name}.png`,fullPage:true});
 }
 // Off-axis primary capture must not move the leftward suggestion to the right.
 await page.evaluate(()=>{(window as any).fixture.pose={yaw:30,pitch:0,roll:0};});
 await expect(page.getByText('2 of 9 angles saved',{exact:true})).toBeVisible({timeout:15000});
 await expect(page.locator('.instruction')).toHaveText('Slowly sweep to your left.');
 await page.evaluate(()=>{(window as any).fixture.pose=null;});
 await expect(page.locator('.scan-example')).toHaveAttribute('data-state','recovering');
 await expect(page.locator('.auto-status')).toHaveAttribute('data-ready','false');
 for(const [index,pose]of [{yaw:-15,pitch:0},{yaw:-30,pitch:0},{yaw:-45,pitch:0},{yaw:15,pitch:0},{yaw:45,pitch:0},{yaw:0,pitch:-15},{yaw:0,pitch:15}].entries()){
  await page.evaluate(pose=>{(window as any).fixture.pose={...pose,roll:0};},pose);
  await expect.poll(async()=>(await photoInfo(page))?.count,{timeout:15000}).toBe(index+3);
 }
 await expect(page.getByRole('heading',{name:'Main scan saved',exact:true})).toBeVisible();
 expect(await photoInfo(page)).toMatchObject({count:9,override:false});
 for(const [name,width,height]of [['mobile',390,844],['desktop',1280,900]]as const){await page.setViewportSize({width,height});await expect(page.locator('.scan-visual')).toBeHidden();await page.screenshot({path:`.impeccable/review/guided-summary-${name}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Add extra angles',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Extra angles',exact:true})).toBeVisible();
 await expect(page.getByText('0 of 6 angles saved',{exact:true})).toBeVisible();
 await page.getByText('More capture options',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Take after countdown',exact:true})).toBeVisible();
 expect(violations).toEqual([]);
});

test('guided scan recovery, pause and stalled help preserve saved evidence',async({page})=>{
 test.setTimeout(90000);await injectAnalysis(page);await openCamera(page,true);
 await expect(page.getByText('1 of 9 angles saved',{exact:true})).toBeVisible({timeout:30000});
 const original=await photoInfo(page);
 await page.evaluate(()=>{(window as any).fixture.pose={yaw:-70,pitch:0,roll:0};});
 await expect(page.locator('.instruction')).toHaveText('Slowly sweep back toward the camera.');
 await expect(page.locator('.scan-stall')).toBeVisible({timeout:22000});
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('.scan-stall')).toHaveCount(0);
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await expect(page.getByText('Take a break or continue with the photos you have. You can revisit missing angles later.',{exact:true})).toBeVisible({timeout:40000});
 expect(await photoInfo(page)).toMatchObject({id:original!.id,count:1});
 await page.getByRole('button',{name:'Continue with these photos',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Main scan saved',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Continue to expressions',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Expressions',exact:true})).toBeVisible();
});

test('extra sweep recovers from untrackable profiles and finishes with honest partial coverage',async({page})=>{
 await page.addInitScript(()=>{(window as any).vibrations=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:(pattern:any)=>{(window as any).vibrations.push(pattern);return true;}});});
 test.setTimeout(90000);await injectAnalysis(page);await page.setViewportSize({width:390,height:844});await openCamera(page,true);
 await expect(page.getByText('1 of 9 angles saved',{exact:true})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Continue with these photos',exact:true}).click();
 await page.getByRole('button',{name:'Add extra angles',exact:true}).click();
 for(const [yaw,count]of [[-60,1],[60,2]]){
  await page.evaluate(yaw=>{(window as any).fixture.pose={yaw,pitch:0,roll:0};},yaw);
  await expect(page.getByText(`${count} of 6 angles saved`,{exact:true})).toBeVisible({timeout:15000});
  await page.evaluate(()=>{(window as any).fixture.pose=null;(window as any).fixture.faceCount=0;});
  if(yaw<0){
   await expect(page.locator('.instruction')).toHaveText('Slowly face the camera so I can find you.');
   await expect(page.locator('.scan-example')).toHaveAttribute('data-motion','still');
   await expect(page.locator('.auto-status')).toHaveAttribute('data-ready','false');
   await expect.poll(()=>page.evaluate(()=>(window as any).vibrations.filter((p:any)=>Array.isArray(p)).length)).toBe(1);
   await page.waitForTimeout(1300);
   await page.screenshot({path:'.impeccable/review/continuous-extra-recovery-mobile.png',fullPage:true});
   await page.evaluate(()=>{(window as any).fixture.pose={yaw:0,pitch:0,roll:0};(window as any).fixture.faceCount=1;});
   await expect(page.locator('.instruction')).toHaveText('Slowly sweep to your right.');
  }
 }
 await expect(page.getByRole('heading',{name:'Extra scan saved',exact:true})).toBeVisible({timeout:15000});
 await expect(page.getByText('2 of 6 angles saved',{exact:true})).toHaveCount(2);
 expect((await photoInfo(page))?.count).toBe(3);
 await page.screenshot({path:'.impeccable/review/continuous-extra-summary-mobile.png',fullPage:true});
});


test('guided saving never awards progress before durable storage and resumes after a write error',async({page})=>{
 test.setTimeout(90000);await injectAnalysis(page);await openCamera(page,true);
 await expect(page.getByText('1 of 9 angles saved',{exact:true})).toBeVisible({timeout:30000});
 await page.evaluate(()=>{
  const close=FileSystemWritableFileStream.prototype.close;
  (window as any).delayWrite=true;
  FileSystemWritableFileStream.prototype.close=async function(){
   await close.call(this);
   if((window as any).delayWrite){(window as any).delayWrite=false;await new Promise<void>((_,reject)=>{(window as any).rejectWrite=()=>reject(new DOMException('Synthetic write error','QuotaExceededError'));});}
  };
  (window as any).fixture.pose={yaw:-15,pitch:0,roll:0};
 });
 await expect.poll(()=>page.evaluate(()=>typeof(window as any).rejectWrite)).toBe('function');
 await expect(page.locator('.instruction')).toHaveText('Slowly sweep to your left.');
 await expect(page.getByText('1 of 9 angles saved',{exact:true})).toBeVisible();
 expect(await photoInfo(page)).toMatchObject({count:1});
 await page.evaluate(()=>(window as any).rejectWrite());
 await expect(page.getByRole('alert')).toHaveText('Photo could not be saved. Your earlier photos are safe. Check free space, then try again.');
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await expect(page.getByText('2 of 9 angles saved',{exact:true})).toBeVisible({timeout:15000});
 await page.getByRole('button',{name:'Finish for now',exact:true}).click();await page.getByRole('button',{name:'Back to sessions',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Continue session',exact:true}).click();
 await expect(page.getByRole('button',{name:'Start scan',exact:true})).toBeVisible();
 await expect(page.getByText('2 of 9 angles saved',{exact:true})).toBeVisible({timeout:15000});
});

test.describe('Android automatic gaze',()=>{
test.use({userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/155.0.0.0 Mobile Safari/537.36'});
test('all four eye directions capture automatically and reject an unmeasured final gaze',async({page})=>{
 test.setTimeout(90000);await injectAnalysis(page);await injectSensor(page,'good');
 await page.addInitScript(()=>{(window as any).vibrations=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:(pattern:any)=>{(window as any).vibrations.push(pattern);return true;}});});
 await openCamera(page);await expect(page.getByText('1 of 28 shots saved')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByRole('button',{name:'Finish for now',exact:true}).click();await page.getByRole('button',{name:'Back to sessions',exact:true}).click();
 await page.evaluate(async()=>{
  const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('akutoo');r.onsuccess=()=>resolve(r.result);});
  await new Promise<void>(resolve=>{const tx=database.transaction('sessions','readwrite'),table=tx.objectStore('sessions'),r=table.getAll();r.onsuccess=()=>{const session=r.result[0];session.progress.index=21;table.put(session);};tx.oncomplete=()=>resolve();});database.close();
 });
 await page.reload();await page.getByRole('button',{name:'Continue session',exact:true}).click();await page.getByRole('button',{name:'Start camera',exact:true}).click();
 const neutral={eyeLookOutLeft:0,eyeLookInRight:0,eyeLookInLeft:0,eyeLookOutRight:0,eyeLookUpLeft:0,eyeLookUpRight:0,eyeLookDownLeft:0,eyeLookDownRight:0,eyeBlinkLeft:0,eyeBlinkRight:0};
 await page.evaluate(neutral=>{(window as any).fixture.blendshapes={...neutral,eyeLookOutLeft:.8,eyeLookInRight:.8};(window as any).fixture.stillBlendshapes=neutral;},neutral);
 await expect.poll(()=>page.evaluate(()=>(window as any).stillMeasurements??0),{timeout:20000}).toBeGreaterThanOrEqual(6);
 expect((await photoInfo(page))?.count).toBe(1);
 await page.evaluate(()=>{delete(window as any).fixture.stillBlendshapes;});
 for(const [index,keys]of [['eyeLookOutLeft','eyeLookInRight'],['eyeLookInLeft','eyeLookOutRight'],['eyeLookUpLeft','eyeLookUpRight'],['eyeLookDownLeft','eyeLookDownRight']].entries()){
  await page.evaluate(({neutral,keys})=>{(window as any).fixture.blendshapes={...neutral,[keys[0]]:.8,[keys[1]]:.8};},{neutral,keys});
  await expect.poll(async()=>(await photoInfo(page))?.count,{timeout:15000}).toBe(index+2);
 }
 const evidence=await page.evaluate(async()=>{const d=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('akutoo');r.onsuccess=()=>resolve(r.result);});const photos=await new Promise<any[]>(resolve=>{const r=d.transaction('photos').objectStore('photos').getAll();r.onsuccess=()=>resolve(r.result);});d.close();return photos.filter(p=>p.shotId.startsWith('gaze-')).map(p=>({trigger:p.captureTrigger,requested:p.direction,measured:p.gaze.direction}));});
 expect(evidence).toHaveLength(4);for(const item of evidence){expect(item.trigger).toBe('automatic');expect(item.measured).toBe(item.requested);}
 expect((await page.evaluate(()=>(window as any).vibrations)).filter((p:any)=>p===25).length).toBe(4);
});
});

test('pausing a background save clears waiting frames without inventing progress',async({page})=>{
 test.setTimeout(60000);await injectAnalysis(page,false,true);await openCamera(page,true);
 await expect(page.getByText('1 of 9 angles saved',{exact:true})).toBeVisible({timeout:30000});
 await page.evaluate(()=>{const close=FileSystemWritableFileStream.prototype.close;let delay=true;FileSystemWritableFileStream.prototype.close=async function(){await close.call(this);if(delay){delay=false;await new Promise<void>(resolve=>{(window as any).releaseWrite=resolve;});}};(window as any).fixture.pose={yaw:-15,pitch:0,roll:0};});
 await expect.poll(()=>page.evaluate(()=>typeof(window as any).releaseWrite)).toBe('function');
 await page.evaluate(()=>{(window as any).fixture.pose={yaw:-30,pitch:0,roll:0};});
 const before=await page.evaluate(()=>(window as any).liveMeasurements);
 await expect.poll(()=>page.evaluate(()=>(window as any).liveMeasurements)).toBeGreaterThan(before+6);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.evaluate(()=>(window as any).releaseWrite());
 await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeEnabled();
 await expect.poll(async()=>(await photoInfo(page))?.count).toBe(2);
 const paused=await page.evaluate(()=>(window as any).liveMeasurements);await page.waitForTimeout(400);
 expect((await photoInfo(page))?.count).toBe(2);expect(await page.evaluate(()=>(window as any).liveMeasurements)).toBeLessThanOrEqual(paused+1);
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await expect.poll(async()=>(await photoInfo(page))?.count,{timeout:15000}).toBe(3);
});
