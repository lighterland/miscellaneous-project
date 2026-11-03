import type { BodyPoint } from './metrics';
import type { NormalizedRegion } from '../analysis/region';
export interface BodyAnalysis {
    detectedPoses:number|null;
    landmarks:BodyPoint[];
    bounds:NormalizedRegion|null;
    targetArea:number|null;
    metrics:{sharpness:number|null;exposure:number|null;clipped:number|null}|null;
    sourceDimensions:{width:number;height:number};durationMs:number|null;
    model:'pose-landmarker-lite-v1'|null;
}
export type BodyRequest={type:'load';id:number;base:string}|{type:'frame';id:number;bitmap:ImageBitmap};
export type BodyResponse={type:'ready';id:number}|{type:'result';id:number;result:BodyAnalysis}|{type:'error';id:number;error:string};
