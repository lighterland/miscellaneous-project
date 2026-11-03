import type { Photo } from '../storage/db';
import type { Progress } from '../session/progress';
import type { Shot } from '../session/shotlist';
import { acceptSlot } from '../session/progress';
import { hashDistance, poseBin } from '../analysis/metrics';
export type CaptureDecision = { action: 'keep' } | { action: 'replace' | 'reuse'; id: string };
function bin(photo: Photo): string | null {
  const pose = photo.pose;
  return pose && [pose.yaw, pose.pitch, pose.roll].every(Number.isFinite) ? poseBin(pose.yaw, pose.pitch) : null;
}
function eligible(photo: Photo): boolean {
  return !photo.override && !!photo.quality && !photo.quality.hardFailure && ['A','B','C'].includes(photo.quality.tier) && photo.measurements?.faceCount === 1 && Number.isFinite(photo.measurements.sharpness) && photo.measurements.sharpness > 0 && typeof photo.hash === 'string' && /^[0-9a-f]{16}$/i.test(photo.hash) && bin(photo) !== null;
}
function intent(photo: Photo): string {
  return JSON.stringify([bin(photo), (photo.measurements?.expressionMatch ?? 0) >= .8 ? photo.expression ?? null : null, photo.direction ?? null, photo.context ?? null]);
}
// Redundancy is scoped to pose plus expression/gaze/context so the guided
// variations are not erased by the frontal-pose cap. Unknown data earns no match.
export function captureDecision(incoming: Photo, existing: Photo[]): CaptureDecision {
  if (!eligible(incoming)) return { action: 'keep' };
  const same = existing.filter(photo => eligible(photo) && intent(photo) === intent(incoming));
  const near = same.filter(photo => hashDistance(photo.hash!, incoming.hash!) < 6).sort((a,b) => b.measurements!.sharpness - a.measurements!.sharpness);
  if (near.length) return { action: incoming.measurements!.sharpness > near[0].measurements!.sharpness ? 'replace' : 'reuse', id: near[0].id };
  if (same.length < 2) return { action: 'keep' };
  const ranked = [...same].sort((a,b) => a.measurements!.sharpness - b.measurements!.sharpness);
  return incoming.measurements!.sharpness > ranked[0].measurements!.sharpness ? { action: 'replace', id: ranked[0].id } : { action: 'reuse', id: ranked.at(-1)!.id };
}
export function supportsShot(photo: Photo, shot: Shot): boolean {
  return eligible(photo) && bin(photo) === poseBin(shot.yaw, shot.pitch) && photo.expression === shot.expression && (photo.measurements?.expressionMatch ?? 0) >= .8 && photo.direction === shot.direction && photo.context === shot.context;
}
export function fulfilledShots(photo: Photo): string[] { return [...new Set([photo.shotId, ...(photo.fulfilledShotIds ?? [])].filter((id): id is string => !!id))]; }
export function reuseProgress(progress: Progress, photoId: string): Progress {
  const next = acceptSlot(progress, photoId); return { ...next, savedIds: [...new Set(next.savedIds)] };
}
export function removeCapturedPhoto(progress: Progress, removed: Photo, remaining: Photo[]): Progress {
  const lost = fulfilledShots(removed).filter(id => !remaining.some(photo => fulfilledShots(photo).includes(id)));
  return { ...progress, savedIds: progress.savedIds.filter(id => id !== removed.id), completed: progress.completed.filter(id => !lost.includes(id)), missed: [...new Set([...progress.missed, ...lost])] };
}
