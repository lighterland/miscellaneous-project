import { laplacianVariance } from './image-metrics';

export interface NormalizedRegion { x: number; y: number; width: number; height: number; }
export interface PixelRegion { x: number; y: number; width: number; height: number; }
export interface RegionMetrics { sharpness: number; exposure: number; clipped: number; }
export interface TargetEvidence {
  source: 'guide';
  // A guide says where to measure, not which anatomical feature is visible.
  visibilityVerified: false;
  bounds: PixelRegion | null;
  metrics: RegionMetrics | null;
  sourceDimensions: { width: number; height: number };
}

export function regionBounds(region: NormalizedRegion, width: number, height: number): PixelRegion | null {
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0)
    || ![region.x, region.y, region.width, region.height].every(Number.isFinite)
    || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0
    || region.x + region.width > 1 || region.y + region.height > 1) return null;
  // Decimal guide coordinates must not add a pixel solely through IEEE rounding.
  const snap = (value: number) => Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : value;
  const x = Math.floor(snap(region.x * width)), y = Math.floor(snap(region.y * height));
  const right = Math.ceil(snap((region.x + region.width) * width));
  const bottom = Math.ceil(snap((region.y + region.height) * height));
  return right - x >= 3 && bottom - y >= 3 ? { x, y, width: right - x, height: bottom - y } : null;
}

// Match the existing normalized face-crop measurement, on independently supplied
// target pixels. Callers must never borrow the whole-face score for this result.
export function regionMetrics(gray: ArrayLike<number>, width: number, height: number): RegionMetrics | null {
  if (![width, height].every(value => Number.isSafeInteger(value) && value >= 3) || gray.length !== width * height) return null;
  let exposure = 0, clipped = 0;
  for (let i = 0; i < gray.length; i++) {
    const value = gray[i];
    if (!Number.isFinite(value) || value < 0 || value > 255) return null;
    exposure += value;
    if (value <= 5 || value >= 250) clipped++;
  }
  return { sharpness: laplacianVariance(gray, width, height), exposure: exposure / gray.length, clipped: clipped / gray.length };
}
