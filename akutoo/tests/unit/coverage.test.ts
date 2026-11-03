import { expect, it } from 'vitest';
import { poseCoverage } from '../../src/session/coverage';
import type { Photo } from '../../src/storage/db';
const photo = (pose: Photo['pose'], extra: Partial<Photo> = {}): Photo => ({ id: 'p', sessionId: 's', opfsPath: 'p.jpg', width: 2048, height: 2048, createdAt: 1, pose, quality: { score: 60, tier: 'C', hardFailure: false, reason: null }, ...extra });
it('uses measured pose rather than requested pose or a stored bin label', () => {
  const result = poseCoverage([photo({ yaw: 2, pitch: 0, roll: 0 }, { requestedYaw: 90, binId: 'yaw:90' }), photo(null, { requestedYaw: -90 })]);
  expect(result.filled).toEqual(['yaw:0']);
  expect(result.unknown).toBe(1);
  expect(result.missing).toContain('yaw:90');
});
it('deduplicates bins and excludes overrides, failures and invalid measurements', () => {
  const result = poseCoverage([photo({ yaw: 31, pitch: 0, roll: 0 }), photo({ yaw: 32, pitch: 0, roll: 0 }), photo({ yaw: -90, pitch: 0, roll: 0 }, { override: true }), photo({ yaw: 90, pitch: 0, roll: 0 }, { quality: { score: 0, tier: 'D', hardFailure: true, reason: 'focus' } }), photo({ yaw: NaN, pitch: 0, roll: 0 })]);
  expect(result.filled).toEqual(['yaw:30']);
  expect(result.unknown).toBe(1);
  expect(result.bins).toHaveLength(15);
});
it('includes measured up and down poses and never fills an empty dataset', () => {
  expect(poseCoverage([]).filled).toEqual([]);
  expect(poseCoverage([photo({ yaw: 0, pitch: -16, roll: 0 }), photo({ yaw: 0, pitch: 16, roll: 0 })]).filled).toEqual(['pitch:-15', 'pitch:15']);
});
