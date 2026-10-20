import { describe, expect, it } from 'vitest';
import { faceCrop, laplacianVariance, poseFromMatrix, rollingFps } from '../src/metrics';

describe('face sharpness', () => {
  it('has zero variance for a flat image and 16 for alternating unit pixels', () => {
    expect(laplacianVariance(new Uint8Array(16).fill(80), 4, 4)).toBe(0);
    expect(laplacianVariance(new Uint8Array([
      0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0,
    ]), 4, 4)).toBe(16);
  });
});

it('reports processed-frame throughput over real elapsed time, capped at ten seconds', () => {
  expect(rollingFps([100, 200, 300], 0, 1000)).toBe(3);
  expect(rollingFps([100, 200, 10001, 11000], 0, 11000)).toBe(.2);
  expect(rollingFps([], 100, 100)).toBe(0);
  expect(rollingFps([100, 200, 300], 0, 2000)).toBe(1.5);
});

describe('head angles from a column-major transformation matrix', () => {
  it('reads a known 30 degree yaw independently of scale and translation', () => {
    const pose = poseFromMatrix([
      1.7320508075688772, 0, -1, 0, 0, 2, 0, 0,
      1, 0, 1.7320508075688772, 0, 100, -50, 12, 1,
    ]);
    expect(pose.yaw).toBeCloseTo(30); expect(pose.pitch).toBeCloseTo(0); expect(pose.roll).toBeCloseTo(0);
  });
  it('reads simultaneous pitch 30, yaw 30 and roll 30', () => {
    const pose = poseFromMatrix([
      .75, .4330127018922193, -.5, 0,
      -.21650635094610965, .875, .4330127018922193, 0,
      .625, -.21650635094610965, .75, 0, 0, 0, 0, 1,
    ]);
    expect(pose.yaw).toBeCloseTo(30); expect(pose.pitch).toBeCloseTo(30); expect(pose.roll).toBeCloseTo(30);
  });
  it('handles a left profile at gimbal lock without NaN', () => {
    const pose = poseFromMatrix([0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1]);
    expect(pose.yaw).toBeCloseTo(-90); expect(pose.pitch).toBeCloseTo(0); expect(pose.roll).toBe(0);
  });
});

describe('face crop in native image coordinates', () => {
  it('clamps partly offscreen landmarks without stretching the crop', () => {
    expect(faceCrop([{ x: -.2, y: .25 }, { x: .5, y: 1.2 }], 100, 80))
      .toEqual({ x: 0, y: 20, width: 50, height: 60 });
    expect(faceCrop([{ x: .25, y: .25 }, { x: .75, y: .75 }], 200, 100))
      .toEqual({ x: 50, y: 25, width: 100, height: 50 });
    expect(faceCrop([], 100, 100)).toBeNull();
    expect(faceCrop([{ x: 2, y: 2 }, { x: 3, y: 3 }], 100, 100)).toBeNull();
    expect(faceCrop([{ x: NaN, y: 0 }], 100, 100)).toBeNull();
  });
});
