import type {QualityResult} from '../gates/quality';
import type {Shot} from '../session/shotlist';
import type {AnalysisResult} from '../analysis/protocol';
export function autoCaptureReady({shot,pose,quality,velocity,faceRatio,expression}:{shot:Shot;pose:AnalysisResult['pose'];quality:QualityResult;velocity:number;faceRatio:number;expression:number}):boolean {
 const near=pose&&Math.abs(pose.yaw-shot.yaw)<=7&&Math.abs(pose.pitch-shot.pitch)<=7;
 // Face size and neutral expression are scored soft targets, not extra hard gates.
 // The existing target window must still hold for 500 ms; JPEG grading checks blur.
 const turn=shot.stage<=2&&!shot.detail;
 return !quality.hardFailure&&quality.tier!=='D'&&!!near&&!shot.manual&&(turn||(velocity<8&&faceRatio>=.35&&expression>=.8));
}
