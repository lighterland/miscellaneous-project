import { poseBin } from '../analysis/metrics';
import type { Photo } from '../storage/db';

export const poseBins = [
  ...Array.from({ length: 13 }, (_, index) => `yaw:${index * 15 - 90}`),
  'pitch:-15', 'pitch:15',
] as const;

// Coverage records measured angles only. It does not certify identity or optical quality.
export function poseCoverage(photos: Photo[]) {
  const filled = new Set<string>();
  let unknown = 0;
  for (const photo of photos) {
    if (photo.detail || photo.override || !photo.quality || photo.quality.hardFailure || photo.quality.tier === 'D') continue;
    const pose = photo.pose;
    if (!pose || ![pose.yaw, pose.pitch, pose.roll].every(Number.isFinite)) { unknown++; continue; }
    filled.add(poseBin(pose.yaw, pose.pitch));
  }
  return { bins: [...poseBins], filled: poseBins.filter(bin => filled.has(bin)), missing: poseBins.filter(bin => !filled.has(bin)), unknown };
}
