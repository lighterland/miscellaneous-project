import type {AnalysisResult} from '../analysis/protocol';
import type {Failure, QualityResult} from '../gates/quality';
import type {Shot} from '../session/shotlist';

export type PoseCue = Failure | 'left' | 'right' | 'up' | 'down' | 'closer' | 'expression' | 'steady' | 'ready' | 'tracking' | 'quality' | 'manual';
// Explain the existing controller requirements. This selector never accepts a photo.
export function poseGuidance(input: {shot:Shot;pose:AnalysisResult['pose'];quality:QualityResult;faceRatio:number;expression:number;velocity:number;ready:boolean}):PoseCue {
  const {shot,pose,quality,faceRatio,expression,velocity,ready}=input;
  if(shot.manual) return 'manual';
  if(quality.hardFailure) return quality.reason??'invalid';
  if(!pose || !Number.isFinite(pose.yaw) || !Number.isFinite(pose.pitch)) return 'tracking';
  if(faceRatio<.35) return 'closer';
  const yaw=shot.yaw-pose.yaw,pitch=shot.pitch-pose.pitch;
  if(Math.abs(yaw)>7) return yaw<0?'left':'right';
  if(Math.abs(pitch)>7) return pitch<0?'up':'down';
  if(expression<.8) return 'expression';
  if(quality.tier==='D') return 'quality';
  if(velocity>=8) return 'steady';
  return ready?'ready':'steady';
}
// Let a correction settle and leave enough time to hear the preceding cue.
export function speechDelay(now:number,lastSpoken:number):number { return Math.max(350,3500-(now-lastSpoken)); }
