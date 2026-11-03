import { describe, expect, it } from 'vitest';
import { regionBounds, regionMetrics } from '../../src/analysis/region';

describe('detail region evidence', () => {
  it('maps the unmirrored guide to native pixels without silently clipping it', () => {
    expect(regionBounds({ x: .25, y: .2, width: .5, height: .4 }, 1200, 2000))
      .toEqual({ x: 300, y: 400, width: 600, height: 800 });
    for (const box of [
      { x: -.01, y: 0, width: .5, height: .5 },
      { x: .8, y: .2, width: .3, height: .5 },
      { x: 0, y: 0, width: 0, height: .5 },
      { x: 0, y: NaN, width: .5, height: .5 },
    ]) expect(regionBounds(box, 1200, 2000)).toBeNull();
    expect(regionBounds({ x: 0, y: 0, width: 1, height: 1 }, Infinity, 2000)).toBeNull();
  });

  it('measures target pixels without substituting whole-face evidence', () => {
    const flat = new Float64Array(25).fill(100);
    expect(regionMetrics(flat, 5, 5)).toEqual({ sharpness: 0, exposure: 100, clipped: 0 });
    const detail = flat.slice(); detail[12] = 255;
    expect(regionMetrics(detail, 5, 5)?.sharpness).toBeGreaterThan(0);
    expect(regionMetrics(detail, 5, 5)?.clipped).toBe(1 / 25);
    expect(regionMetrics(detail, 5, 5)?.exposure).toBeCloseTo(106.2);
  });

  it('leaves invalid or insufficient pixels unmeasured, never a passing zero', () => {
    expect(regionMetrics(new Float64Array(4), 2, 2)).toBeNull();
    expect(regionMetrics([0, 1], 5, 5)).toBeNull();
    const invalid = new Float64Array(25).fill(100); invalid[0] = NaN;
    expect(regionMetrics(invalid, 5, 5)).toBeNull();
    invalid[0] = 300;
    expect(regionMetrics(invalid, 5, 5)).toBeNull();
  });
});
