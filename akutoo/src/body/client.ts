import type {BodyAnalysis,BodyResponse} from './protocol';
export class BodyClient {
    private worker=new Worker(new URL('./pose-worker.ts',import.meta.url));
    private sequence=0;private closed=false;
    private pending=new Map<number,{resolve:(response:BodyResponse)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
    constructor(){
        this.worker.onmessage=(event:MessageEvent<BodyResponse>)=>{const pending=this.pending.get(event.data.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(event.data.id);if(event.data.type==='error')pending.reject(new Error(event.data.error));else pending.resolve(event.data);};
        this.worker.onerror=()=>this.close();
    }
    private send(message:object,transfer:Transferable[]=[]):Promise<BodyResponse>{
        if(this.closed)return Promise.reject(new Error('Body analysis stopped'));
        const id=++this.sequence;
        return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Body analysis timed out'));},30000);this.pending.set(id,{resolve,reject,timer});try{this.worker.postMessage({...message,id},transfer);}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
    }
    async load(){const response=await this.send({type:'load',base:new URL(import.meta.env.BASE_URL,document.baseURI).href});if(response.type!=='ready')throw new Error('Unexpected body response');}
    async measure(source:CanvasImageSource):Promise<BodyAnalysis>{const bitmap=await createImageBitmap(source as ImageBitmapSource);try{const response=await this.send({type:'frame',bitmap},[bitmap]);if(response.type!=='result')throw new Error('Unexpected body response');return response.result;}catch(error){bitmap.close();throw error;}}
    close(){this.closed=true;this.worker.terminate();for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error('Body analysis stopped'));}this.pending.clear();}
}
