/// <reference lib="webworker" />
import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision';
import {maskedMetrics} from '../hair/metrics';
import type {BodyRequest,BodyResponse,BodyAnalysis} from './protocol';
let model:PoseLandmarker|undefined,chain=Promise.resolve();
const frame=new OffscreenCanvas(1,1),crop=new OffscreenCanvas(256,256);
function reply(value:BodyResponse){self.postMessage(value);}
async function handle(request:BodyRequest){
    try {
        if(request.type==='load'){
            model?.close();const base=new URL(request.base);
            model=await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(new URL('wasm',base).href),{
                baseOptions:{modelAssetPath:new URL('models/pose_landmarker_lite.task',base).href,delegate:'CPU'},runningMode:'IMAGE',numPoses:2,outputSegmentationMasks:true,
            });
            reply({type:'ready',id:request.id});return;
        }
        if(!model)throw new Error('Body analysis is not loaded');
        const began=performance.now(),{width,height}=request.bitmap,scale=Math.min(1,480/Math.max(width,height));
        frame.width=Math.max(1,Math.round(width*scale));frame.height=Math.max(1,Math.round(height*scale));
        frame.getContext('2d')!.drawImage(request.bitmap,0,0,frame.width,frame.height);
        const detection=model.detect(frame);
        try {
            const segmentation=detection.segmentationMasks?.[0];
            let bounds:BodyAnalysis['bounds']=null,metrics:BodyAnalysis['metrics']=null,area=0;
            if(detection.landmarks.length&&segmentation){
                const raw=segmentation.getAsFloat32Array(),mask=Uint8Array.from(raw,value=>value>=.5?1:0),mw=segmentation.width,mh=segmentation.height;
                const target=maskedMetrics(new Float64Array(mask.length),mask,mw,mh),box=target.bounds;area=target.area;
                if(box){
                    bounds={x:box.x/mw,y:box.y/mh,width:box.width/mw,height:box.height/mh};
                    const ctx=crop.getContext('2d',{willReadFrequently:true})!;
                    ctx.drawImage(request.bitmap,bounds.x*width,bounds.y*height,bounds.width*width,bounds.height*height,0,0,256,256);
                    const rgba=ctx.getImageData(0,0,256,256).data,gray=new Float64Array(256*256),localMask=new Uint8Array(gray.length);
                    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
                        const i=y*256+x,mx=Math.min(mw-1,box.x+Math.floor(x/256*box.width)),my=Math.min(mh-1,box.y+Math.floor(y/256*box.height));
                        localMask[i]=mask[my*mw+mx];gray[i]=.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2];
                    }
                    const measured=maskedMetrics(gray,localMask,256,256);metrics={sharpness:measured.sharpness,exposure:measured.exposure,clipped:measured.clipped};
                }
            }
            reply({type:'result',id:request.id,result:{detectedPoses:detection.landmarks.length,landmarks:detection.landmarks[0]??[],bounds,targetArea:area,metrics,sourceDimensions:{width,height},durationMs:performance.now()-began,model:'pose-landmarker-lite-v1'}});
        }finally{detection.segmentationMasks?.forEach(mask=>mask.close());}
    }catch(error){reply({type:'error',id:request.id,error:error instanceof Error?error.message:'Body analysis failed'});}
    finally{if(request.type==='frame')request.bitmap.close();}
}
self.onmessage=(event:MessageEvent<BodyRequest>)=>{chain=chain.then(()=>handle(event.data));};
