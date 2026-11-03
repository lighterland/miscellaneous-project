import type { NormalizedRegion } from '../analysis/region';
export interface BodyPoint { x:number;y:number;z?:number;visibility?:number;presence?:number; }
export interface BodyRatios {
    source:'2d-landmarks';estimated:true;
    shoulderToHip:number|null;torsoToLeg:number|null;armToHeight:number|null;
    headToHeight:number|null;shoulderWidthCm:number|null;
}
function validBounds(bounds:NormalizedRegion|null):bounds is NormalizedRegion {
    return !!bounds&&[bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)&&bounds.x>=0&&bounds.y>=0&&bounds.width>0&&bounds.height>0&&bounds.x+bounds.width<=1&&bounds.y+bounds.height<=1;
}
/** Distance in image pixels. This is a perspective-sensitive estimate, not a physical measurement. */
export function bodyRatios(points:BodyPoint[],width:number,height:number,bounds:NormalizedRegion|null,heightCm:number|null):BodyRatios {
    const result:BodyRatios={source:'2d-landmarks',estimated:true,shoulderToHip:null,torsoToLeg:null,armToHeight:null,headToHeight:null,shoulderWidthCm:null};
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) return result;
    const point=(index:number)=>{const p=points[index];return p&&[p.x,p.y,p.visibility].every(v=>typeof v==='number'&&Number.isFinite(v))&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&p.visibility!>=.5&&(p.presence===undefined||Number.isFinite(p.presence)&&p.presence>=.5)?{x:p.x*width,y:p.y*height}:null;};
    const distance=(a:ReturnType<typeof point>,b:ReturnType<typeof point>)=>a&&b?Math.hypot(a.x-b.x,a.y-b.y):null;
    const midpoint=(a:ReturnType<typeof point>,b:ReturnType<typeof point>)=>a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:null;
    const shoulder=distance(point(11),point(12)),hip=distance(point(23),point(24));
    if(shoulder!==null&&hip!==null&&hip>0) result.shoulderToHip=shoulder/hip;
    const shoulderCenter=midpoint(point(11),point(12)),hipCenter=midpoint(point(23),point(24));
    const chain=(a:number,b:number,c:number)=>{const upper=distance(point(a),point(b)),lower=distance(point(b),point(c));return upper!==null&&lower!==null?upper+lower:null;};
    const torso=distance(shoulderCenter,hipCenter),leftLeg=chain(23,25,27),rightLeg=chain(24,26,28);
    if(torso!==null&&leftLeg!==null&&rightLeg!==null&&leftLeg+rightLeg>0) result.torsoToLeg=torso/((leftLeg+rightLeg)/2);
    const left=chain(11,13,15),right=chain(12,14,16);
    if(validBounds(bounds)) {
        const pixelHeight=bounds.height*height;
        if(left!==null&&right!==null) result.armToHeight=(left+right)/2/pixelHeight;
        if(shoulder!==null&&heightCm!==null&&Number.isFinite(heightCm)&&heightCm>0) result.shoulderWidthCm=shoulder/pixelHeight*heightCm;
    }
    // Pose Landmarker has neither crown nor chin landmarks; do not fabricate head height.
    return result;
}
export function bodyFraming(bounds:NormalizedRegion|null,mode:'half'|'full'='full',hipY?:number):'unmeasured'|'step-back'|'step-forward'|'ready' {
    if(!validBounds(bounds)) return bounds?'step-back':'unmeasured';
    const bottom=1-bounds.y-bounds.height;
    if(mode==='half'){
        if(hipY===undefined||!Number.isFinite(hipY))return 'unmeasured';
        if(bounds.y<.05||bounds.x<.03||1-bounds.x-bounds.width<.03||hipY>.95)return 'step-back';
        if(hipY<.7)return 'step-forward';return 'ready';
    }
    if(bounds.y<.05||bottom<.05||bounds.x<.03||1-bounds.x-bounds.width<.03) return 'step-back';
    if(bounds.y>.1&&bottom>.1) return 'step-forward';
    return 'ready';
}
