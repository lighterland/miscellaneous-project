import { expect, it } from 'vitest';
import { suggestedRetake } from '../../src/session/retake';
it('uses a known requested shot or a measured imported angle without inventing unknown pose', () => {
  expect(suggestedRetake({ shotId: 'gaze-left' })).toBe('gaze-left');
  expect(suggestedRetake({ pose: { yaw: -76, pitch: 0, roll: 0 }, expression: 'neutral' })).toBe('turn--75');
  expect(suggestedRetake({ pose: { yaw: 0, pitch: 16, roll: 0 } })).toBe('chin-down');
  expect(suggestedRetake({ pose: { yaw: 0, pitch: 0, roll: 0 }, expression: 'laugh' })).toBe('expression-laugh');
  expect(suggestedRetake({ pose: null })).toBeUndefined();
  expect(suggestedRetake({ pose: { yaw: NaN, pitch: 0, roll: 0 } })).toBeUndefined();
});
