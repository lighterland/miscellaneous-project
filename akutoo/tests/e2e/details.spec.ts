import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
async function data(page: Page) { return page.evaluate(async()=>{const database=await new Promise<IDBDatabase>(resolve=>{const open=indexedDB.open('akutoo');open.onsuccess=()=>resolve(open.result);});const all=(name:string)=>new Promise<any[]>(resolve=>{const get=database.transaction(name).objectStore(name).getAll();get.onsuccess=()=>resolve(get.result);});const photos=await all('photos'),sessions=await all('sessions');database.close();return {photos,session:sessions[0]};}); }
async function captureScreens(page: Page, name: string) { for(const [suffix,width,height] of [['mobile',390,844],['desktop',1280,900]] as const){await page.setViewportSize({width,height});await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});await page.screenshot({path:`.impeccable/review/${name}-${suffix}.png`,fullPage:true,animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);} }
test('facial details keep independent references and progress, require review and export target evidence locally',async({page,context})=>{
  test.setTimeout(180000);
  const violations:string[]=[];context.on('request',request=>{if(new URL(request.url()).origin!=='http://localhost:5174'||!['GET','HEAD'].includes(request.method())||request.postDataBuffer())violations.push(request.url());});
  await page.addInitScript(()=>{
    const Original=window.Worker;(window as any).detailFixture={sharpness:50};
    window.Worker=class{onmessage:any=null;onerror:any=null;constructor(url:string|URL,options?:WorkerOptions){if(!String(url).includes('/worker-'))return new Original(url,options) as any;}postMessage(message:any){if(message.type==='load'){setTimeout(()=>this.onmessage?.({data:{id:message.id,type:'ready'}}),5);return;}const {width,height}=message.bitmap;message.bitmap.close();const target=message.target;const result={measurements:{faceCount:1,occluded:false,occlusionVerified:false,headCutOff:false,sharpness:999,clipped:.01,exposure:120,faceRatio:.8,shortSide:Math.min(width,height),angleError:0,expressionMatch:1},pose:{yaw:0,pitch:0,roll:0},blendshapes:{},hash:'0000000000000000',durationMs:5,occlusionVerified:false,...(target?{target:{source:'guide',visibilityVerified:false,bounds:{x:Math.floor(target.x*width),y:Math.floor(target.y*height),width:Math.ceil(target.width*width),height:Math.ceil(target.height*height)},metrics:{sharpness:(window as any).detailFixture.sharpness,exposure:90,clipped:.01},sourceDimensions:{width,height}}}:{})};setTimeout(()=>this.onmessage?.({data:{id:message.id,type:'result',result}}),5);}terminate(){}} as any;
    const media=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=()=>media({video:{width:{ideal:1280},height:{ideal:1024}}});
  });
  await page.goto('/');await expect(page.getByText('Ready offline',{exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Start new session',exact:true}).click();await page.getByRole('button',{name:'Finish for now',exact:true}).click();
  await captureScreens(page,'detail-entry');
  await page.getByRole('button',{name:'Capture facial details',exact:true}).click();
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  for(let index=0;index<11;index++){
    await page.evaluate(sharpness=>{(window as any).detailFixture.sharpness=sharpness;},50+index);
    await expect.poll(async()=>(await data(page)).session.details.baseline?.sharpness,{timeout:20000}).toBe(50+index);
    if(index===0){await captureScreens(page,'detail-capture');const frame=await page.locator('.detail-camera').boundingBox(),guide=await page.locator('.detail-guide').boundingBox();expect(frame&&guide).toBeTruthy();expect(guide!.width/frame!.width).toBeCloseTo(.7,2);expect(guide!.height/frame!.height).toBeCloseTo(.8,2);}
    if(index===1)await captureScreens(page,'detail-eye');
    await page.getByRole('button',{name:'Take photo',exact:true}).click();
    await expect.poll(async()=>(await data(page)).photos.length,{timeout:15000}).toBe(index+1);
    await expect.poll(async()=>(await data(page)).session.details.baseline,{timeout:15000}).toBeUndefined();
  }
  const saved=await data(page);expect(saved.session.progress.index).toBe(0);expect(saved.session.progress.completed).toEqual([]);expect(saved.session.details.progress.completed).toHaveLength(11);
  expect(saved.photos.every(photo=>photo.detail.target.visibilityVerified===false&&photo.detail.faceMeasurements.sharpness===999&&photo.measurements.sharpness===photo.baseline.sharpness&&photo.quality.tier==='C')).toBe(true);
  await page.getByRole('button',{name:'Finish for now',exact:true}).click();await expect(page.getByRole('button',{name:'Create ZIP',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Photo 1',exact:true}).click();await page.getByRole('button',{name:'I checked: this is me alone, and the named detail is complete and sharp.',exact:true}).click();await page.getByRole('button',{name:'Back to photos',exact:true}).click();
  await captureScreens(page,'detail-review');
  await page.getByRole('button',{name:'Create ZIP',exact:true}).click();await expect(page.getByRole('link',{name:'Save ZIP',exact:true})).toBeVisible({timeout:30000});const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'Save ZIP',exact:true}).click();const zip=unzipSync(await readFile((await(await downloaded).path())!));const metadata=JSON.parse(strFromU8(zip[Object.keys(zip).find(path=>path.endsWith('/metadata.json'))!]));
  expect(metadata.images).toHaveLength(1);expect(metadata.images[0].file).toMatch(/^face\/details\//);expect(metadata.images[0].detail.reviewed).toBe(true);expect(metadata.images[0].detail.target.visibilityVerified).toBe(false);expect(metadata.poseCoverage.filled).toEqual([]);
  expect(metadata.images[0].requestedPose).toEqual({yaw:null,pitch:null});
  await page.getByRole('button',{name:'Photo 1',exact:true}).click();await page.getByRole('button',{name:'Delete this photo',exact:true}).click();await page.getByRole('button',{name:'Delete permanently',exact:true}).click();await expect.poll(async()=>(await data(page)).photos.length).toBe(10);expect((await data(page)).session.progress.missed).toEqual([]);expect((await data(page)).session.details.progress.completed).toHaveLength(10);
  await page.reload();await expect(page.getByText('10 photos saved',{exact:true})).toBeVisible();
  expect(violations).toEqual([]);
});
