import { describe, expect, it } from 'vitest';
import { laplacianVariance, poseFromMatrix, faceCrop } from '../../src/analysis/image-metrics';
describe('image metrics', () => {
  it('returns zero for a flat crop, positive variance for edges', () => {
    expect(laplacianVariance(new Uint8Array(25).fill(80), 5, 5)).toBe(0);
    const edge = new Uint8Array(25); edge[12] = 255;
    expect(laplacianVariance(edge, 5, 5)).toBeGreaterThan(0);
  });
  it('handles an identity pose and clamps face bounds', () => {
    expect(poseFromMatrix([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])).toEqual({ yaw: -0, pitch: 0, roll: 0 });
    expect(faceCrop([{ x: -.1, y: .2 }, { x: .5, y: 1.2 }], 100, 100)).toEqual({ x: 0, y: 20, width: 50, height: 80 });
  });
});
