// Run against the local Vite development server. Only synthetic pixels are used.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
// Match the production worker format; MediaPipe's loader requires classic importScripts.
await build({configFile:false,build:{outDir:'.scratch/body-probe',emptyOutDir:false,lib:{entry:fileURLToPath(new URL('../src/body/pose-worker.ts',import.meta.url)),formats:['iife'],name:'BodyProbe',fileName:()=> 'pose-worker.js'},minify:true}});
const origin='http://localhost:5176';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
    const page=await browser.newPage(),violations=[];
    page.on('request',request=>{if(new URL(request.url()).origin!==origin||!['GET','HEAD'].includes(request.method())||request.postDataBuffer())violations.push(request.url());});
    await page.goto(origin);
    const result=await page.evaluate(async()=>{
        const worker=new Worker('/.scratch/body-probe/pose-worker.js');let id=0;
        const send=(message,transfer=[])=>new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(new Error('Body worker timeout')),30000);
            worker.onmessage=event=>{clearTimeout(timer);event.data.type==='error'?reject(new Error(event.data.error)):resolve(event.data);};
            worker.onerror=event=>{clearTimeout(timer);reject(new Error(event.message));};
            worker.postMessage({...message,id:++id},transfer);
        });
        try {
            await send({type:'load',base:location.origin+'/'});
            const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;
            const ctx=canvas.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,1024,768);
            const bitmap=await createImageBitmap(canvas);
            return (await send({type:'frame',bitmap},[bitmap])).result;
        } finally {worker.terminate();}
    });
    assert.equal(result.detectedPoses,0);assert.equal(result.bounds,null);assert.equal(result.metrics,null);
    assert.deepEqual(result.landmarks,[]);assert.deepEqual(result.sourceDimensions,{width:1024,height:768});
    assert.equal(result.model,'pose-landmarker-lite-v1');assert.deepEqual(violations,[]);
    console.log(JSON.stringify({passed:true,detectedPoses:result.detectedPoses,sourceDimensions:result.sourceDimensions,durationMs:result.durationMs,networkViolations:violations.length}));
} finally {await browser.close();}
