import { expect, it } from 'vitest';
import { preferStill, type CaptureCandidate } from '../../src/capture/still-selection';
const frame: CaptureCandidate = { width: 2160, height: 3840, sharpness: 100, quality: { tier: 'C', score: 70, hardFailure: false, reason: null } };
it('uses extra sensor pixels only when measured quality and sharpness do not regress', () => {
  expect(preferStill(frame, { ...frame, width: 3000, height: 4000 })).toBe(true);
  expect(preferStill(frame, { ...frame, width: 3000, height: 4000, sharpness: 99 })).toBe(false);
  expect(preferStill(frame, { ...frame, width: 3000, height: 4000, quality: { ...frame.quality, score: 69 } })).toBe(false);
  expect(preferStill(frame, { ...frame })).toBe(false);
});
it('does not replace usable burst evidence with a failed or unmeasured sensor image', () => {
  expect(preferStill(frame, { ...frame, sharpness: NaN })).toBe(false);
  expect(preferStill(frame, { ...frame, width: 0 })).toBe(false);
  expect(preferStill(frame, { ...frame, sharpness: 200, quality: { tier:'D', score:80, hardFailure:true, reason:'face' } })).toBe(false);
});
it('allows a passing sensor image to rescue a failed burst, without changing its gates', () => {
  expect(preferStill({ ...frame, sharpness:0, quality:{tier:'D',score:0,hardFailure:true,reason:'focus'} }, frame)).toBe(true);
});
