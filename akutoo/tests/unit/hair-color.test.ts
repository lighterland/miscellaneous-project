import {expect,it} from 'vitest';
import {colorClusters,backgroundCast} from '../../src/hair/color';
function pixels(colors:number[][]) { return new Uint8ClampedArray(colors.flatMap(rgb=>[...rgb,255])); }
it('separates repeated hair colors without naming highlights or gray automatically',()=>{
    const values=pixels([...Array(60).fill([45,25,15]),...Array(30).fill([210,205,200]),...Array(10).fill([0,255,0])]);
    const mask=new Uint8Array(100).fill(1);mask.fill(0,90);
    const result=colorClusters(values,mask);
    expect(result).toHaveLength(2);expect(result[0].hex).toBe('#2d190f');expect(result[0].fraction).toBeCloseTo(2/3);
    expect(result[1].hex).toBe('#d2cdc8');expect(result[1].fraction).toBeCloseTo(1/3);
    expect(result.every(color=>!('role' in color))).toBe(true);
});
it('merges nearby shading and leaves absent or clipped target colors unmeasured',()=>{
    expect(colorClusters(pixels([[30,20,10],[35,25,15]]),new Uint8Array([1,1]))).toHaveLength(1);
    expect(colorClusters(pixels([[255,255,255]]),new Uint8Array([1]))).toEqual([]);
    expect(colorClusters(pixels([[30,20,10]]),new Uint8Array([0]))).toEqual([]);
    expect(()=>colorClusters(pixels([[30,20,10]]),new Uint8Array(2))).toThrow();
});
it('reports only a possible cast from sufficiently sampled background, never measured hair color truth',()=>{
    const mask=new Uint8Array(160).fill(1);
    expect(backgroundCast(pixels(Array(160).fill([120,120,120])),mask).status).toBe('no-cast-indicated');
    const cast=backgroundCast(pixels(Array(160).fill([80,100,180])),mask);
    expect(cast.status).toBe('possible-cast');expect(cast.method).toBe('background-gray-world');
    expect(backgroundCast(pixels(Array(160).fill([80,100,180])),new Uint8Array(160)).status).toBe('unmeasured');
    expect(backgroundCast(pixels([[80,100,180]]),new Uint8Array([1])).status).toBe('unmeasured');
});
