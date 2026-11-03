import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';
test('real bundled body worker keeps absent poses unmeasured online and offline',async({page,context})=>{
  const file=(await readdir('dist/assets')).find(name=>/^pose-worker-.*\.js$/.test(name));expect(file).toBeTruthy();
  const violations:string[]=[];context.on('request',request=>{if(new URL(request.url()).origin!=='http://localhost:5174'||!['GET','HEAD'].includes(request.method())||request.postDataBuffer())violations.push(request.url());});
  await page.goto('/');await expect(page.getByText('Ready offline',{exact:true})).toBeVisible({timeout:30000});
  const run=()=>page.evaluate(async file=>{
    const worker=new Worker(`/assets/${file}`);let id=0;
    const send=(message:object,transfer:Transferable[]=[])=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Body worker timeout')),30000);worker.onmessage=event=>{clearTimeout(timer);event.data.type==='error'?reject(new Error(event.data.error)):resolve(event.data);};worker.onerror=event=>{clearTimeout(timer);reject(new Error(event.message));};worker.postMessage({...message,id:++id},transfer);});
    try{await send({type:'load',base:location.origin+'/'});const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#888';ctx.fillRect(0,0,1024,768);const bitmap=await createImageBitmap(canvas);return (await send({type:'frame',bitmap},[bitmap])).result;}finally{worker.terminate();}
  },file!);
  for(let attempt=0;attempt<2;attempt++){
    if(attempt){await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);await context.setOffline(true);await page.reload();}
    const result=await run();expect(result.detectedPoses).toBe(0);expect(result.bounds).toBeNull();expect(result.metrics).toBeNull();expect(result.landmarks).toEqual([]);expect(result.model).toBe('pose-landmarker-lite-v1');expect(result.sourceDimensions).toEqual({width:1024,height:768});
  }expect(violations).toEqual([]);
});

test('real local multiclass hair model returns bounded measurements online and offline without inventing a person count', async ({ page, context }) => {
  const workerFile=(await readdir('dist/assets')).find(file=>/^hair-worker-.*\.js$/.test(file));expect(workerFile).toBeTruthy();
  const violations:string[]=[];context.on('request',request=>{if(new URL(request.url()).origin!=='http://localhost:5174'||!['GET','HEAD'].includes(request.method())||request.postDataBuffer())violations.push(request.url());});
  await page.goto('/');await expect(page.getByText('Ready offline',{exact:true})).toBeVisible({timeout:30000});
  const run=()=>page.evaluate(async file=>{
    const worker=new Worker(`/assets/${file}`);let sequence=0;
    const send=(message:object,transfer:Transferable[]=[])=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Segmentation timeout')),30000);worker.onmessage=event=>{clearTimeout(timer);event.data.type==='error'?reject(new Error(event.data.error)):resolve(event.data);};worker.onerror=event=>{clearTimeout(timer);reject(new Error(event.message));};worker.postMessage({...message,id:++sequence},transfer);});
    try {const ready=await send({type:'load',base:location.origin+'/'});const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#888';ctx.fillRect(0,0,1024,768);const bitmap=await createImageBitmap(canvas);return {labels:ready.labels,result:(await send({type:'frame',bitmap},[bitmap])).result};}finally{worker.terminate();}
  },workerFile!);
  for(let attempt=0;attempt<2;attempt++) {
    if(attempt){await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);await context.setOffline(true);await page.reload();}
    const {labels,result}=await run();expect(labels[1].toLowerCase()).toBe('hair');expect(result.targetArea).toBeGreaterThanOrEqual(0);expect(result.targetArea).toBeLessThanOrEqual(1);expect(result.personCount).toBeNull();expect(result.occlusionVerified).toBe(false);expect(result.sourceDimensions).toEqual({width:1024,height:768});if(result.targetArea===0){expect(result.sharpness).toBeNull();expect(result.swatch).toBeNull();}
    expect(result.colorClusters.length).toBeLessThanOrEqual(3);expect(result.colorCast.method).toBe('background-gray-world');expect(['unmeasured','no-cast-indicated','possible-cast']).toContain(result.colorCast.status);expect(result.colorCast.samples).toBeGreaterThanOrEqual(0);
  }
  expect(violations).toEqual([]);
});

test('real local face model executes in a worker and reloads offline', async ({ page, context }) => {
  const files = await readdir('dist/assets');
  const worker = files.find(file => /^worker-.*\.js$/.test(file));
  expect(worker).toBeTruthy();
  const violations: string[] = [];
  context.on('request', request => {
    if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET', 'HEAD'].includes(request.method()) || request.postDataBuffer()) violations.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible({ timeout: 30000 });
  const run = () => page.evaluate(async workerFile => {
    const worker = new Worker(`/assets/${workerFile}`);
    try {
      const request = (message: object, transfer: Transferable[] = []) => new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Worker timeout')), 25000);
        worker.onmessage = event => { clearTimeout(timer); event.data.type === 'error' ? reject(new Error(event.data.error)) : resolve(event.data); };
        worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
        worker.postMessage(message, transfer);
      });
      await request({ type: 'load', id: 1, base: location.origin + '/' });
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 1024, 1024);
      const bitmap = await createImageBitmap(canvas);
      const blank = (await request({ type: 'frame', id: 2, bitmap, time: performance.now(), still: false }, [bitmap])).result;
      ctx.fillStyle = '#646464'; ctx.fillRect(0, 0, 1024, 1024);
      for (let x = 512; x < 1024; x += 8) { ctx.fillStyle = x % 16 ? '#fff' : '#000'; ctx.fillRect(x, 0, 8, 1024); }
      const probes = [];
      for (const [index, target] of [
        { x: 0, y: 0, width: .5, height: 1 },
        { x: .5, y: 0, width: .5, height: 1 },
        { x: .9, y: 0, width: .5, height: 1 },
      ].entries()) {
        const pixels = await createImageBitmap(canvas);
        probes.push((await request({ type: 'frame', id: 3 + index, bitmap: pixels, time: performance.now(), still: true, target }, [pixels])).result.target);
      }
      return { ...blank, probes };
    } finally { worker.terminate(); }
  }, worker!);
  const verify = (result: any) => {
    expect(result.measurements.faceCount).toBe(0);
    expect(result.measurements.sharpness).toBe(0);
    expect(result.probes[0]).toMatchObject({ source: 'guide', visibilityVerified: false, bounds: { x: 0, y: 0, width: 512, height: 1024 }, metrics: { sharpness: 0, exposure: 100, clipped: 0 }, sourceDimensions: { width: 1024, height: 1024 } });
    expect(result.probes[1].metrics.sharpness).toBeGreaterThan(0);
    expect(result.probes[2].bounds).toBeNull(); expect(result.probes[2].metrics).toBeNull();
  };
  verify(await run());
  // Prompt-mode service workers control a first installation after navigation.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true); await page.reload();
  verify(await run());
  // Exercise the gallery path with the real IMAGE model while fully offline.
  await page.getByRole('button', { name: 'Import photos', exact: true }).click();
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const context = canvas.getContext('2d')!; context.fillStyle = '#888'; context.fillRect(0, 0, 1024, 1024);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/jpeg'));
    const files = new DataTransfer(); files.items.add(new File([blob], 'synthetic-blank.jpg', { type: 'image/jpeg' }));
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!; input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('checkbox', { name: 'I confirm that every selected photo is of me and I have the right to use it.', exact: true }).check();
  await page.getByRole('button', { name: 'Analyze photos', exact: true }).click();
  await expect(page.getByText('Keep a photo with exactly one face. Multiple-face photos are not cropped automatically.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Add 0 photos to session', exact: true })).toBeDisabled();
  expect(violations).toEqual([]);
});
