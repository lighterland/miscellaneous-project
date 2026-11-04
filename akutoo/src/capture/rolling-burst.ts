import {poseBin} from '../analysis/metrics';
import type {AnalysisResult} from '../analysis/protocol';
export function measuredTarget(target:{yaw:number;pitch:number},pose:AnalysisResult['pose']):boolean {
 return !!pose&&[pose.yaw,pose.pitch,pose.roll].every(Number.isFinite)&&Math.abs(target.yaw-pose.yaw)<=7&&Math.abs(target.pitch-pose.pitch)<=7&&poseBin(target.yaw,target.pitch)===poseBin(pose.yaw,pose.pitch);
}
export interface RankedFrame {index:number;score:number;sharpness:number;}
export interface FrameWindow<T> {best:T;count:number;}
// Retain one full-resolution frame, then finish on bin exit or five samples.
// Never request a later exposure after the head has moved past the target.
export function offerFrame<T extends RankedFrame>(window:FrameWindow<T>|null,frame:T|null):{window:FrameWindow<T>|null;ready:T|null;discard:T[]} {
 if(!frame)return {window:null,ready:window?.best??null,discard:[]};
 if(!window)return {window:{best:frame,count:1},ready:null,discard:[]};
 if(window.best.index!==frame.index)return {window:{best:frame,count:1},ready:window.best,discard:[]};
 const better=frame.score>window.best.score||(frame.score===window.best.score&&frame.sharpness>window.best.sharpness);
 const best=better?frame:window.best,discard=[better?window.best:frame],count=window.count+1;
 return count>=5?{window:null,ready:best,discard}:{window:{best,count},ready:null,discard};
}
