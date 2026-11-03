import type { QualityResult } from '../gates/quality';
export interface CaptureCandidate { width: number; height: number; sharpness: number; quality: QualityResult; }
export function preferStill(burst: CaptureCandidate, still: CaptureCandidate): boolean {
  if (![still.width, still.height, still.sharpness, still.quality.score].every(Number.isFinite) || still.width <= 0 || still.height <= 0 || still.sharpness <= 0 || still.quality.hardFailure || still.quality.tier === 'D') return false;
  if (burst.quality.hardFailure || burst.quality.tier === 'D') return true;
  return still.quality.score >= burst.quality.score && still.sharpness >= burst.sharpness && (still.quality.score > burst.quality.score || still.sharpness > burst.sharpness || still.width * still.height > burst.width * burst.height);
}
