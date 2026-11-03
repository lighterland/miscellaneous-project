import { expect, it } from 'vitest';
import { faceRatios, consistency } from '../../src/analysis/consistency';
import { datasetReadiness, importantBins } from '../../src/session/readiness';
import type { Photo } from '../../src/storage/db';
const measurements = { faceCount: 1, occluded: false, occlusionVerified: true, headCutOff: false, sharpness: 100, clipped: .01, exposure: 100, faceRatio: .5, shortSide: 2048, angleError: 0, expressionMatch: 1 };
let counter = 0;
const photo = (extra: Partial<Photo> = {}): Photo => ({ id: `p-${counter++}`, sessionId: 's', opfsPath: 'p.jpg', width: 2048, height: 2048, createdAt: 1, quality: { score: 90, tier: 'A', hardFailure: false, reason: null }, measurements, pose: { yaw: 0, pitch: 0, roll: 0 }, expression: 'neutral', hash: '0000000000000000', identityConfirmed: true, ratios: { eyeSpan: .3, faceWidth: .7 }, ...extra });
it('derives scale and roll invariant ratios from supplied landmark groups', () => {
  const groups = { left: [{ start: 0, end: 1 }], right: [{ start: 2, end: 3 }], oval: [{ start: 4, end: 5 }, { start: 6, end: 7 }] };
  const points = [{ x: -.2, y: 0 }, { x: -.2, y: .02 }, { x: .2, y: 0 }, { x: .2, y: .02 }, { x: -.4, y: 0 }, { x: .4, y: 0 }, { x: 0, y: -.6 }, { x: 0, y: .6 }];
  const a = faceRatios(points, groups, 1, 1)!;
  const rotated = points.map(p => ({ x: -p.y * 2 + 4, y: p.x * 2 + 3 }));
  expect(faceRatios(rotated, groups, 1, 1)!.eyeSpan).toBeCloseTo(a.eyeSpan);
  expect(faceRatios(rotated, groups, 1, 1)!.faceWidth).toBeCloseTo(a.faceWidth);
  expect(faceRatios([], groups, 1, 1)).toBeNull();
  expect(faceRatios(points, groups, 0, 1)).toBeNull();
});
it('flags a proportion outlier without mutating its quality or granting identity certainty', () => {
  const base = [photo(), photo(), photo()]; const odd = photo({ ratios: { eyeSpan: .6, faceWidth: .7 } });
  const report = consistency([...base, odd]);
  expect(report.unresolved).toEqual([odd.id]); expect(odd.quality!.tier).toBe('A');
  expect(consistency([...base, { ...odd, consistencyReviewed: true }]).unresolved).toEqual([]);
  expect(consistency([...base, { ...odd, consistencyReviewed: true }]).outliers).toEqual([odd.id]);
  expect(consistency([base[0]]).reference).toBeNull();
});
it('keeps missing ratios unknown and does not compare profile geometry with frontal geometry', () => {
  const base = [photo(), photo(), photo()]; const unknown = photo({ ratios: undefined });
  const profile = photo({ pose: { yaw: 90, pitch: 0, roll: 0 }, ratios: undefined });
  expect(consistency([...base, unknown, profile]).unknown).toEqual([unknown.id]);
  const invalid = photo({ pose: { yaw: NaN, pitch: 0, roll: 0 } });
  expect(consistency([...base, invalid]).unknown).toContain(invalid.id);
});
it('gives an empty or unmeasured dataset no Ready claim', () => {
  expect(datasetReadiness([])).toMatchObject({ score: 0, status: 'needs-work' });
  const report = datasetReadiness([photo({ ratios: undefined })]);
  expect(report.components.consistency).toBeNull(); expect(report.status).toBe('unmeasured');
  expect(report.missingImportant).toHaveLength(6);
});
it('uses actual important bins and discounts duplicate variety and unconfirmed contexts', () => {
  const base = [photo(), photo(), photo()];
  const requested = photo({ pose: null, requestedYaw: 90, context: 'side-light', contentConfirmed: false });
  const a = datasetReadiness([...base, requested]);
  expect(a.missingImportant).toContain('yaw:90'); expect(a.duplicateIds).toHaveLength(2);
  const b = datasetReadiness([...base, { ...requested, contentConfirmed: true }]);
  expect(b.components.variety!).toBeGreaterThan(a.components.variety!);
});
it('can reach Ready with real coverage, reviewed proportions and diverse measured expressions', () => {
  const angles = importantBins.map(bin => { const [axis, n] = bin.split(':'); return photo({ pose: { yaw: axis === 'yaw' ? Number(n) : 0, pitch: axis === 'pitch' ? Number(n) : 0, roll: 0 } }); });
  const expressions = ['neutral','closed-smile','toothy-smile','laugh','surprise','smirk'].map(expression => photo({ expression }));
  const contexts = ['side-light','new-background','new-outfit'].map(context => photo({ context, contentConfirmed: true }));
  const result = datasetReadiness([...angles, ...expressions, ...contexts]);
  expect(result.score).toBeGreaterThanOrEqual(80); expect(result.status).toBe('ready');
  expect(result.missingImportant).toEqual([]);
  expect(datasetReadiness([...angles, ...expressions, ...contexts, photo({ override: true, pose: null })]).score).toBe(result.score);
});
