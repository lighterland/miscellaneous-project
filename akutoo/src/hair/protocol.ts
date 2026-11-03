import type { ColorCluster, ColorCast } from './color';
export interface HairAnalysis {
  targetArea:number|null; bounds:{x:number;y:number;width:number;height:number}|null;
  sharpness:number|null; exposure:number|null; brightClipped:number|null; clipped:number|null; swatch:string|null;
  personCount:null; occlusionVerified:false; sourceDimensions:{width:number;height:number}; durationMs:number|null;
  colorClusters?:ColorCluster[]; colorCast?:ColorCast;
}
export type HairRequest = {type:'load';id:number;base:string} | {type:'frame';id:number;bitmap:ImageBitmap};
export type HairResponse = {type:'ready';id:number;labels:string[]} | {type:'result';id:number;result:HairAnalysis} | {type:'error';id:number;error:string};
