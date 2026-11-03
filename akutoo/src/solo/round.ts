export const angles = ['front','front-left','left','back-left','back','back-right','right','front-right'] as const;
export type Angle = typeof angles[number];
export type Assistance = 'stand' | 'helper' | 'handheld';
export type Pace = 'slow' | 'normal' | 'fast';
export type AngleResult = { status:'saved'; photoId:string } | { status:'failed'; reason:string } | { status:'rehearsed' };
export interface RoundOptions { assistance:Assistance; pace:Pace; rehearsal:boolean; }
export interface Round extends RoundOptions {
  phase:'countdown'|'turn'|'hold'|'capture'|'confirm'|'done'|'stopped';
  queue:Angle[]; cursor:number; angle:Angle|null; enteredAt:number; deadline:number; results:Partial<Record<Angle,AngleResult>>;
}
const durations = { slow:{turn:3500,hold:1500,confirm:1500}, normal:{turn:2500,hold:1000,confirm:1000}, fast:{turn:1500,hold:1000,confirm:500} };
export function rotation(previous:Angle|null,target:Angle):{direction:'left'|'right';degrees:number}{const delta=(angles.indexOf(target)-angles.indexOf(previous??'front')+8)%8;return delta<=4?{direction:'left',degrees:delta*45}:{direction:'right',degrees:(8-delta)*45};}
function turnDuration(state:Round):number {const move=rotation(state.cursor?state.queue[state.cursor-1]:null,state.angle!);return durations[state.pace].turn*Math.max(1,move.degrees/45);}
export function permittedAngles(assistance:Assistance):Angle[] { return assistance === 'handheld' ? ['front'] : [...angles]; }
function start(options:RoundOptions, queue:Angle[], results:Round['results'], now:number):Round {
  if (!Number.isFinite(now)) throw new Error('Invalid clock');
  return { ...options, queue, cursor:0, angle:queue[0] ?? null, enteredAt:now, deadline:now+10000, phase:queue.length ? 'countdown' : 'done', results:{...results} };
}
export function beginRound(options:RoundOptions, now:number):Round { return start(options,permittedAngles(options.assistance),{},now); }
function enter(state:Round, phase:Round['phase'], now:number, duration:number):Round { return { ...state, phase, enteredAt:now, deadline:now+duration }; }
// Advance one phase only. A delayed timer cannot skip a hold or silently award
// a photo; the capture phase waits for a real capture result from its caller.
export function advanceRound(state:Round, now:number):Round {
  if (!Number.isFinite(now) || now < state.deadline || ['done','stopped'].includes(state.phase)) return state;
  const pace = durations[state.pace];
  if (state.phase === 'countdown') return enter(state,'turn',now,turnDuration(state));
  if (state.phase === 'turn') return enter(state,'hold',now,pace.hold);
  if (state.phase === 'hold') return enter(state,'capture',now,state.rehearsal ? 500 : Infinity);
  if (state.phase === 'capture') return state.rehearsal ? finishAngle(state,{status:'rehearsed'},now) : state;
  const cursor = state.cursor+1, angle = state.queue[cursor] ?? null;
  const next={...state,cursor,angle};return enter(next,angle ? 'turn' : 'done',now,angle ? turnDuration(next) : 0);
}
export function finishAngle(state:Round, result:AngleResult, now:number):Round {
  if (state.phase !== 'capture' || !state.angle || !Number.isFinite(now) || now < state.enteredAt || (state.rehearsal !== (result.status === 'rehearsed')) || (result.status === 'saved' && !result.photoId.trim()) || (result.status === 'failed' && !result.reason.trim())) throw new Error('Invalid capture outcome');
  return enter({ ...state,results:{ ...state.results,[state.angle]:{...result} } },'confirm',now,durations[state.pace].confirm);
}
export function stopRound(state:Round):Round { return state.phase === 'done' ? state : { ...state,phase:'stopped' }; }
export function redoRound(state:Round, now:number):Round {
  const queue = permittedAngles(state.assistance).filter(angle => state.results[angle]?.status !== 'saved');
  return start({assistance:state.assistance,pace:state.pace,rehearsal:state.rehearsal},queue,state.results,now);
}
