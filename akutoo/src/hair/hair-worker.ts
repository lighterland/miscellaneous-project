/// <reference lib="webworker" />
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { maskedMetrics, maskedSwatch } from './metrics';
import { colorClusters, backgroundCast, type ColorCluster } from './color';
import type { HairRequest, HairResponse, HairAnalysis } from './protocol';
let model:ImageSegmenter|undefined, hairIndex=-1, backgroundIndex=-1, chain=Promise.resolve();
const frame=new OffscreenCanvas(1,1), crop=new OffscreenCanvas(256,256);
function reply(value:HairResponse) { self.postMessage(value); }
async function handle(request:HairRequest) {
  try {
    if(request.type==='load') {
      model?.close(); const base=new URL(request.base);
      model=await ImageSegmenter.createFromOptions(await FilesetResolver.forVisionTasks(new URL('wasm',base).href),{baseOptions:{modelAssetPath:new URL('models/selfie_multiclass_256x256.tflite',base).href,delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:false});
      const labels=model.getLabels(); hairIndex=labels.findIndex(label=>label.toLowerCase()==='hair');
      backgroundIndex=labels.findIndex(label=>label.toLowerCase()==='background');
      if(hairIndex<0) throw new Error('Model has no hair category');
      reply({type:'ready',id:request.id,labels}); return;
    }
    if(!model) throw new Error('Segmentation is not loaded');
    const started=performance.now(), {width,height}=request.bitmap, scale=Math.min(1,480/Math.max(width,height));
    frame.width=Math.max(1,Math.round(width*scale));frame.height=Math.max(1,Math.round(height*scale));frame.getContext('2d')!.drawImage(request.bitmap,0,0,frame.width,frame.height);
    const segmented=model.segment(frame);
    try {
      const category=segmented.categoryMask;if(!category) throw new Error('Missing category mask');
      const values=category.getAsUint8Array(), mask=Uint8Array.from(values,value=>value===hairIndex?1:0);
      const target=maskedMetrics(new Float64Array(mask.length),mask,category.width,category.height), bounds=target.bounds;
      let detail:ReturnType<typeof maskedMetrics>|null=null, swatch:string|null=null, clusters:ColorCluster[]=[];
      if(bounds) {
        const context=crop.getContext('2d',{willReadFrequently:true})!;
        context.drawImage(request.bitmap,bounds.x/category.width*width,bounds.y/category.height*height,bounds.width/category.width*width,bounds.height/category.height*height,0,0,256,256);
        const rgba=context.getImageData(0,0,256,256).data, gray=new Float64Array(256*256), localMask=new Uint8Array(gray.length);
        for(let y=0;y<256;y++) for(let x=0;x<256;x++) {
          const i=y*256+x, mx=Math.min(category.width-1,bounds.x+Math.floor(x/256*bounds.width)), my=Math.min(category.height-1,bounds.y+Math.floor(y/256*bounds.height));
          localMask[i]=mask[my*category.width+mx];gray[i]=.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2];
        }
        detail=maskedMetrics(gray,localMask,256,256);swatch=maskedSwatch(rgba,localMask);
        clusters=colorClusters(rgba,localMask);
      }
      const result:HairAnalysis={targetArea:target.area,bounds:bounds?{x:bounds.x/category.width,y:bounds.y/category.height,width:bounds.width/category.width,height:bounds.height/category.height}:null,sharpness:detail?.sharpness??null,exposure:detail?.exposure??null,brightClipped:detail?.brightClipped??null,clipped:detail?.clipped??null,swatch,personCount:null,occlusionVerified:false,sourceDimensions:{width,height},durationMs:performance.now()-started};
      const background=Uint8Array.from(values,value=>value===backgroundIndex?1:0);
      // Scale category coordinates to the same frame pixels before sampling the background.
      const backgroundMask=new Uint8Array(frame.width*frame.height);
      for(let y=0;y<frame.height;y++) for(let x=0;x<frame.width;x++) backgroundMask[y*frame.width+x]=background[Math.min(category.height-1,Math.floor(y/frame.height*category.height))*category.width+Math.min(category.width-1,Math.floor(x/frame.width*category.width))];
      result.colorClusters=clusters;
      result.colorCast=backgroundCast(frame.getContext('2d')!.getImageData(0,0,frame.width,frame.height).data,backgroundMask);
      result.durationMs=performance.now()-started;
      reply({type:'result',id:request.id,result});
    } finally { segmented.close(); }
  } catch(error) { reply({type:'error',id:request.id,error:error instanceof Error?error.message:'Hair analysis failed'}); }
  finally { if(request.type==='frame') request.bitmap.close(); }
}
self.onmessage=(event:MessageEvent<HairRequest>)=>{chain=chain.then(()=>handle(event.data));};
