import {describe,it,expect} from 'vitest';
import {selectSweepShot} from '../../src/session/free-sweep';
import {freshProgress,acceptSlot,advanceSlot} from '../../src/session/progress';
import {shots} from '../../src/session/shotlist';
const index=(direction:string)=>shots.findIndex(s=>s.id===`gaze-${direction}`);
const start=()=>({...freshProgress(0),index:index('left')});
const pose={yaw:0,pitch:0,roll:0};
describe('continuous eye scan',()=>{
 it('collects an unfinished direction out of order',()=>{
  expect(selectSweepShot(start(),pose,'up')).toBe(index('up'));
 });
 it('returns to missing directions after an out of order save and advances only after all four',()=>{
  let p=start();
  for(const direction of ['down','right','left','up']){
   p=acceptSlot({...p,index:index(direction)},direction);
  }
  expect(p.completed).toEqual(['gaze-down','gaze-right','gaze-left','gaze-up']);
  expect(p.index).toBe(index('down')+1);
  expect(acceptSlot({...start(),index:index('down')},'photo').index).toBe(index('left'));
 });
 it('does not reopen completed, deferred, unmeasured or exhausted directions',()=>{
  const p=start();
  expect(selectSweepShot({...p,completed:['gaze-up']},pose,'up')).toBeNull();
  expect(selectSweepShot({...p,missed:['gaze-up']},pose,'up')).toBeNull();
  expect(selectSweepShot(p,pose,null)).toBeNull();
  expect(selectSweepShot(p,{...pose,yaw:20},'up')).toBeNull();
  expect(selectSweepShot({...p,attempts:{...p.attempts,slotAttempts:1}},pose,'up')).toBeNull();
  expect(selectSweepShot({...p,revisiting:true},pose,'up')).toBeNull();
 });
 it('defers only the skipped direction and keeps the other missing directions',()=>{
  const p=advanceSlot({...start(),index:index('down')},'later');
  expect(p.index).toBe(index('left'));expect(p.missed).toEqual(['gaze-down']);
 });
});
