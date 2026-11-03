import type { Photo } from '../storage/db';

export interface FaceRatios { eyeSpan: number; faceWidth: number; }
type Point = { x: number; y: number };
type Connections = { start: number; end: number }[];
export function faceRatios(points: Point[], groups: { left: Connections; right: Connections; oval: Connections }, width: number, height: number): FaceRatios | null {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) return null;
  const group = (connections: Connections) => [...new Set(connections.flatMap(edge => [edge.start, edge.end]))].map(index => points[index]).map(point => point && ({ x: point.x * width, y: point.y * height }));
  const left = group(groups.left), right = group(groups.right), oval = group(groups.oval);
  if ([left, right, oval].some(list => list.length < 2 || list.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)))) return null;
  const center = (list: Point[]) => ({ x: list.reduce((sum, point) => sum + point.x, 0) / list.length, y: list.reduce((sum, point) => sum + point.y, 0) / list.length });
  const a = center(left), b = center(right), dx = b.x - a.x, dy = b.y - a.y, eyes = Math.hypot(dx, dy);
  let diameter = 0;
  for (const a of oval) for (const b of oval) diameter = Math.max(diameter, Math.hypot(a.x - b.x, a.y - b.y));
  if (!eyes || !diameter) return null;
  const projected = oval.map(point => (point.x * dx + point.y * dy) / eyes);
  return { eyeSpan: eyes / diameter, faceWidth: (Math.max(...projected) - Math.min(...projected)) / diameter };
}

// Provisional diagnostic only: never changes a photo's quality tier or hard floors.
export const consistencyDefaults = { referenceCount: 3, relativeDeviation: .2 } as const;
export const frontal = (photo: Pick<Photo, 'pose'>) => !!photo.pose && [photo.pose.yaw, photo.pose.pitch, photo.pose.roll].every(Number.isFinite) && Math.abs(photo.pose.yaw) <= 15 && Math.abs(photo.pose.pitch) <= 15;
const valid = (ratios: Photo['ratios']): ratios is FaceRatios => !!ratios && [ratios.eyeSpan, ratios.faceWidth].every(value => Number.isFinite(value) && value > 0);
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
export function consistency(photos: Photo[]) {
  const candidates = photos.filter(photo => !photo.override && photo.quality && !photo.quality.hardFailure && ['A','B','C'].includes(photo.quality.tier) && photo.measurements?.faceCount === 1);
  const references = candidates.filter(photo => photo.identityConfirmed && frontal(photo) && valid(photo.ratios));
  const reference: FaceRatios | null = references.length >= consistencyDefaults.referenceCount ? { eyeSpan: median(references.map(photo => photo.ratios!.eyeSpan)), faceWidth: median(references.map(photo => photo.ratios!.faceWidth)) } : null;
  const outliers: string[] = [], unknown: string[] = [], verified: string[] = [];
  for (const photo of candidates) {
    if (!photo.pose || ![photo.pose.yaw, photo.pose.pitch, photo.pose.roll].every(Number.isFinite) || (frontal(photo) && (!reference || !valid(photo.ratios)))) { unknown.push(photo.id); continue; }
    const outlier = frontal(photo) && reference && valid(photo.ratios) && (['eyeSpan','faceWidth'] as const).some(key => Math.abs(photo.ratios![key] / reference[key] - 1) > consistencyDefaults.relativeDeviation);
    if (outlier) outliers.push(photo.id);
    if (photo.identityConfirmed && (!outlier || photo.consistencyReviewed)) verified.push(photo.id);
  }
  return { reference, referenceCount: references.length, outliers, unresolved: outliers.filter(id => !photos.find(photo => photo.id === id)?.consistencyReviewed), unknown, verified, method: 'frontal-ratios-and-manual-review' as const, defaults: consistencyDefaults, provisional: true as const };
}
