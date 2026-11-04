import {expect,it} from 'vitest';
import {offerFrame,measuredTarget,type FrameWindow} from '../../src/capture/rolling-burst';
const frame=(index:number,score=70,sharpness=100)=>({index,score,sharpness});
it('keeps the best frame already seen when a moving face enters another bin',()=>{
 let window:FrameWindow<ReturnType<typeof frame>>|null=null;
 const a=frame(1,70),b=frame(1,80),c=frame(2,75);
 window=offerFrame(window,a).window;
 const second=offerFrame(window,b);expect(second.discard).toEqual([a]);
 const crossing=offerFrame(second.window,c);
 expect(crossing.ready).toBe(b);expect(crossing.window?.best).toBe(c);
});
it('finishes a stationary burst after five frames without another hold or new exposure',()=>{
 let window:FrameWindow<ReturnType<typeof frame>>|null=null;
 for(let i=0;i<4;i++)window=offerFrame(window,frame(1,70,100+i)).window;
 const result=offerFrame(window,frame(1,70,105));expect(result.ready?.sharpness).toBe(105);expect(result.window).toBeNull();
});
it('flushes an already captured valid frame when tracking is lost without inventing another pose',()=>{
 const a=frame(1);const result=offerFrame(offerFrame(null,a).window,null);
 expect(result.ready).toBe(a);expect(result.window).toBeNull();
});
it('requires actual chin coverage even inside the wider target tolerance',()=>{
 expect(measuredTarget({yaw:0,pitch:-15},{yaw:0,pitch:-10,roll:0})).toBe(false);
 expect(measuredTarget({yaw:0,pitch:-15},{yaw:0,pitch:-15,roll:0})).toBe(true);
 expect(measuredTarget({yaw:-15,pitch:0},{yaw:-30,pitch:0,roll:0})).toBe(false);
 expect(measuredTarget({yaw:0,pitch:0},null)).toBe(false);
});
