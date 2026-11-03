import { describe, expect, it } from 'vitest';
import { evaluateQuality, selectBurst, calibrate, type Measurements } from '../../src/gates/quality';
import { poseBin, hashDistance, dHash, readiness } from '../../src/analysis/metrics';
import { initialAttempts, recordFailure, resetCause, nextSlot, elapsedAttempts } from '../../src/session/attempts';

const sample: Measurements = { faceCount: 1, occluded: false, occlusionVerified: true, headCutOff: false, sharpness: 100, clipped: 0.01, exposure: 120, faceRatio: 0.5, shortSide: 2160, angleError: 0, expressionMatch: 1 };
const baseline = { sharpness: 100, exposure: 120 };
describe('adaptive quality', () => {
  it('uses the detail face-size soft target without weakening hard floors', () => {
    const small = { ...sample, faceRatio: .35 };
    expect(evaluateQuality(small, baseline).score - evaluateQuality(small, baseline, false, .7).score).toBe(5);
    expect(evaluateQuality({ ...sample, shortSide: 1023 }, baseline, false, .7)).toMatchObject({ hardFailure: true, reason: 'resolution' });
  });
  it('calibrates a robust median, ignoring invalid samples', () => {
    expect(calibrate([sample, { ...sample, sharpness: 120 }, { ...sample, sharpness: 5000 }])).toEqual({ sharpness: 120, exposure: 120 });
    expect(calibrate([{ ...sample, faceCount: 0 }])).toBeNull();
  });
  it('grades good photos A and keeps soft failures usable', () => {
    expect(evaluateQuality(sample, baseline).tier).toBe('A');
    const result = evaluateQuality({ ...sample, faceRatio: .15, angleError: 20, expressionMatch: .3 }, baseline);
    expect(result.hardFailure).toBe(false);
    expect(['B', 'C']).toContain(result.tier);
  });
  it.each([
    [{ faceCount: 0 }, 'face'], [{ faceCount: 2 }, 'face'], [{ occluded: true }, 'occlusion'],
    [{ clipped: .101 }, 'light'], [{ shortSide: 1000 }, 'resolution'], [{ headCutOff: true }, 'framing'],
    [{ sharpness: 1 }, 'focus'], [{ sharpness: NaN }, 'invalid'],
  ])('rejects hard-floor failures %j', (patch, reason) => {
    expect(evaluateQuality({ ...sample, ...patch }, baseline)).toMatchObject({ tier: 'D', hardFailure: true, reason });
  });
  it('does not use an absolute luminance threshold', () => {
    const dark = evaluateQuality({ ...sample, exposure: 45 }, { ...baseline, exposure: 45 });
    const light = evaluateQuality({ ...sample, exposure: 190 }, { ...baseline, exposure: 190 });
    expect(dark.score).toBe(light.score);
  });
  it('does not recommend a photo whose occlusion was not checked', () => {
    expect(evaluateQuality({ ...sample, occlusionVerified: false }, baseline)).toMatchObject({ tier: 'C', unverified: 'occlusion' });
  });
  it('chooses the best usable frame and never rescues a hard failure', () => {
    const good = evaluateQuality(sample, baseline);
    const bad = evaluateQuality({ ...sample, faceCount: 0 }, baseline);
    expect(selectBurst([bad, good])).toBe(1);
    expect(selectBurst([bad])).toBeNull();
    expect(selectBurst([])).toBeNull();
  });
});
describe('pose, duplicates and readiness', () => {
  it('bins actual yaw and pitch including manual profiles', () => {
    expect(poseBin(33, 0)).toBe('yaw:30'); expect(poseBin(-88, 0)).toBe('yaw:-90');
    expect(poseBin(0, 18)).toBe('pitch:15'); expect(poseBin(0, -20)).toBe('pitch:-15');
  });
  it('computes 64-bit hashes with a real Hamming distance', () => {
    expect(hashDistance(dHash(new Uint8Array(72)), dHash(new Uint8Array(72)))).toBe(0);
    expect(hashDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(() => dHash(new Uint8Array(10))).toThrow();
  });
  it('does not label an empty dataset ready and bounds every component', () => {
    expect(readiness({ coverage: 0, quality: 0, variety: 0, consistency: 0 })).toBe(0);
    expect(readiness({ coverage: 1, quality: 1, variety: 1, consistency: 1 })).toBe(100);
    expect(readiness({ coverage: 5, quality: -1, variety: 1, consistency: 1 })).toBe(70);
  });
});
describe('bounded attempts', () => {
  it('emits at most ten actual retry prompts and suppresses further fix cards', () => {
    let state = initialAttempts(0), emitted = 0;
    for (let slot = 0; slot < 100; slot++) {
      state = nextSlot(resetCause(state));
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = emitted; state = recordFailure(state, 'focus', slot * 1000);
        if (state.promptRetake) emitted++;
        if (before >= 10) expect(state.sessionFix).toBeNull();
      }
    }
    expect(emitted).toBe(10); expect(state.relaxed).toBe(true);
  });
  it('offers finishing after twenty minutes without requiring a failure', () => {
    expect(elapsedAttempts(initialAttempts(100), 1_200_099).offerFinish).toBe(false);
    expect(elapsedAttempts(initialAttempts(100), 1_200_100).offerFinish).toBe(true);
  });
  it('offers a Session fix after three matching causes, with recovery', () => {
    let state = initialAttempts(0);
    for (let i = 0; i < 3; i++) state = recordFailure(state, 'light', i * 1000);
    expect(state.sessionFix).toBe('light'); expect(state.moveOn).toBe(true);
    expect(resetCause(state).sessionFix).toBeNull();
  });
  it('caps attempts and session prompts under arbitrarily long failure sequences', () => {
    let state = initialAttempts(0);
    for (let slot = 0; slot < 50; slot++) {
      state = nextSlot(state);
      for (let attempt = 0; attempt < 30; attempt++) {
        state = recordFailure(state, attempt % 2 ? 'focus' : 'light', slot * 30000);
        expect(state.slotAttempts).toBeLessThanOrEqual(3);
        expect(state.prompts).toBeLessThanOrEqual(10);
      }
    }
    expect(state.relaxed).toBe(true); expect(state.offerFinish).toBe(true);
  });
});
