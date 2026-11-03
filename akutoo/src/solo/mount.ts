export interface Orientation { tilt:number; roll:number; }
export interface MountState { measured:boolean; level:boolean; locked:boolean; since:number|null; reference:Orientation|null; lastAt:number; }
export function sampleMount(previous:MountState|null, value:Orientation|null, now:number, placement:'upright'|'top'):MountState {
  const measured = !!value && [value.tilt,value.roll,now].every(Number.isFinite);
  const level = measured && Math.abs(value!.roll) <= 2 && (placement === 'top' ? value!.tilt >= 20 && value!.tilt <= 30 : Math.abs(value!.tilt) <= 2);
  const consistent = measured && previous?.reference && Math.abs(previous.reference.tilt-value!.tilt) <= 2 && Math.abs(previous.reference.roll-value!.roll) <= 2 && now >= previous.lastAt;
  const since = level ? consistent && previous?.since !== null ? previous!.since : now : null;
  return { measured,level,locked:since !== null && now-since >= 2000,since,reference:level ? consistent ? previous!.reference : { ...value! } : null,lastAt:now };
}
