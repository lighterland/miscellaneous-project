import { expect, it } from 'vitest';
import { angles, beginRound, advanceRound, finishAngle, stopRound, redoRound, permittedAngles, rotation, type Round } from '../../src/solo/round';
import { sampleMount } from '../../src/solo/mount';
it('uses the eight instruction labels in order, never inferred back-facing pose', () => {
  expect(angles).toEqual(['front','front-left','left','back-left','back','back-right','right','front-right']);
  expect(permittedAngles('stand')).toEqual(angles); expect(permittedAngles('helper')).toEqual(angles); expect(permittedAngles('handheld')).toEqual(['front']);
});
it('gives sparse redo angles a relative instruction and enough time for the requested turn',()=>{expect(rotation('back','back-right')).toEqual({direction:'left',degrees:45});expect(rotation(null,'front-right')).toEqual({direction:'right',degrees:45});let round=beginRound({assistance:'stand',pace:'normal',rehearsal:false},0);for(const angle of angles)if(angle!=='back'&&angle!=='front-right')round.results[angle]={status:'saved',photoId:angle};round=redoRound(round,0);round=advanceRound(round,round.deadline);expect(round.angle).toBe('back');expect(round.deadline-round.enteredAt).toBe(10000);});
function stepToCapture(state: Round) {
  while (state.phase !== 'capture' && state.phase !== 'done') state = advanceRound(state, state.deadline);
  return state;
}
it('waits ten seconds, gives turn/hold windows and never skips capture after a delayed timer', () => {
  let round = beginRound({ assistance:'stand', pace:'normal', rehearsal:false }, 100);
  expect(advanceRound(round, 10099)).toBe(round);
  round = advanceRound(round, 10100); expect(round.phase).toBe('turn'); expect(round.deadline).toBe(12600);
  round = advanceRound(round, 12600); expect(round.phase).toBe('hold'); expect(round.deadline).toBe(13600);
  round = advanceRound(round, 99999); expect(round.phase).toBe('capture');
  expect(advanceRound(round, 999999)).toBe(round); expect(round.results).toEqual({});
});
it('saves exactly eight ordered outcomes in a normal 40-second round after countdown', () => {
  let round = beginRound({ assistance:'stand', pace:'normal', rehearsal:false }, 0);
  let now = 10000;
  for (const angle of angles) {
    round = stepToCapture(round); expect(round.angle).toBe(angle);
    now = round.enteredAt + 500; round = finishAngle(round, { status:'saved', photoId:angle }, now);
    round = advanceRound(round, round.deadline);
  }
  expect(round.phase).toBe('done'); expect(round.enteredAt).toBe(50000); expect(Object.keys(round.results)).toEqual(angles);
});
it('rehearsal completes without accepting any saved photo or awarding real coverage', () => {
  let round = beginRound({ assistance:'stand', pace:'normal', rehearsal:true }, 0);
  round = stepToCapture(round); expect(() => finishAngle(round, { status:'saved', photoId:'bad' }, round.enteredAt+500)).toThrow();
  while (round.phase !== 'done') round = advanceRound(round, round.deadline);
  expect(Object.values(round.results).every(result => result.status === 'rehearsed')).toBe(true);
  expect(Object.values(round.results).some(result => 'photoId' in result)).toBe(false);
});
it('redo visits only failed or interrupted angles and preserves passing results', () => {
  let round = beginRound({ assistance:'stand', pace:'normal', rehearsal:false }, 0);
  round = stepToCapture(round); round = finishAngle(round, { status:'saved', photoId:'kept' }, round.enteredAt+500);
  round = stepToCapture(round); round = finishAngle(round, { status:'failed', reason:'focus' }, round.enteredAt+500);
  const stopped = stopRound(round); expect(advanceRound(stopped, 999999)).toBe(stopped);
  const redo = redoRound(stopped, 90000);
  expect(redo.queue).toEqual(angles.slice(1)); expect(redo.results.front).toEqual({status:'saved',photoId:'kept'});
  expect(redo.phase).toBe('countdown'); expect(redo.deadline).toBe(100000);
});
it('requires an actual result during capture and does not allow a blank success', () => {
  const round = beginRound({assistance:'helper',pace:'fast',rehearsal:false}, 0);
  expect(() => finishAngle(round,{status:'saved',photoId:'x'},0)).toThrow();
  expect(() => finishAngle(stepToCapture(round),{status:'saved',photoId:''},20000)).toThrow();
});
it('handheld mode never schedules side/back angles and speed changes only timing', () => {
  for (const pace of ['slow','normal','fast'] as const) {
    const round = beginRound({assistance:'handheld',pace,rehearsal:false},0); expect(round.queue).toEqual(['front']);
    expect(stepToCapture(round).phase).toBe('capture');
  }
});
it('mount stays unmeasured without orientation and locks only after two stable level seconds', () => {
  const unknown = sampleMount(null,null,0,'upright'); expect(unknown.locked).toBe(false); expect(unknown.measured).toBe(false);
  let state = sampleMount(null,{tilt:0,roll:0},100,'upright');
  state = sampleMount(state,{tilt:1,roll:1},2099,'upright'); expect(state.locked).toBe(false);
  state = sampleMount(state,{tilt:1,roll:1},2100,'upright'); expect(state.locked).toBe(true);
  expect(sampleMount(state,null,2150,'upright').locked).toBe(false);
  state = sampleMount(state,{tilt:8,roll:0},2200,'upright'); expect(state.locked).toBe(false);
});
it('top-head mounting uses 20–30 degree tilt and never considers missing/NaN orientation level', () => {
  expect(sampleMount(null,{tilt:25,roll:0},0,'top').level).toBe(true);
  expect(sampleMount(null,{tilt:0,roll:0},0,'top').level).toBe(false);
  expect(sampleMount(null,{tilt:NaN,roll:0},0,'upright').measured).toBe(false);
});
