import type { HairSet } from './state';
import type { HairAnalysis } from './protocol';
export function hairColorSuggestions(colors: HairSet['colors'], region: string, analysis: HairAnalysis, photoId: string): HairSet['colors'] {
    const next = { ...colors };
    for (const [key, color] of Object.entries(next)) if (color.sampleRegion === region || key === region) delete next[key];
    const candidates = analysis.colorClusters?.length ? analysis.colorClusters : analysis.swatch ? [{hex:analysis.swatch,fraction:undefined}] : [];
    candidates.slice(0,3).forEach((candidate,index)=>{
        if(!/^#[0-9a-f]{6}$/i.test(candidate.hex)) return;
        next[index ? `${region}-candidate-${index+1}` : region] = {hex:candidate.hex,confirmed:false,sourcePhotoId:photoId,sampleRegion:region,fraction:candidate.fraction};
    });
    return next;
}
