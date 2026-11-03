export interface ColorCluster { hex: string; fraction: number; }
export interface ColorCast {
    status: 'possible-cast' | 'no-cast-indicated' | 'unmeasured';
    method: 'background-gray-world'; samples: number;
    channelMeans: [number, number, number] | null;
}
function validate(rgba: Uint8ClampedArray, mask: ArrayLike<number>) {
    if (rgba.length !== mask.length * 4) throw new Error('Invalid color mask');
}
function luminance(rgb: number[]) { return .299 * rgb[0] + .587 * rgb[1] + .114 * rgb[2]; }
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
/** Bounded RGB grouping, not a classifier of highlights, gray hair or illumination. */
export function colorClusters(rgba: Uint8ClampedArray, mask: ArrayLike<number>): ColorCluster[] {
    validate(rgba, mask);
    const bins = new Map<string, { count: number; sum: number[] }>();
    let total = 0;
    for (let i = 0; i < mask.length; i++) {
        if (mask[i] !== 1) continue;
        const rgb = Array.from(rgba.subarray(i * 4, i * 4 + 3)), light = luminance(rgb);
        if (light <= 5 || light >= 250) continue;
        const key = rgb.map(v => Math.floor(v / 32)).join(',');
        const bin = bins.get(key) ?? { count: 0, sum: [0, 0, 0] };
        bin.count++; rgb.forEach((v, c) => bin.sum[c] += v); bins.set(key, bin); total++;
    }
    const groups: { count: number; sum: number[] }[] = [];
    for (const bin of [...bins.values()].sort((a, b) => b.count - a.count)) {
        const mean = bin.sum.map(v => v / bin.count);
        const closest = groups.map(group => ({group, gap: distance(mean, group.sum.map(v => v / group.count))})).sort((a,b)=>a.gap-b.gap)[0];
        if (closest && closest.gap <= 48) {
            closest.group.count += bin.count; bin.sum.forEach((v, c) => closest.group.sum[c] += v);
        } else groups.push({count:bin.count,sum:[...bin.sum]});
    }
    // Tiny groups are noise candidates; fractions retain the denominator of all usable target pixels.
    return groups.sort((a,b)=>b.count-a.count).filter(group=>group.count/total>=.05).slice(0,3).map(group=>({
        hex:'#'+group.sum.map(v=>Math.round(v/group.count).toString(16).padStart(2,'0')).join(''), fraction:group.count/total,
    }));
}
/** Gray-world background heuristic. A colored wall may trigger it; no warning does not prove neutral light. */
export function backgroundCast(rgba: Uint8ClampedArray, background: ArrayLike<number>): ColorCast {
    validate(rgba, background);
    const sums = [0,0,0]; let samples = 0;
    for(let i=0;i<background.length;i++) {
        if(background[i]!==1) continue;
        const rgb=Array.from(rgba.subarray(i*4,i*4+3)), light=luminance(rgb);
        if(light<32||light>223) continue;
        samples++; rgb.forEach((v,c)=>sums[c]+=v);
    }
    if(samples<128) return {status:'unmeasured',method:'background-gray-world',samples,channelMeans:null};
    const means=sums.map(value=>value/samples) as [number,number,number];
    return {status:Math.max(...means)>1.35*Math.min(...means)?'possible-cast':'no-cast-indicated',method:'background-gray-world',samples,channelMeans:means};
}
