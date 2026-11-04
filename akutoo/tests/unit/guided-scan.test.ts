import {expect,it} from 'vitest';
import {freshProgress,acceptSlot} from '../../src/session/progress';
import {selectSweepShot} from '../../src/session/free-sweep';
import {beginGuidedScan,updateGuide,suggestedShot,chooseScanGroup,scanFeedback,stallLevel,primaryIds} from '../../src/session/guided-scan';
const pose=(yaw=0,pitch=0)=>({yaw,pitch,roll:0});
it('keeps a stable suggestion while collecting another primary angle',()=>{
 const p=beginGuidedScan({...freshProgress(0),completed:['turn-0']});
 const guided=updateGuide(p,pose());
 expect(suggestedShot(guided)?.id).toBe('turn--15');
 const index=selectSweepShot(guided,pose(30))!;
 expect(index).toBe(5);
 const next=acceptSlot({...guided,index},'saved');
 expect(suggestedShot(updateGuide(next,pose(30)))?.id).toBe('turn--15');
 expect(selectSweepShot(guided,pose(75))).toBeNull();
});
it('returns to front between sides and then guides chin movement',()=>{
 let p=beginGuidedScan({...freshProgress(0),completed:['turn-0','turn--15','turn--30','turn--45']});
 p=updateGuide(p,pose(-45));expect(p.guidedScan?.phase).toBe('return-left');
 p=updateGuide(p,pose());expect(p.guidedScan?.phase).toBe('right');
 p.completed.push('turn-15','turn-30','turn-45');
 p=updateGuide(p,pose(45));expect(p.guidedScan?.phase).toBe('return-right');
 p=updateGuide(p,pose());expect(suggestedShot(p)?.id).toBe('chin-up');
});
it('enters summary after nine saved positions without awarding profiles',()=>{
 const p=beginGuidedScan({...freshProgress(0),completed:primaryIds.slice(0,-1),index:14,savedIds:['old']});
 const next=acceptSlot(p,'last');
 expect(next.guidedScan?.group).toBe('summary');
 expect(next.completed).toHaveLength(9);expect(next.savedIds).toEqual(['old','last']);
 const extra=chooseScanGroup(next,'extra');expect(extra.index).toBe(7);
 expect(extra.completed).not.toContain('turn-90');
});
it('preserves skipped reasons and budgets when leaving and resuming a group',()=>{
 const p=beginGuidedScan({...freshProgress(123),completed:['turn-0'],missed:['turn--15'],skipped:{'turn--15':'uncomfortable'}});
 p.attempts.prompts=8;p.attempts.slotAttempts=2;
 const next=chooseScanGroup(p,'expressions');
 expect(next.index).toBe(15);expect(next.skipped['turn--15']).toBe('uncomfortable');
 expect(next.attempts).toMatchObject({startedAt:123,prompts:8});
 expect(next.missed).toHaveLength(14);
 expect(beginGuidedScan(next)).toEqual(next);
});
it('uses one truthful cue for recovery, hold, saving and overshoot',()=>{
 const p=updateGuide(beginGuidedScan({...freshProgress(0),completed:['turn-0']}),pose());
 expect(scanFeedback(p,null,false,false).status).toBe('recovering');
 expect(scanFeedback(p,pose(-15),true,false).status).toBe('holding');
 expect(scanFeedback(p,pose(-15),false,true).status).toBe('saving');
 expect(scanFeedback(p,pose(-40),false,false).cue).toBe('back');
 expect(stallLevel(14999)).toBe('none');expect(stallLevel(15000)).toBe('help');expect(stallLevel(30000)).toBe('offer');
});

it('recovers to a frontal example and preserves an old session when enabled',()=>{
 const original={...freshProgress(5),index:7,completed:['turn-0'],savedIds:['existing'],missed:['turn--15'],skipped:{'turn--15':'uncomfortable'}};
 const next=beginGuidedScan(original);
 expect(next.index).toBe(2);expect(next.savedIds).toEqual(['existing']);expect(next.attempts).toEqual(original.attempts);
 expect(scanFeedback(next,null,false,false).target?.id).toBe('turn-0');
 expect(scanFeedback(next,pose(-30,25),false,false).cue).toBe('front');
});
