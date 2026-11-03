import {provisionalQuality,type Baseline,type Failure,type QualityResult} from '../gates/quality';
import type {BodyAnalysis} from './protocol';
import type {BodyMode} from './plan';
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export function gradeBody(m:BodyAnalysis,baseline:Baseline|null,mode:BodyMode,reviewed=false,relaxed=false):QualityResult {
    const metrics=m.metrics,b=m.bounds;
    let reason:Failure|null=null;
    if(!baseline||!metrics||![baseline.sharpness,baseline.exposure,metrics.sharpness,metrics.exposure,metrics.clipped,m.sourceDimensions.width,m.sourceDimensions.height].every(value=>typeof value==='number'&&Number.isFinite(value))||baseline.sharpness<=0||baseline.exposure<=0||metrics.exposure!<=0||metrics.sharpness!<0||metrics.clipped!<0||metrics.clipped!>1)reason='invalid';
    else if(m.detectedPoses!==1||!b||typeof m.targetArea!=='number'||!Number.isFinite(m.targetArea)||m.targetArea<=0||m.targetArea>1)reason='face';
    else if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0||b.x<0||b.y<=0||b.x+b.width>1||b.y+b.height>1||(mode==='full'&&b.y+b.height>=1))reason='framing';
    else if(Math.min(m.sourceDimensions.width,m.sourceDimensions.height)<1024)reason='resolution';
    else if(metrics.clipped!>.1)reason='light';
    else if(metrics.sharpness!/baseline.sharpness<provisionalQuality.unusableRatio)reason='focus';
    else if((mode==='full'?[11,12,23,24,27,28,31,32]:[11,12,23,24]).some(index=>{const p=m.landmarks[index];return !p||![p.x,p.y,p.visibility].every(v=>typeof v==='number'&&Number.isFinite(v))||p.x<0||p.x>1||p.y<0||p.y>1||p.visibility!<.5||(p.presence!==undefined&&(!Number.isFinite(p.presence)||p.presence<.5));}))reason='framing';
    if(reason)return {score:0,tier:'D',hardFailure:true,reason};
    // Provisional body mapping: existing focus/exposure rules, target framing, manual review.
    const softScale=relaxed?.8:1;
    const sharp=clamp(metrics!.sharpness!/baseline!.sharpness/(provisionalQuality.softSharpnessRatio*softScale));
    const exposure=clamp(1-Math.abs(Math.log2(Math.max(1,metrics!.exposure!)/baseline!.exposure))/2)*clamp(1-metrics!.clipped!);
    const framing=clamp(b!.height/((mode==='full'?.85:.7)*softScale));
    const raw=Math.round(35*sharp+20*exposure+25*framing+(reviewed?20:0)),score=reviewed?raw:Math.min(64,raw);
    return {score,tier:score>=80?'A':score>=65?'B':score>=50?'C':'D',hardFailure:false,reason:null,...(!reviewed?{unverified:'occlusion' as const}:{})};
}
