import type {Progress} from './progress';
import {nextSlot,resetCause} from './attempts';
import {shots,type Shot} from './shotlist';
import type {AnalysisResult} from '../analysis/protocol';

export const primaryIds=['turn-0','turn--15','turn--30','turn--45','turn-15','turn-30','turn-45','chin-up','chin-down'];
export const extraIds=['turn--60','turn--75','turn--90','turn-60','turn-75','turn-90'];
export type ScanPhase='front'|'left'|'return-left'|'right'|'return-right'|'up'|'down';
export interface GuidedScan {group:'primary'|'extra'|'summary'|'expressions';phase:ScanPhase;summaryOf?:'primary'|'extra';}
export type ScanStatus='turning'|'collecting'|'holding'|'saving'|'recovering'|'complete';
export type ScanCue='front'|'left'|'right'|'up'|'down'|'back'|'hold'|'saving'|'recover'|'complete';
const phases:ScanPhase[]=['front','left','return-left','right','return-right','up','down'];
const phaseIds:Record<ScanPhase,string[]>={front:['turn-0'],left:primaryIds.slice(1,4),'return-left':[],right:primaryIds.slice(4,7),'return-right':[],up:['chin-up'],down:['chin-down']};
const idsFor=(p:Progress,phase:ScanPhase)=>p.guidedScan?.group==='extra'?(phase==='left'?extraIds.slice(0,3):phase==='right'?extraIds.slice(3):[]):phaseIds[phase];
const unfinished=(p:Progress,id:string)=>!p.completed.includes(id)&&!p.missed.includes(id);
export function guidedActive(p:Progress):boolean {return !!p.guidedScan&&!p.revisiting&&p.guidedScan.group!=='expressions';}
export function groupIds(p:Progress):string[] {return p.guidedScan?.group==='extra'?extraIds:primaryIds;}
export function beginGuidedScan(p:Progress):Progress {
 if(p.guidedScan||p.revisiting||p.index>=15)return p;
 return advanceGuided({...p,freeSweep:true,guidedScan:{group:'primary',phase:'front'}});
}
// Suggestion is independent of the opportunistic capture target stored in index.
export function updateGuide(p:Progress,pose:AnalysisResult['pose']):Progress {
 if(!guidedActive(p)||p.guidedScan!.group==='summary')return p;
 if(!groupIds(p).some(id=>unfinished(p,id)))return {...p,index:15,guidedScan:{...p.guidedScan!,group:'summary',summaryOf:p.guidedScan!.group==='extra'?'extra':'primary'}};
 let phase=p.guidedScan!.phase;
 for(let i=0;i<phases.length;i++){
  if(phase.startsWith('return')){
   if(!pose||Math.abs(pose.yaw)>7||Math.abs(pose.pitch)>7)break;
  }else if(idsFor(p,phase).some(id=>unfinished(p,id)))break;
  const next=phases[phases.indexOf(phase)+1];if(!next)break;phase=next;
 }
 return phase===p.guidedScan!.phase?p:{...p,guidedScan:{...p.guidedScan!,phase}};
}
export function suggestedShot(p:Progress):Shot|undefined {
 if(!guidedActive(p)||p.guidedScan!.group==='summary')return undefined;
 const phase=p.guidedScan!.phase;
 if(phase.startsWith('return'))return shots[0];
 // Show the end of a movement, not the next small angle being sampled.
 return shots.filter(s=>idsFor(p,phase).includes(s.id)&&unfinished(p,s.id)).at(-1);
}
export function advanceGuided(p:Progress):Progress {
 const next=updateGuide(p,null);
 if(next.guidedScan?.group==='summary')return next;
 const index=shots.findIndex(s=>groupIds(next).includes(s.id)&&unfinished(next,s.id));
 return {...next,index:index<0?15:index};
}
// An optional side that loses tracking after a deliberate turn is deferred,
// never treated as a measured profile. This lets the other side continue.
export function deferUntrackedSide(p:Progress,lastYaw:number):Progress {
 const phase=p.guidedScan?.phase;
 if(p.guidedScan?.group!=='extra'||!((phase==='left'&&lastYaw<=-45)||(phase==='right'&&lastYaw>=45)))return p;
 const missing=idsFor(p,phase).filter(id=>unfinished(p,id));
 return {...p,guidedScan:{...p.guidedScan,phase:phase==='left'?'return-left':'return-right'},missed:[...new Set([...p.missed,...missing])],skipped:{...Object.fromEntries(missing.map(id=>[id,'tracking-limited'])),...p.skipped}};
}
export function chooseScanGroup(p:Progress,group:'extra'|'expressions'|'summary'):Progress {
 if(!p.guidedScan)return p;
 const defer=group==='expressions'?[...primaryIds,...extraIds]:groupIds(p);
 const missing=defer.filter(id=>!p.completed.includes(id));
 const next:Progress={...p,guidedScan:{...p.guidedScan,group,phase:group==='extra'?'front':p.guidedScan.phase,summaryOf:group==='summary'?(p.guidedScan.group==='extra'?'extra':'primary'):undefined},missed:[...new Set([...p.missed,...missing])],skipped:{...Object.fromEntries(missing.map(id=>[id,'later'])),...p.skipped},attempts:resetCause(nextSlot(p.attempts))};
 if(group==='extra'){
  // Deferred profiles keep their one explicit revisit path; do not reopen attempts.
  return advanceGuided(next);
 }
 return {...next,index:15};
}
export function scanFeedback(p:Progress,pose:AnalysisResult['pose'],ready:boolean,busy:boolean):{status:ScanStatus;cue:ScanCue;target:Shot|undefined} {
 const target=suggestedShot(p);
 if(p.guidedScan?.group==='summary')return {status:'complete',cue:'complete',target};
 if(!pose||![pose.yaw,pose.pitch,pose.roll].every(Number.isFinite))return {status:'recovering',cue:'recover',target:shots[0]};
 if(!target)return {status:'turning',cue:'front',target:shots[0]};
 if(p.guidedScan?.phase.startsWith('return'))return {status:'turning',cue:'front',target};
 if((target.pitch&&Math.abs(pose.yaw)>7)||(!target.pitch&&Math.abs(pose.pitch)>7))return {status:'turning',cue:'front',target:shots[0]};
 const axis=target.pitch?'pitch':'yaw',value=pose[axis],goal=target[axis];
 const overshoot=goal!==0&&Math.sign(value)===Math.sign(goal)&&Math.abs(value)>Math.abs(goal)+7;
 const cue:ScanCue=overshoot?'back':target.pitch?target.pitch<0?'up':'down':target.yaw?target.yaw<0?'left':'right':'front';
 return {status:busy?'saving':ready?'collecting':'turning',cue,target};
}
// Interaction timers only; neither changes quality or pose acceptance.
export function stallLevel(activeMs:number):'none'|'help'|'offer' {return activeMs>=30000?'offer':activeMs>=15000?'help':'none';}
