import type { Measurements } from '../gates/quality';
import type { FaceRatios } from './consistency';
import type { NormalizedRegion, TargetEvidence } from './region';
export interface AnalysisResult {
  measurements: Measurements; pose: { yaw: number; pitch: number; roll: number } | null;
  blendshapes: Record<string, number>; hash: string | null; durationMs: number;
  occlusionVerified: false;
  ratios?: FaceRatios | null;
  target?: TargetEvidence;
}
export type AnalysisRequest = { id: number; type: 'load'; base: string } | { id: number; type: 'frame'; bitmap: ImageBitmap; time: number; still: boolean; target?: NormalizedRegion };
export type AnalysisResponse = { id: number; type: 'ready' } | { id: number; type: 'result'; result: AnalysisResult } | { id: number; type: 'error'; error: string };
