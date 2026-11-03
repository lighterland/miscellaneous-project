import type {Assistance,Pace,AngleResult} from '../solo/round';
import type {Baseline} from '../gates/quality';
import type {BodyMode,BodyShot} from './plan';
import type {BodyAnalysis} from './protocol';
import type {BodyRatios} from './metrics';
export interface BodySet {results:Record<string,AngleResult>;attempts?:Record<string,number>;revisited?:Record<string,boolean>;baseline?:Baseline;}
export interface BodySession {
    mode:BodyMode;assistance:Assistance;pace:Pace;timer:3|5|10;details:boolean;heightCm:number|null;
    sets:Partial<Record<BodyMode,BodySet>>;
    corrections?:Partial<Record<'shoulderToHip'|'torsoToLeg'|'armToHeight'|'headToHeight'|'shoulderWidthCm',number>>;
    correctionsSource?:'user';
}
export interface BodyPhoto {mode:BodyMode;instruction:BodyShot;labelSource:'instruction';analysis:BodyAnalysis;baseline:Baseline|null;estimatedRatios:BodyRatios|null;heightCm:number|null;reviewed:boolean;}
export function freshBody():BodySession{return {mode:'full',assistance:'stand',pace:'normal',timer:10,details:false,heightCm:null,sets:{full:{results:{}}}};}
