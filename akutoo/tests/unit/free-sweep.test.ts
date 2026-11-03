import {it,expect} from 'vitest';
import {selectSweepShot, finishSweep, chooseTimedProfile} from '../../src/session/free-sweep';
import {freshProgress,acceptSlot} from '../../src/session/progress';
import {shots} from '../../src/session/shotlist';
it('collects a different missing angle without demanding the next ordered target',()=>{
 const p={...freshProgress(0),freeSweep:true,completed:['turn-0'],index:1};
 const chosen=selectSweepShot(p,{yaw:30,pitch:0,roll:0});
 expect(shots[chosen!].id).toBe('turn-30');
 const next=acceptSlot({...p,index:chosen!},'photo');
 expect(next.index).toBe(1);expect(next.completed).toContain('turn-30');
 expect(selectSweepShot(next,{yaw:30,pitch:0,roll:0})).toBeNull();
});
it('does not leave the sweep early after an out-of-order chin shot',()=>{
 const p={...freshProgress(0),freeSweep:true};
 const chosen=selectSweepShot(p,{yaw:0,pitch:15,roll:0});
 expect(shots[chosen!].id).toBe('chin-down');
 expect(acceptSlot({...p,index:chosen!},'photo').index).toBe(0);
});
it('finishing preserves files and completion while marking only missing angles for later',()=>{
 const p={...freshProgress(0),freeSweep:true,completed:['turn-0'],savedIds:['photo']};
 const next=finishSweep(p);
 expect(next.index).toBe(15);expect(next.savedIds).toEqual(['photo']);
 expect(next.missed).toHaveLength(14);expect(next.completed).toEqual(['turn-0']);
});
it('keeps unknown poses, old ordered sessions and later stages out of opportunistic capture',()=>{
 expect(selectSweepShot({...freshProgress(0),freeSweep:false},{yaw:30,pitch:0,roll:0})).toBeNull();
 expect(selectSweepShot(freshProgress(0),null)).toBeNull();
 expect(selectSweepShot({...freshProgress(0),index:15},{yaw:30,pitch:0,roll:0})).toBeNull();
});

it('keeps the shared prompt/time budget when continuing past unfilled angles',()=>{
 const p=freshProgress(123);p.attempts={...p.attempts,prompts:10,slotAttempts:3,consecutive:3,lastCause:'focus',sessionFix:'focus',relaxed:true};
 const next=finishSweep(p);
 expect(next.attempts).toMatchObject({startedAt:123,prompts:10,slotAttempts:0,consecutive:0,sessionFix:null,relaxed:true,promptRetake:false});
});

it('preserves existing defer reasons when continuing with the collected angles',()=>{
 const p={...freshProgress(0),missed:['turn--15'],skipped:{'turn--15':'uncomfortable'}};
 expect(finishSweep(p).skipped['turn--15']).toBe('uncomfortable');
});
it('switches timed targets without reopening a deferred profile retry budget',()=>{
 const p=freshProgress(123);p.index=9;p.attempts={...p.attempts,slotAttempts:2,prompts:2};
 const next=chooseTimedProfile(p,90)!;
 expect(next.index).toBe(12);expect(next.missed).toContain('turn--90');
 expect(next.attempts).toMatchObject({slotAttempts:0,prompts:2,startedAt:123});
 expect(chooseTimedProfile(next,-90)).toBeNull();
});
