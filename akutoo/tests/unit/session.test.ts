import { describe, expect, it } from 'vitest';
import { shots } from '../../src/session/shotlist';
import { freshProgress, failSlot, advanceSlot, revisit, acceptSlot, calibrationSample, readyToCapture, startHold, upgradeProgress } from '../../src/session/progress';

describe('guided session progression', () => {
  it('provides all 13 yaw bins within 28 distinct shots in five ordered stages', () => {
    expect(shots).toHaveLength(28); expect(new Set(shots.map(shot => shot.id)).size).toBe(28);
    expect(shots.filter(shot => shot.stage === 1).map(shot => shot.yaw).sort((a,b) => a-b)).toEqual([-90,-75,-60,-45,-30,-15,0,15,30,45,60,75,90]);
    expect([...new Set(shots.map(shot => shot.stage))]).toEqual([1, 2, 3, 4, 5]);
  });
  it('preserves the current legacy instruction, photos and completed IDs when adding 75-degree shots', () => {
    const old = { ...freshProgress(0), shotlistVersion: undefined, index: 9, savedIds: ['existing-photo'], completed: ['turn-0'], missed: ['turn--30'] };
    const next = upgradeProgress(old);
    expect(shots[next.index].id).toBe('turn--90');
    expect(next.savedIds).toEqual(old.savedIds); expect(next.completed).toEqual(old.completed);
    expect(next.missed).toEqual(['turn--30', 'turn--75', 'turn-75']);
    expect(upgradeProgress(next)).toBe(next);
  });
  it('keeps new shots reachable after a finished legacy scan or completed revisit', () => {
    const old = { ...freshProgress(0), shotlistVersion: undefined, index: 26 };
    const next = upgradeProgress(old);
    expect(next.index).toBe(28); expect(revisit(next).revisitQueue.map(index => shots[index].id)).toEqual(['turn--75','turn-75']);
    const afterRevisit = upgradeProgress({ ...old, revisiting: true });
    expect(afterRevisit.revisitQueue.map(index => shots[index].id)).toEqual(['turn--75','turn-75']);
    expect(shots[afterRevisit.index].id).toBe('turn--75');
    expect(upgradeProgress({ ...old, index: 2 }).missed).toEqual([]);
  });
  it('moves past a failed slot after three tries and offers only one revisit', () => {
    let p = freshProgress(0);
    for (let i = 0; i < 3; i++) p = failSlot(p, 'light', i * 1000);
    expect(p.attempts.sessionFix).toBe('light'); expect(p.attempts.moveOn).toBe(true);
    p = advanceSlot(p, 'failed'); expect(p.index).toBe(1);
    p = { ...p, index: shots.length }; p = revisit(p);
    expect(p.index).toBe(0); expect(p.revisiting).toBe(true);
    p = advanceSlot(p, 'skipped');
    expect(revisit(p).index).toBe(shots.length);
  });
  it('commits completion only when the caller has saved a photo', () => {
    const p = freshProgress(0); expect(p.completed).toEqual([]);
    expect(acceptSlot(p, 'photo-1').completed).toEqual([shots[0].id]);
    expect(acceptSlot(p, 'photo-1').index).toBe(1);
  });
  it('a successful save clears a failure streak and its fix card', () => {
    let p = freshProgress(0);
    for (let i = 0; i < 3; i++) p = failSlot(p, 'light', i);
    expect(acceptSlot(p, 'saved').attempts.sessionFix).toBeNull();
    expect(acceptSlot(p, 'saved').attempts.consecutive).toBe(0);
  });
  it('requires a five-second valid calibration window', () => {
    let state = { began: null as number | null, values: [] as { sharpness: number; exposure: number }[] };
    state = calibrationSample(state, 1000, { sharpness: 100, exposure: 100 });
    state = calibrationSample(state, 5999, { sharpness: 110, exposure: 120 });
    expect(state.values).toHaveLength(2);
    state = calibrationSample(state, 6000, null); expect(state.began).toBeNull();
  });
  it('requires stable ready time and a post-capture cooldown', () => {
    expect(startHold(null, true, 1000)).toBe(1000);
    expect(readyToCapture(1000, 1499, 0)).toBe(false);
    expect(readyToCapture(1000, 1500, 0)).toBe(true);
    expect(readyToCapture(1000, 1500, 1000)).toBe(false);
    expect(startHold(1000, false, 1500)).toBeNull();
  });
});
