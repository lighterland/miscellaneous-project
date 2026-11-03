export interface Measurements {
  faceCount: number; occluded: boolean; headCutOff: boolean; sharpness: number;
  clipped: number; exposure: number; faceRatio: number; shortSide: number;
  angleError: number; expressionMatch: number; occlusionVerified: boolean;
}
export interface Baseline { sharpness: number; exposure: number; }
export type Failure = 'invalid' | 'face' | 'occlusion' | 'light' | 'resolution' | 'framing' | 'focus';
export interface QualityResult { score: number; tier: 'A' | 'B' | 'C' | 'D'; hardFailure: boolean; reason: Failure | null; unverified?: 'occlusion'; }

// Engineering defaults, not device-calibrated thresholds. Keep the reference session-relative.
export const provisionalQuality = { unusableRatio: .1, softSharpnessRatio: .8, faceTarget: .35 } as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; }
export function calibrate(samples: Measurements[]): Baseline | null {
  const valid = samples.filter(sample => sample.faceCount === 1 && !sample.occluded && sample.sharpness > 0 && Number.isFinite(sample.sharpness) && sample.exposure > 0 && Number.isFinite(sample.exposure) && sample.clipped <= .1);
  return valid.length ? { sharpness: median(valid.map(sample => sample.sharpness)), exposure: median(valid.map(sample => sample.exposure)) } : null;
}
export function evaluateQuality(m: Measurements, baseline: Baseline, relaxed = false, faceTarget: number = provisionalQuality.faceTarget): QualityResult {
  let reason: Failure | null = null;
  const numeric = [m.faceCount, m.sharpness, m.clipped, m.exposure, m.faceRatio, m.shortSide, m.angleError, m.expressionMatch, baseline.sharpness, baseline.exposure];
  if (numeric.some(value => !Number.isFinite(value)) || baseline.sharpness <= 0 || baseline.exposure <= 0 || m.clipped < 0 || m.clipped > 1 || m.faceRatio < 0 || m.faceRatio > 1) reason = 'invalid';
  else if (m.faceCount !== 1) reason = 'face';
  else if (m.occluded) reason = 'occlusion';
  else if (m.headCutOff) reason = 'framing';
  else if (m.shortSide < 1024) reason = 'resolution';
  else if (m.clipped > .1) reason = 'light';
  else if (m.sharpness / baseline.sharpness < provisionalQuality.unusableRatio) reason = 'focus';
  if (reason) return { score: 0, tier: 'D', hardFailure: true, reason };
  const softScale = relaxed ? .8 : 1;
  const sharpness = clamp(m.sharpness / baseline.sharpness / (provisionalQuality.softSharpnessRatio * softScale));
  const exposure = clamp(1 - Math.abs(Math.log2(Math.max(1, m.exposure) / baseline.exposure)) / 2) * clamp(1 - m.clipped);
  const angle = clamp(1 - Math.abs(m.angleError) / (30 / softScale));
  const face = clamp(m.faceRatio / (faceTarget * softScale));
  const raw = Math.round(35 * sharpness + 20 * exposure + 15 * angle + 10 * face + (m.occlusionVerified === false ? 0 : 10) + 10 * clamp(m.expressionMatch));
  // Unknown occlusion must not silently become a verified A/B recommendation.
  const score = m.occlusionVerified === false ? Math.min(64, raw) : raw;
  return { score, tier: score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D', hardFailure: false, reason: null, ...(m.occlusionVerified === false ? { unverified: 'occlusion' as const } : {}) };
}
export function selectBurst(results: QualityResult[]): number | null {
  let best: number | null = null;
  results.forEach((result, index) => { if (!result.hardFailure && result.tier !== 'D' && (best === null || result.score > results[best].score)) best = index; });
  return best;
}
