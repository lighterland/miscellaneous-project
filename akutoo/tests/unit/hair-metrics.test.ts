import { expect, it } from 'vitest';
import { maskedMetrics, maskedSwatch } from '../../src/hair/metrics';
it('keeps an empty target unmeasured instead of awarding zero-valued passing detail', () => {
  const m = maskedMetrics(new Float64Array(25).fill(100),new Uint8Array(25),5,5);
  expect(m.area).toBe(0); expect(m.bounds).toBeNull(); expect(m.sharpness).toBeNull(); expect(m.exposure).toBeNull();
});
it('does not count a segmentation-mask edge as texture sharpness', () => {
  const mask = new Uint8Array(49), gray = new Float64Array(49);
  for(let y=1;y<6;y++) for(let x=1;x<6;x++) { mask[y*7+x]=1; gray[y*7+x]=100; }
  const m = maskedMetrics(gray,mask,7,7); expect(m.sharpness).toBe(0); expect(m.exposure).toBe(100); expect(m.bounds).toEqual({x:1,y:1,width:5,height:5});
});
it('measures sharpness and highlight clipping only inside hair, not the background', () => {
  const mask = new Uint8Array(49), gray = new Float64Array(49).fill(255);
  for(let y=1;y<6;y++) for(let x=1;x<6;x++) { mask[y*7+x]=1; gray[y*7+x]=(x+y)%2 ? 100 : 140; }
  const m = maskedMetrics(gray,mask,7,7); expect(m.sharpness!).toBeGreaterThan(0); expect(m.brightClipped).toBe(0); expect(m.area).toBeCloseTo(25/49);
});
it('reports clipping ratios against target pixels and rejects malformed metrics input', () => {
  const gray = new Float64Array(25).fill(100), mask = new Uint8Array(25).fill(1); gray[0]=255; gray[1]=0;
  expect(maskedMetrics(gray,mask,5,5).brightClipped).toBe(1/25); expect(maskedMetrics(gray,mask,5,5).clipped).toBe(2/25);
  expect(() => maskedMetrics(gray,mask,6,5)).toThrow();
});
it('samples a local hair-only median swatch without naming anatomical roots or guessing texture', () => {
  const rgba = new Uint8ClampedArray([20,30,40,255, 200,210,220,255, 22,32,42,255]);
  expect(maskedSwatch(rgba,new Uint8Array([1,0,1]))).toBe('#151f29');
  expect(maskedSwatch(rgba,new Uint8Array(3))).toBeNull();
});
