import { expect, it } from 'vitest';
import type { Photo } from '../../src/storage/db';
import { captureDecision, fulfilledShots, removeCapturedPhoto } from '../../src/capture/dedup';
import { freshProgress } from '../../src/session/progress';
const photo = (id: string, sharpness = 100, hash = '0000000000000000'): Photo => ({ id, sessionId: 'session', opfsPath: id, width: 2000, height: 3000, createdAt: 1, shotId: 'turn-0', pose: { yaw: 0, pitch: 0, roll: 0 }, hash, expression: 'neutral', quality: { tier: 'C', score: 60, hardFailure: false, reason: null }, measurements: { faceCount: 1, sharpness, expressionMatch: 1 } as Photo['measurements'] });
it('reuses a near duplicate without a retake, replacing only when strictly sharper', () => {
  expect(captureDecision(photo('new'), [photo('old')])).toEqual({ action: 'reuse', id: 'old' });
  expect(captureDecision(photo('new', 101), [photo('old')])).toEqual({ action: 'replace', id: 'old' });
  expect(captureDecision(photo('new', 99), [photo('old')])).toEqual({ action: 'reuse', id: 'old' });
});
it('keeps distinct samples until two and then replaces only the weakest sharper sample', () => {
  const first = photo('first', 100), second = photo('second', 80, 'ffffffffffffffff');
  const next = photo('new', 90, 'aaaaaaaaaaaaaaaa');
  expect(captureDecision(next, [first])).toEqual({ action: 'keep' });
  expect(captureDecision(next, [first, second])).toEqual({ action: 'replace', id: 'second' });
  expect(captureDecision({ ...next, measurements: { ...next.measurements!, sharpness: 80 } }, [first, second])).toEqual({ action: 'reuse', id: 'first' });
});
it('does not discard expressions, gaze or contexts merely because the pose matches', () => {
  const old = photo('old');
  for (const patch of [{ expression: 'laugh' }, { direction: 'left' }, { context: 'new-outfit' }, { pose: { yaw: 30, pitch: 0, roll: 0 } }]) expect(captureDecision({ ...photo('new'), ...patch }, [old])).toEqual({ action: 'keep' });
});
it('never treats unknown hash/pose or risky/failed photos as successful duplicate coverage', () => {
  const old = photo('old');
  for (const patch of [{ hash: null }, { pose: null }, { override: true }, { quality: { tier: 'D' as const, score: 0, hardFailure: true, reason: 'face' as const } }]) {
    expect(captureDecision({ ...photo('new'), ...patch }, [old])).toEqual({ action: 'keep' });
    expect(captureDecision(photo('new'), [{ ...old, ...patch }])).toEqual({ action: 'keep' });
  }
});
it('uses the exact PRD Hamming boundary and finite sharpness for replacement', () => {
  expect(captureDecision(photo('new', 200, '000000000000001f'), [photo('old')])).toEqual({ action: 'replace', id: 'old' });
  expect(captureDecision(photo('new', 200, '000000000000003f'), [photo('old')])).toEqual({ action: 'keep' });
  expect(captureDecision(photo('new', NaN), [photo('old')])).toEqual({ action: 'keep' });
});
it('preserves shared instruction fulfillment until its last supporting photo is removed', () => {
  const shared = { ...photo('shared'), fulfilledShotIds: ['turn-0', 'expression-neutral'] };
  expect(fulfilledShots(shared)).toEqual(['turn-0','expression-neutral']);
  const progress = { ...freshProgress(0), savedIds: ['shared','other'], completed: ['turn-0','expression-neutral'] };
  const next = removeCapturedPhoto(progress, shared, [photo('other')]);
  expect(next.savedIds).toEqual(['other']); expect(next.completed).toEqual(['turn-0']); expect(next.missed).toEqual(['expression-neutral']);
  expect(progress.completed).toEqual(['turn-0','expression-neutral']);
});

it('does not reuse legacy opposite-yaw evidence for the corrected pose convention',()=>{
 expect(captureDecision({...photo('new'),poseConvention:'subject-left-negative-v2'},[photo('old')])).toEqual({action:'keep'});
});
