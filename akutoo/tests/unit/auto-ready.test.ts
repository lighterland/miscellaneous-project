import {it,expect} from 'vitest';
import {autoCaptureReady} from '../../src/capture/auto-ready';
import {shots} from '../../src/session/shotlist';
const base={shot:shots[1],pose:{yaw:-15,pitch:0,roll:0},quality:{score:60,tier:'C' as const,hardFailure:false,reason:null},velocity:0,faceRatio:.5,expression:1};
it('automatically accepts measured eye directions without a shutter, but not absent or opposite evidence',()=>{
 const gaze={...base,shot:shots.find(s=>s.id==='gaze-left')!,pose:{yaw:0,pitch:0,roll:0},blendshapes:{eyeLookOutLeft:.8,eyeLookInRight:.8,eyeLookInLeft:0,eyeLookOutRight:0,eyeLookUpLeft:0,eyeLookUpRight:0,eyeLookDownLeft:0,eyeLookDownRight:0,eyeBlinkLeft:0,eyeBlinkRight:0}};
 expect(autoCaptureReady(gaze)).toBe(true);
 expect(autoCaptureReady({...gaze,blendshapes:{}} as typeof gaze)).toBe(false);
 expect(autoCaptureReady({...gaze,shot:shots.find(s=>s.id==='gaze-right')!})).toBe(false);
});
it('can acquire a usable turn while frame-to-frame pose jitters and soft targets are imperfect',()=>{
 expect(autoCaptureReady({...base,velocity:20,faceRatio:.30,expression:.7})).toBe(true);
});
it('still blocks hard failures, unusable grades, wrong angle, manual shots and wrong requested expressions',()=>{
 expect(autoCaptureReady({...base,quality:{...base.quality,hardFailure:true}})).toBe(false);
 expect(autoCaptureReady({...base,quality:{...base.quality,tier:'D'}})).toBe(false);
 expect(autoCaptureReady({...base,pose:{yaw:0,pitch:0,roll:0}})).toBe(false);
 expect(autoCaptureReady({...base,shot:{...base.shot,manual:true}})).toBe(false);
 expect(autoCaptureReady({...base,shot:{...base.shot,stage:3},expression:.2})).toBe(false);
});

it('removes only unintended soft blockers across a deterministic synthetic gate grid',()=>{
 let oldPass=0,newPass=0,total=0;
 for(const faceRatio of [.25,.30,.35,.50])for(const expression of [.6,.7,.8,1])for(const velocity of [0,7,10,20]){
  total++;if(velocity<8&&faceRatio>=.35&&expression>=.8)oldPass++;
  if(autoCaptureReady({...base,faceRatio,expression,velocity}))newPass++;
 }
 expect({total,oldPass,newPass}).toEqual({total:64,oldPass:8,newPass:64});
});
