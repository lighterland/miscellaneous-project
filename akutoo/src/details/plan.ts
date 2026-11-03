import { detailShots, type DetailShot } from '../hair/plan';
import type { Shot } from '../session/shotlist';
import type { AnalysisResult } from '../analysis/protocol';
import type { NormalizedRegion } from '../analysis/region';
import type { Session } from '../storage/db';
import { shots } from '../session/shotlist';
import { freshProgress, type Progress } from '../session/progress';
import type { Baseline } from '../gates/quality';
import type { Attempts } from '../session/attempts';

export interface DetailSession { active: boolean; marks: boolean; beard: boolean; progress: Progress; baseline?: Baseline; }
export function detailPlan(options: { marks?: boolean; beard?: boolean } = {}): Shot[] {
  return detailShots(options).map(detail => ({ id: detail.id, stage: 6, yaw: 0, pitch: 0, expression: detail.variant === 'teeth' ? 'toothy-smile' : 'neutral', manual: true, detail }));
}
export function detailGuide(detail: DetailShot): NormalizedRegion {
  // Symmetric, unmirrored source coordinates. The user aligns the named target;
  // this rectangle does not claim anatomical localization.
  return detail.region === 'face' ? { x: .15, y: .1, width: .7, height: .8 }
    : { x: .2, y: .3, width: .6, height: .4 };
}
export function detailMeasurements(result: AnalysisResult) {
  return result.target?.metrics ? { ...result.measurements, ...result.target.metrics, clipped: Math.max(result.measurements.clipped, result.target.metrics.clipped) } : null;
}
export function capturePlan(session: Session): Shot[] { return session.details?.active ? detailPlan(session.details) : shots; }
export function captureProgress(session: Session): Progress { return session.details?.active ? session.details.progress : session.progress!; }
export function beginDetails(session: Session, options: { marks: boolean; beard: boolean }): Session {
  const prior = session.details;
  return syncDetailBudget({ ...session, retakePhotoId: undefined, retakeShotId: undefined, details: { active: true, ...options, progress: prior?.progress ?? freshProgress(Date.now()) } });
}
export function syncDetailBudget(session: Session): Session {
  if (!session.progress || !session.details) return session;
  const face = session.progress.attempts, detail = session.details.progress.attempts;
  const merge = (local: Attempts, other: Attempts): Attempts => {
    const exhaustedElsewhere = other.prompts > local.prompts && other.prompts >= 10;
    return { ...local, startedAt: Math.min(local.startedAt, other.startedAt), prompts: Math.max(local.prompts, other.prompts), relaxed: local.relaxed || other.relaxed, offerFinish: local.offerFinish || other.offerFinish,
      ...(exhaustedElsewhere ? { promptRetake: false, sessionFix: null } : {}) };
  };
  return { ...session, progress: { ...session.progress, attempts: merge(face, detail) }, details: { ...session.details, progress: { ...session.details.progress, attempts: merge(detail, face) } } };
}
