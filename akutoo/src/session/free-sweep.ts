import {nextSlot,resetCause} from './attempts';
import type {Progress} from './progress';
import {shots} from './shotlist';
import type {AnalysisResult} from '../analysis/protocol';
export const sweepShots=shots.filter(shot=>shot.stage<=2);
export function sweepActive(p:Progress):boolean {return p.freeSweep===true&&!p.revisiting&&p.index<sweepShots.length;}
export function nextSweepIndex(p:Pick<Progress,'completed'|'missed'>):number {
 const next=sweepShots.findIndex(shot=>!p.completed.includes(shot.id)&&!p.missed.includes(shot.id));
 return next<0?sweepShots.length:next;
}
export function selectSweepShot(p:Progress,pose:AnalysisResult['pose']):number|null {
 if(!sweepActive(p)||!pose||![pose.yaw,pose.pitch,pose.roll].every(Number.isFinite))return null;
 const candidates=sweepShots.map((shot,index)=>({shot,index,error:Math.hypot(shot.yaw-pose.yaw,shot.pitch-pose.pitch)}))
 .filter(({shot})=>!p.completed.includes(shot.id)&&!p.missed.includes(shot.id)&&Math.abs(shot.yaw-pose.yaw)<=7&&Math.abs(shot.pitch-pose.pitch)<=7);
 const current=candidates.find(candidate=>candidate.index===p.index);
 return (current??candidates.sort((a,b)=>a.error-b.error)[0])?.index??null;
}
export function finishSweep(p:Progress):Progress {
 if(!sweepActive(p))return p;
 const missing=sweepShots.filter(shot=>!p.completed.includes(shot.id)).map(shot=>shot.id);
 return {...p,index:sweepShots.length,attempts:resetCause(nextSlot(p.attempts)),missed:[...new Set([...p.missed,...missing])],skipped:{...Object.fromEntries(missing.map(id=>[id,'later'])),...p.skipped}};
}

export function chooseTimedProfile(p:Progress,yaw:-90|90):Progress|null {
 if(!sweepActive(p)||p.attempts.moveOn||p.attempts.sessionFix)return null;
 const index=sweepShots.findIndex(shot=>shot.id===`turn-${yaw}`),id=sweepShots[index].id;
 if(p.completed.includes(id)||p.missed.includes(id))return null;
 const changed=index!==p.index,previous=sweepShots[p.index].id;
 const defer=changed&&p.attempts.slotAttempts>0;
 return {...p,index,missed:defer?[...new Set([...p.missed,previous])]:p.missed,
  skipped:defer?{...p.skipped,[previous]:p.skipped[previous]??'later'}:p.skipped,
  attempts:changed?resetCause(nextSlot(p.attempts)):p.attempts};
}
