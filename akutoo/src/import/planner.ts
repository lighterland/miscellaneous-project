import type { Photo } from '../storage/db';
import type { AnalysisResult } from '../analysis/protocol';
import { expressionMatch, type Expression } from '../analysis/expressions';
import { poseBin } from '../analysis/metrics';
import { calibrate, evaluateQuality, type Baseline, type Failure, type QualityResult, type Measurements } from '../gates/quality';

export interface ImportCandidate { id: string; result: AnalysisResult | null; error?: 'unreadable' | 'analysis' | 'large'; }
export type ImportReason = Failure | 'reference' | 'duplicate' | 'pose' | 'unreadable' | 'analysis' | 'large';
export interface ImportDecision { id: string; accepted: boolean; reason: ImportReason | null; quality: QualityResult | null; measurements: Measurements | null; binId: string | null; expression?: Expression; }
const expressions: Expression[] = ['neutral','closed-smile','toothy-smile','laugh','surprise','smirk'];
function observedExpression(result: AnalysisResult) {
  if (!Object.keys(result.blendshapes).length) return undefined;
  const ranked = expressions.map(expression => ({ expression, score: expressionMatch(result.blendshapes, expression) })).sort((a, b) => b.score - a.score);
  return ranked[0].score >= .8 ? ranked[0] : undefined;
}
const measuredBin = (pose: Photo['pose']) => pose && [pose.yaw, pose.pitch, pose.roll].every(Number.isFinite) ? poseBin(pose.yaw, pose.pitch) : null;
const key = (bin: string, expression?: string) => JSON.stringify([bin, expression ?? null]);

// Batch calibration is provisional. Never borrow another camera's session baseline silently.
export function planImport(candidates: ImportCandidate[], existing: Photo[], ownershipConfirmed: boolean): { baseline: Baseline | null; decisions: ImportDecision[] } {
  if (!ownershipConfirmed) throw new Error('Confirm ownership before import');
  if (new Set(candidates.map(candidate => candidate.id)).size !== candidates.length) throw new Error('Import IDs must be unique');
  const samples = candidates.flatMap(candidate => candidate.result ? [candidate.result.measurements] : []).filter(m => m.faceCount === 1 && !m.occluded && !m.headCutOff && m.shortSide >= 1024 && m.clipped <= .1 && Number.isFinite(m.sharpness) && m.sharpness > 0 && Number.isFinite(m.exposure) && m.exposure > 0);
  const baseline = samples.length >= 3 ? calibrate(samples) : null;
  const decisions: ImportDecision[] = candidates.map(candidate => {
    const result = candidate.result;
    if (!result) return { id: candidate.id, accepted: false, reason: candidate.error ?? 'analysis', quality: null, measurements: null, binId: null };
    const observed = observedExpression(result), m = { ...result.measurements, angleError: 0, expressionMatch: observed?.score ?? 0, occlusionVerified: false };
    const fallback = { sharpness: m.sharpness > 0 ? m.sharpness : 1, exposure: m.exposure > 0 ? m.exposure : 1 };
    const quality = evaluateQuality(m, baseline ?? fallback), binId = measuredBin(result.pose);
    const reason: ImportReason | null = quality.hardFailure || quality.tier === 'D' ? quality.reason ?? 'invalid' : !baseline ? 'reference' : !binId ? 'pose' : null;
    return { id: candidate.id, accepted: reason === null, reason, quality, measurements: m, binId, expression: observed?.expression };
  });
  const occupied = new Set<string>(), filledBins = new Set<string>();
  for (const photo of existing) {
    const bin = measuredBin(photo.pose);
    if (!bin || photo.override || !photo.quality || photo.quality.hardFailure || photo.quality.tier === 'D') continue;
    filledBins.add(bin); occupied.add(key(bin, (photo.measurements?.expressionMatch ?? 0) >= .8 ? photo.expression : undefined));
  }
  // Keep the strongest candidate for each gap, while returning the original file order.
  const ranked = decisions.filter(decision => decision.accepted).sort((a, b) => b.quality!.score - a.quality!.score || (candidates.find(item => item.id === b.id)?.result?.measurements.sharpness ?? 0) - (candidates.find(item => item.id === a.id)?.result?.measurements.sharpness ?? 0));
  for (const decision of ranked) {
    if (occupied.has(key(decision.binId!, decision.expression)) || (!decision.expression && filledBins.has(decision.binId!))) { decision.accepted = false; decision.reason = 'duplicate'; }
    else { occupied.add(key(decision.binId!, decision.expression)); filledBins.add(decision.binId!); }
  }
  return { baseline, decisions };
}
