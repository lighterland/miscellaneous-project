import type { Baseline, QualityResult, Failure } from '../gates/quality';
import { provisionalQuality } from '../gates/quality';
import type { HairAnalysis } from './protocol';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
// Provisional domain mapping of the existing quality protocol. Confirmation is
// separate from model output: no synthetic person count is persisted as measured.
export function gradeHair(m: HairAnalysis, baseline: Baseline | null, kind: string, reviewed = false, visibleFaces: number | null = null, relaxed = false): QualityResult {
    let reason: Failure | null = null;
    const valid = baseline && [baseline.sharpness, baseline.exposure, m.targetArea, m.sharpness, m.exposure, m.brightClipped, m.clipped, m.sourceDimensions.width, m.sourceDimensions.height].every(value => typeof value === 'number' && Number.isFinite(value));
    if (typeof m.targetArea!=='number' || !valid || baseline!.sharpness <= 0 || baseline!.exposure <= 0 || m.targetArea < 0 || m.targetArea > 1 || m.clipped! < 0 || m.clipped! > 1 || m.brightClipped! < 0 || m.brightClipped! > 1 || m.exposure! <= 0)
        reason = 'invalid';
    else if (visibleFaces !== null && visibleFaces > 1)
        reason = 'face';
    else if (m.targetArea <= 0 || !m.bounds)
        reason = 'face';
    else if (Math.min(m.sourceDimensions.width, m.sourceDimensions.height) < 1024)
        reason = 'resolution';
    else if (m.clipped! > .1 || m.brightClipped! > .02)
        reason = 'light';
    else if (m.sharpness! / baseline!.sharpness < provisionalQuality.unusableRatio)
        reason = 'focus';
    if (reason)
        return { score: 0, tier: 'D', hardFailure: true, reason };
    const softScale=relaxed?.8:1;
    const sharpness = clamp(m.sharpness! / baseline!.sharpness / (provisionalQuality.softSharpnessRatio*softScale));
    const exposure = clamp(1 - Math.abs(Math.log2(Math.max(1, m.exposure!) / baseline!.exposure)) / 2) * clamp(1 - m.clipped!);
    const area = clamp(m.targetArea! / ((kind === 'texture' ? .6 : .3)*softScale));
    const raw = Math.round(35 * sharpness + 20 * exposure + 15 * area + 10 * clamp(1 - m.brightClipped! / .02) + (reviewed ? 20 : 0));
    const score = reviewed ? raw : Math.min(64, raw);
    return { score, tier: score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D', hardFailure: false, reason: null, ...(!reviewed ? { unverified: 'occlusion' as const } : {}) };
}
export function hairBaseline(values: {
    sharpness: number;
    exposure: number;
}[]): Baseline | null {
    const valid = values.filter(value => Number.isFinite(value.sharpness) && value.sharpness > 0 && Number.isFinite(value.exposure) && value.exposure > 0);
    if (!valid.length)
        return null;
    const median = (key: 'sharpness' | 'exposure') => { const ordered = valid.map(value => value[key]).sort((a, b) => a - b), middle = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2; };
    return { sharpness: median('sharpness'), exposure: median('exposure') };
}
