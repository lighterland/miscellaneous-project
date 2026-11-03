import { expect, it } from 'vitest';
import { planImport } from '../../src/import/planner';
import type { AnalysisResult } from '../../src/analysis/protocol';
import type { Photo } from '../../src/storage/db';
const result = (yaw: number, extra: Partial<AnalysisResult['measurements']> = {}): AnalysisResult => ({ measurements: { faceCount: 1, occluded: false, occlusionVerified: false, headCutOff: false, sharpness: 100, clipped: .01, exposure: 120, faceRatio: .5, shortSide: 2048, angleError: 0, expressionMatch: 1, ...extra }, pose: { yaw, pitch: 0, roll: 0 }, blendshapes: { mouthSmileLeft: 0, mouthSmileRight: 0, jawOpen: 0 }, hash: '0000000000000000', durationMs: 5, occlusionVerified: false });
const referenceBatch = () => [0,15,30].map((yaw, index) => ({ id: `reference-${index}`, result: result(yaw) }));
it('requires the ownership declaration and does not self-calibrate one photo as a pass', () => {
  expect(() => planImport(referenceBatch(), [], false)).toThrow('ownership');
  const plan = planImport([{ id: 'single', result: result(0) }], [], true);
  expect(plan.baseline).toBeNull(); expect(plan.decisions[0]).toMatchObject({ accepted: false, reason: 'reference' });
});
it('uses the same relative focus, face and resolution floors with explicit rejection reasons', () => {
  const plan = planImport([...referenceBatch(), { id: 'blur', result: result(45, { sharpness: .5 }) }, { id: 'two', result: result(60, { faceCount: 2 }) }, { id: 'small', result: result(-15, { shortSide: 800 }) }], [], true);
  expect(plan.decisions.filter(item => item.accepted)).toHaveLength(3);
  expect(plan.decisions.find(item => item.id === 'blur')?.reason).toBe('focus');
  expect(plan.decisions.find(item => item.id === 'two')?.reason).toBe('face');
  expect(plan.decisions.find(item => item.id === 'small')?.reason).toBe('resolution');
  expect(plan.decisions[0].quality?.tier).toBe('C');
  expect(plan.decisions[0].measurements).toMatchObject({ expressionMatch: 1, occlusionVerified: false });
});
it('fills actual gaps, chooses the sharper duplicate and never assigns a missing pose', () => {
  const existing: Photo = { id: 'existing', sessionId: 's', opfsPath: 'p.jpg', width: 2048, height: 2048, createdAt: 1, pose: { yaw: 0, pitch: 0, roll: 0 }, expression: 'neutral', measurements: result(0).measurements, quality: { score: 64, tier: 'C', hardFailure: false, reason: null } };
  const plan = planImport([...referenceBatch(), { id: 'sharper', result: result(15, { sharpness: 120 }) }, { id: 'unknown', result: { ...result(45), pose: null } }, { id: 'broken', result: null, error: 'unreadable' as const }], [existing], true);
  expect(plan.decisions.find(item => item.id === 'reference-0')?.reason).toBe('duplicate');
  expect(plan.decisions.find(item => item.id === 'reference-1')?.reason).toBe('duplicate');
  expect(plan.decisions.find(item => item.id === 'sharper')).toMatchObject({ accepted: true, binId: 'yaw:15', expression: 'neutral' });
  expect(plan.decisions.find(item => item.id === 'unknown')).toMatchObject({ accepted: false, reason: 'pose', binId: null });
  expect(plan.decisions.find(item => item.id === 'broken')?.reason).toBe('unreadable');
});
