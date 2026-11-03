import {describe,it,expect} from 'vitest';
import {poseGuidance, speechDelay} from '../../src/capture/pose-guidance';
import {shots} from '../../src/session/shotlist';
const quality={score:64,tier:'C' as const,hardFailure:false,reason:null};
const target=shots[1];
const cue=(yaw:number,pitch=0,extra={})=>poseGuidance({shot:target,pose:{yaw,pitch,roll:0},quality,faceRatio:.5,expression:1,velocity:0,ready:false,...extra});
describe('actionable pose feedback without changing capture acceptance',()=>{
 it('corrects undershoot, overshoot and target changes using subject directions',()=>{
  expect(cue(0)).toBe('left');expect(cue(-30)).toBe('right');
  expect(cue(0,0,{shot:shots.find(s=>s.id==='turn-15')!})).toBe('right');
 });
 it('corrects pitch, then describes the remaining auto blockers',()=>{
  expect(cue(-15,20)).toBe('up');expect(cue(-15,-20)).toBe('down');
  expect(cue(-15,0,{faceRatio:.2})).toBe('steady');
  expect(cue(-15,0,{expression:.5})).toBe('steady');
  expect(cue(-15,0,{velocity:20})).toBe('steady');
  expect(cue(-15,0,{ready:true})).toBe('ready');
 });
 it('never substitutes estimated directions for missing pose or a hard failure',()=>{
  expect(cue(0,0,{pose:null})).toBe('tracking');
  expect(cue(0,0,{quality:{...quality,hardFailure:true,reason:'light'}})).toBe('light');
  expect(cue(0,0,{shot:shots.find(s=>s.manual)!})).toBe('manual');
 });
 it('spaces spoken corrections without interrupting every analysis frame',()=>{
  expect(speechDelay(1000,900)).toBe(3400);
  expect(speechDelay(5000,900)).toBe(350);
 });
});
