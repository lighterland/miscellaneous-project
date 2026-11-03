import { expect, it } from 'vitest';
import { reuseProgress, supportsShot } from '../../src/capture/dedup';
import { freshProgress } from '../../src/session/progress';
import { shots } from '../../src/session/shotlist';
import type { Photo } from '../../src/storage/db';
it('reuses a saved ID without inventing a new photo or another failed attempt', () => {
  const original = { ...freshProgress(0), savedIds: ['existing'] };
  const next = reuseProgress(original, 'existing');
  expect(next.index).toBe(1); expect(next.completed).toEqual(['turn-0']); expect(next.savedIds).toEqual(['existing']);
  expect(next.attempts.prompts).toBe(0); expect(next.attempts.slotAttempts).toBe(0); expect(original.completed).toEqual([]);
});
it('does not fulfill another requested angle, unknown expression or unverified context', () => {
  const photo: Photo = { id:'p',sessionId:'s',opfsPath:'p',width:2000,height:3000,createdAt:1,hash:'0000000000000000',pose:{yaw:0,pitch:0,roll:0},expression:'neutral',quality:{tier:'C',score:60,hardFailure:false,reason:null},measurements:{faceCount:1,sharpness:100,expressionMatch:1} as Photo['measurements'] };
  expect(supportsShot(photo, shots[0])).toBe(true);
  expect(supportsShot(photo, shots[1])).toBe(false);
  expect(supportsShot({ ...photo, measurements: { ...photo.measurements!, expressionMatch: 0 } }, shots[0])).toBe(false);
  expect(supportsShot(photo, shots.find(shot => shot.context === 'new-outfit')!)).toBe(false);
});
