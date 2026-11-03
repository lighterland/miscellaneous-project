import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
async function fixture(page: Page, unavailable = false) {
    await page.addInitScript(unavailable => {
        const Original = window.Worker;
        (window as any).hairFixture = { sharpness: 100 };
        window.Worker = class {
            onmessage: any = null;
            onerror: any = null;
            hair: boolean;
            constructor(url: string | URL, options?: WorkerOptions) { const path = String(url); this.hair = path.includes('hair-worker-'); if (!this.hair && !path.includes('/worker-'))
                return new Original(url, options) as any; }
            postMessage(message: any) { if (message.type === 'load') {
                setTimeout(() => this.onmessage?.({ data: this.hair && unavailable ? { id: message.id, type: 'error', error: 'Synthetic unavailable model' } : { id: message.id, type: 'ready', labels: ['background', 'hair'] } }), 5);
                return;
            } const { width, height } = message.bitmap; message.bitmap.close(); const result = this.hair ? { targetArea: .5, bounds: { x: .1, y: .1, width: .8, height: .8 }, sharpness: (window as any).hairFixture.sharpness, exposure: 100, brightClipped: .01, clipped: .01, swatch: '#443322', personCount: null, occlusionVerified: false, sourceDimensions: { width, height }, durationMs: 5 } : { measurements: { faceCount: 0 }, pose: null, blendshapes: {}, hash: null, durationMs: 5, occlusionVerified: false };
            if (this.hair && (window as any).hairFixture.colors) Object.assign(result,{colorClusters:[{hex:'#443322',fraction:.7},{hex:'#d0d0d0',fraction:.3}],colorCast:{status:'possible-cast',method:'background-gray-world',samples:500,channelMeans:[80,100,180]}});
            setTimeout(() => this.onmessage?.({ data: { id: message.id, type: 'result', result } }), 5); }
            terminate() { }
        } as any;
        const media = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = () => media({ video: { width: { ideal: 1280 }, height: { ideal: 1024 } } });
        speechSynthesis.speak = () => undefined;
        speechSynthesis.cancel = () => undefined;
    }, unavailable);
}
async function data(page: Page) { return page.evaluate(async () => { const database = await new Promise<IDBDatabase>(resolve => { const open = indexedDB.open('akutoo'); open.onsuccess = () => resolve(open.result); }); const all = (table: string) => new Promise<any[]>(resolve => { const get = database.transaction(table).objectStore(table).getAll(); get.onsuccess = () => resolve(get.result); }); const photos = await all('photos'), sessions = await all('sessions'); database.close(); return { photos, session: sessions[0] }; }); }
async function captures(page: Page, name: string) { for (const [suffix, width, height] of [['mobile', 390, 844], ['desktop', 1280, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async () => { scrollTo(0, 0); await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
    await page.screenshot({ path: `.impeccable/review/${name}-${suffix}.png`, fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
} }
async function start(page: Page) { await page.goto('/'); await expect(page.getByText('Ready offline', { exact: true })).toBeVisible({ timeout: 30000 }); await page.getByRole('button', { name: 'Start hair session', exact: true }).click(); }
test('separate color suggestions keep manual gray labels and possible cast evidence in local export',async({page,context})=>{
    test.setTimeout(90000);const violations:string[]=[];context.on('request',request=>{if(new URL(request.url()).origin!=='http://localhost:5174'||!['GET','HEAD'].includes(request.method())||request.postDataBuffer())violations.push(request.url());});
    await fixture(page);await start(page);await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('button',{name:'Start camera',exact:true}).click();await expect(page.getByText('Hair reference is ready. Check framing before starting.',{exact:true})).toBeVisible({timeout:30000});
    await page.evaluate(()=>{(window as any).hairFixture.colors=true;});
    await page.getByRole('button',{name:'Take photo',exact:true}).click();await expect.poll(async()=>(await data(page)).photos.length,{timeout:15000}).toBe(1);
    await expect(page.getByText(/Possible color cast/)).toBeVisible();
    const candidates=page.locator('.hair-colors > div');await expect(candidates).toHaveCount(2);
    await candidates.nth(1).getByRole('combobox').selectOption('gray');await candidates.nth(1).getByRole('textbox',{name:'Color name for head sample 2',exact:true}).fill('Silver gray');
    await candidates.nth(1).getByRole('button',{name:'Confirm color',exact:true}).click();await expect(candidates.nth(1).getByRole('button',{name:'Color confirmed',exact:true})).toBeDisabled();
    await candidates.nth(1).getByRole('combobox').selectOption('highlight');await expect(candidates.nth(1).getByRole('button',{name:'Confirm color',exact:true})).toBeEnabled();
    await candidates.nth(1).getByRole('combobox').selectOption('gray');await candidates.nth(1).getByRole('button',{name:'Confirm color',exact:true}).click();
    await captures(page,'hair-color-groups');
    const stored=await data(page);expect(stored.session.hair.sets.down.colors['head-candidate-2']).toMatchObject({role:'gray',name:'Silver gray',nameSource:'user',confirmed:true,fraction:.3});expect(stored.photos[0].hair.analysis.colorCast.status).toBe('possible-cast');
    await page.getByRole('button',{name:'Finish for now',exact:true}).click();await page.getByRole('combobox',{name:'Photos to include',exact:true}).selectOption('all');await page.getByRole('button',{name:'Create ZIP',exact:true}).click();await expect(page.getByRole('link',{name:'Save ZIP',exact:true})).toBeVisible({timeout:30000});
    const download=page.waitForEvent('download');await page.getByRole('link',{name:'Save ZIP',exact:true}).click();const zip=unzipSync(await readFile((await(await download).path())!));const metadata=JSON.parse(strFromU8(zip[Object.keys(zip).find(path=>path.endsWith('/metadata.json'))!]));
    expect(metadata.hair.sets.down.colors['head-candidate-2'].role).toBe('gray');expect(metadata.hair.sets.down.colors['head-candidate-2'].roleSource).toBe('user');expect(metadata.images[0].hair.analysis.colorCast.method).toBe('background-gray-world');expect(violations).toEqual([]);
});
test('manual hair failures stop after three and permit only one explicit revisit', async ({page}) => {
    test.setTimeout(120000);
    await fixture(page,true); await start(page);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('button',{name:'Start camera',exact:true}).click();
    await expect(page.getByText('Hair analysis is unavailable. Manual photos require explicit risky retention.',{exact:true})).toBeVisible({timeout:30000});
    const shutter=page.getByRole('button',{name:'Take photo',exact:true});
    for (let round=0;round<2;round++) {
        for (let index=0;index<3;index++) {
            await shutter.click();
            await expect(page.getByRole('button',{name:'Keep this photo anyway',exact:true})).toBeVisible({timeout:15000});
            await page.getByRole('button',{name:'Discard and try again',exact:true}).click();
        }
        await expect(shutter).toBeDisabled();
        await captures(page,round?'hair-limit-final':'hair-limit');
        if (!round) await page.getByRole('button',{name:'Revisit this shot once',exact:true}).click();
    }
    await expect(page.getByRole('button',{name:'Revisit this shot once',exact:true})).toHaveCount(0);
    const stored=await data(page);expect(stored.photos).toHaveLength(0);
    expect(stored.session.hair.sets.down.attempts['angle-front']).toBe(3);
    expect(stored.session.hair.sets.down.revisited['angle-front']).toBe(true);
    expect(stored.session.progress.attempts.prompts).toBe(6);
    await page.getByRole('combobox',{name:'Choose a hair shot',exact:true}).selectOption('crown');
    await expect(shutter).toBeEnabled();
});
test('manual patterns stay per style and optional length evidence survives disabling, reload and local export',async({page,context})=>{
    test.setTimeout(120000);const violations:string[]=[];context.on('request',request=>{if(new URL(request.url()).origin!=='http://localhost:5174'||!['GET','HEAD'].includes(request.method())||request.postDataBuffer())violations.push(request.url());});
    await fixture(page);await start(page);await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByText('Pattern and optional length',{exact:true}).click();
    await page.getByRole('radio',{name:/Wavy/}).check();await page.getByRole('combobox',{name:'Subtype (optional)',exact:true}).selectOption('2B');
    await page.getByRole('checkbox',{name:'Include an optional length photo',exact:true}).check();
    expect(await page.getByRole('combobox',{name:'Choose a hair shot',exact:true}).locator('option').count()).toBe(15);
    await page.getByRole('button',{name:'Bun',exact:true}).click();await expect(page.getByRole('radio',{name:'Not specified',exact:true})).toBeChecked();
    await page.getByRole('radio',{name:/Curly/}).check();await page.getByRole('combobox',{name:'Subtype (optional)',exact:true}).selectOption('3C');
    await page.getByRole('button',{name:'Down, natural',exact:true}).click();await expect(page.getByRole('radio',{name:/Wavy/})).toBeChecked();await expect(page.getByRole('combobox',{name:'Subtype (optional)',exact:true})).toHaveValue('2B');
    await captures(page,'hair-profile');
    await page.getByRole('button',{name:'Start camera',exact:true}).click();await expect(page.getByText('Hair reference is ready. Check framing before starting.',{exact:true})).toBeVisible({timeout:30000});
    await page.getByRole('checkbox',{name:'I checked the phone is secure, the requested hair is visible and only I am in frame.',exact:true}).check();await page.getByRole('checkbox',{name:'I can hear the voice and tones from my mark.',exact:true}).check();
    await page.evaluate(()=>dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:75,gamma:0})));await expect(page.getByRole('button',{name:'Start eight-angle turn',exact:true})).toBeDisabled();
    await page.evaluate(()=>dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:90,gamma:0})));await page.waitForTimeout(2100);await page.evaluate(()=>dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:90,gamma:0})));await expect(page.getByRole('button',{name:'Start eight-angle turn',exact:true})).toBeEnabled();
    await page.getByRole('combobox',{name:'Choose a hair shot',exact:true}).selectOption('length');await page.getByRole('button',{name:'Take photo',exact:true}).click();await expect.poll(async()=>(await data(page)).photos.length,{timeout:15000}).toBe(1);
    await page.getByRole('textbox',{name:'Color name for length',exact:true}).fill('Dark brown');await page.getByRole('button',{name:'Confirm color',exact:true}).click();
    await page.getByRole('checkbox',{name:'Include an optional length photo',exact:true}).uncheck();
    await expect(page.getByText('0 of 14 hair shots saved',{exact:true})).toBeVisible();await expect(page.getByText('1 optional length photo saved; not required for completion.',{exact:true})).toBeVisible();
    await captures(page,'hair-length');
    const saved=await data(page);expect(saved.photos).toHaveLength(1);expect(saved.session.hair.sets.down.pattern).toEqual({family:'wavy',subtype:'2B',source:'user'});expect(saved.session.hair.sets.bun.pattern).toEqual({family:'curly',subtype:'3C',source:'user'});expect(saved.session.hair.sets.down.colors.length).toMatchObject({name:'Dark brown',nameSource:'user',confirmed:true});
    await page.getByRole('button',{name:'Finish for now',exact:true}).click();await page.getByRole('combobox',{name:'Photos to include',exact:true}).selectOption('all');await page.getByRole('button',{name:'Create ZIP',exact:true}).click();await expect(page.getByRole('link',{name:'Save ZIP',exact:true})).toBeVisible({timeout:30000});const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'Save ZIP',exact:true}).click();const zip=unzipSync(await readFile((await(await downloaded).path())!));const metadata=JSON.parse(strFromU8(zip[Object.keys(zip).find(path=>path.endsWith('/metadata.json'))!]));
    expect(metadata.images).toHaveLength(1);expect(metadata.images[0].hair.kind).toBe('length');expect(metadata.hair.sets.down.includeLength).toBe(false);expect(metadata.hair.sets.down.pattern.source).toBe('user');expect(metadata.hair.sets.down.colors.length.name).toBe('Dark brown');
    await page.reload();await page.getByRole('button',{name:'Continue session',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByText('Pattern and optional length',{exact:true}).click();await expect(page.getByRole('radio',{name:/Wavy/})).toBeChecked();await expect(page.getByRole('combobox',{name:'Subtype (optional)',exact:true})).toHaveValue('2B');await expect(page.getByRole('checkbox',{name:'Include an optional length photo',exact:true})).not.toBeChecked();expect((await data(page)).photos).toHaveLength(1);expect(violations).toEqual([]);
});
test('Solo rehearsal uses large timed cues and never saves photo evidence', async ({ page }) => {
    await fixture(page);
    await start(page);
    await captures(page, 'solo-choice');
    await page.clock.install();
    await page.getByRole('button', { name: 'Practice without saving', exact: true }).first().click();
    await expect(page.locator('.solo-cue')).toBeVisible();
    await captures(page, 'solo-cue');
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    await page.clock.runFor(52000);
    await expect(page.getByText('Practice finished. No photos were saved.', { exact: true })).toBeVisible();
    expect((await data(page)).photos).toEqual([]);
    expect((await data(page)).session.progress.savedIds).toEqual([]);
});
test('a full hair set stays local, is reviewed before Recommended and exports instruction labels and confirmed colors', async ({ page, context }) => {
    test.setTimeout(180000);
    const violations: string[] = [];
    context.on('request', request => { if (new URL(request.url()).origin !== 'http://localhost:5174' || !['GET', 'HEAD'].includes(request.method()) || request.postDataBuffer())
        violations.push(request.url()); });
    await fixture(page);
    await start(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Start camera', exact: true }).click();
    await expect(page.getByText('Hair reference is ready. Check framing before starting.', { exact: true })).toBeVisible({ timeout: 30000 });
    await captures(page, 'hair-mount');
    await page.getByRole('checkbox', { name: 'I checked the phone is secure, the requested hair is visible and only I am in frame.', exact: true }).check();
    await page.getByRole('checkbox', { name: 'I can hear the voice and tones from my mark.', exact: true }).check();
    await page.getByRole('button', { name: 'Start eight-angle turn', exact: true }).click();
    await expect(page.locator('.solo-cue')).toBeVisible();
    await expect(page.getByText('Turn finished. Review each angle before moving on.', { exact: true })).toBeVisible({ timeout: 90000 });
    expect((await data(page)).photos).toHaveLength(8);
    for (const id of ['crown', 'silhouette-front', 'silhouette-back', 'texture-roots', 'texture-middle', 'texture-ends']) {
        await page.getByRole('combobox', { name: 'Choose a hair shot', exact: true }).selectOption(id);
        await page.getByRole('button', { name: 'Take photo', exact: true }).click();
        await expect.poll(async () => (await data(page)).session.hair.sets.down.results[id]?.status, { timeout: 15000 }).toBe('saved');
    }
    await page.getByRole('button', { name: 'Confirm color', exact: true }).first().click();
    await captures(page, 'hair-results');
    const before = await data(page);
    expect(before.photos).toHaveLength(14);
    expect(before.photos.every(photo => photo.quality.tier === 'C' && photo.hair.analysis.personCount === null && photo.hair.labelSource === 'instruction')).toBe(true);
    await page.getByRole('button', { name: 'Finish for now', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create ZIP', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Photo 1', exact: true }).click();
    await page.getByRole('button', { name: 'I checked: this is me alone, and the requested hair is complete and clear.', exact: true }).click();
    await page.getByRole('button', { name: 'Back to photos', exact: true }).click();
    await captures(page, 'hair-review');
    await page.getByRole('button', { name: 'Create ZIP', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Save ZIP', exact: true })).toBeVisible({ timeout: 30000 });
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Save ZIP', exact: true }).click();
    const zip = unzipSync(await readFile((await (await download).path())!));
    const meta = JSON.parse(strFromU8(zip[Object.keys(zip).find(path => path.endsWith('/metadata.json'))!]));
    expect(meta.images).toHaveLength(1);
    expect(meta.readiness).toBeNull();
    expect(meta.images[0].file).toMatch(/^hair\/down\//);
    expect(meta.images[0].hair.analysis.personCount).toBeNull();
    expect(meta.images[0].hair.reviewed).toBe(true);
    expect(Object.values(meta.hair.sets.down.colors).some((color: any) => color.confirmed)).toBe(true);
    const original=(await data(page)).photos.find(photo=>photo.hair.shotId==='angle-front');
    await page.getByRole('button',{name:'Photo 1',exact:true}).click();
    await page.getByRole('button',{name:'Retake this photo',exact:true}).click();
    await page.getByRole('button',{name:'Start camera',exact:true}).click();
    await expect(page.getByText('Hair reference is ready. Check framing before starting.',{exact:true})).toBeVisible({timeout:30000});
    await page.evaluate(()=>{(window as any).hairFixture.sharpness=1;});
    await page.getByRole('button',{name:'Take photo',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Check this photo',exact:true})).toBeVisible({timeout:15000});
    expect((await data(page)).session.hair.sets.down.results['angle-front']).toEqual({status:'saved',photoId:original.id});
    expect((await data(page)).photos).toHaveLength(14);
    await page.getByRole('button',{name:'Discard and try again',exact:true}).click();
    await page.evaluate(()=>{(window as any).hairFixture.sharpness=100;});
    await page.getByRole('button',{name:'Take photo',exact:true}).click();
    await expect(page.getByText('Your earlier photo was kept because the retake was not sharper or did not pass the checks.',{exact:true})).toBeVisible({timeout:15000});
    expect((await data(page)).photos.some(photo=>photo.id===original.id)).toBe(true);
    await page.evaluate(()=>{(window as any).hairFixture.sharpness=200;});
    await page.getByRole('button',{name:'Take photo',exact:true}).click();
    await expect.poll(async()=>(await data(page)).photos.find(photo=>photo.hair.shotId==='angle-front')?.hair.analysis.sharpness,{timeout:15000}).toBe(200);
    expect((await data(page)).photos).toHaveLength(14);expect((await data(page)).photos.some(photo=>photo.id===original.id)).toBe(false);
    await page.evaluate(()=>{const close=FileSystemWritableFileStream.prototype.close;FileSystemWritableFileStream.prototype.close=async function(){await close.call(this);throw new DOMException('Synthetic hair file failure','UnknownError');};(window as any).hairFixture.sharpness=300;});
    await page.getByRole('button',{name:'Take photo',exact:true}).click();
    await expect(page.getByText('Photo could not be saved. Your earlier photos are safe. Check free space, then try again.',{exact:true})).toBeVisible({timeout:15000});
    expect((await data(page)).photos).toHaveLength(14);
    const files=await page.evaluate(async()=>{let count=0;async function walk(directory:FileSystemDirectoryHandle){for await(const [name,item] of (directory as any).entries()){if(item.kind==='directory')await walk(item);else if(name.endsWith('.jpg'))count++;}}await walk(await navigator.storage.getDirectory());return count;});expect(files).toBe(28);
    await page.getByRole('button',{name:'Finish for now',exact:true}).click();await expect(page.getByRole('button',{name:'Create ZIP',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Photo 14',exact:true}).click();await page.getByRole('button',{name:'Delete this photo',exact:true}).click();await page.getByRole('button',{name:'Delete permanently',exact:true}).click();
    await expect.poll(async()=>(await data(page)).photos.length,{timeout:15000}).toBe(13);expect((await data(page)).session.hair.sets.down.results['angle-front'].status).toBe('failed');expect((await data(page)).session.hair.sets.down.colors.head.confirmed).toBe(false);
    expect(violations).toEqual([]);
});
test('handheld scope stays partial and unavailable hair analysis requires explicit risky retention', async ({ page }) => {
    await fixture(page, true);
    await start(page);
    await page.getByRole('radio', { name: /I am alone, nothing to lean on/ }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Start camera', exact: true }).click();
    await expect(page.getByText('Hair analysis is unavailable. Manual photos require explicit risky retention.', { exact: true })).toBeVisible();
    expect(await page.getByRole('combobox', { name: 'Choose a hair shot', exact: true }).locator('option').count()).toBe(4);
    await page.getByRole('button', { name: 'Take photo', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check this photo', exact: true })).toBeVisible();
    expect((await data(page)).photos).toHaveLength(0);
    await page.getByRole('button', { name: 'Keep this photo anyway', exact: true }).click();
    await expect.poll(async () => (await data(page)).photos.length).toBe(1);
    expect((await data(page)).photos[0].override).toBe(true);
    await page.getByRole('button', { name: 'Finish for now', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create ZIP', exact: true })).toBeDisabled();
});
