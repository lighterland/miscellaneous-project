// Ownership transfers on offer/take; overflow never grows camera memory without bound.
export class FrameQueue<T extends {index:number}> {
 private frames:T[]=[];
 constructor(private limit:number,private release:(frame:T)=>void){}
 indices(){return this.frames.map(frame=>frame.index);}
 offer(frame:T){if(this.frames.length>=this.limit||this.indices().includes(frame.index))this.release(frame);else this.frames.push(frame);}
 take(){return this.frames.shift();}
 clear(){for(const frame of this.frames)this.release(frame);this.frames=[];}
}
