import type { HairAnalysis, HairResponse } from './protocol';
export class HairClient {
  private worker=new Worker(new URL('./hair-worker.ts',import.meta.url));
  private sequence=0;
  private pending=new Map<number,{resolve:(value:HairResponse)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor() {
    this.worker.onmessage=(event:MessageEvent<HairResponse>)=>{const pending=this.pending.get(event.data.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(event.data.id);if(event.data.type==='error')pending.reject(new Error(event.data.error));else pending.resolve(event.data);};
    this.worker.onerror=()=>this.close();
  }
  private send(message:object,transfer:Transferable[]=[]) {
    const id=++this.sequence;
    return new Promise<HairResponse>((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Hair analysis timed out'));},30000);this.pending.set(id,{resolve,reject,timer});try{this.worker.postMessage({...message,id},transfer);}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
  }
  async load():Promise<string[]> { const response=await this.send({type:'load',base:new URL(import.meta.env.BASE_URL,document.baseURI).href});if(response.type!=='ready')throw new Error('Unexpected hair response');return response.labels; }
  async measure(source:CanvasImageSource):Promise<HairAnalysis> { const bitmap=await createImageBitmap(source as ImageBitmapSource);const response=await this.send({type:'frame',bitmap},[bitmap]);if(response.type!=='result')throw new Error('Unexpected hair response');return response.result; }
  close() {this.worker.terminate();for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error('Hair analysis stopped'));}this.pending.clear();}
}
