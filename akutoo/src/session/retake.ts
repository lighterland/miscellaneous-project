import type { Photo } from '../storage/db';
import { poseBin } from '../analysis/metrics';
import { shots } from './shotlist';
export function suggestedRetake(photo: Pick<Photo, 'shotId' | 'pose' | 'expression'>): string | undefined {
  if (shots.some(shot => shot.id === photo.shotId)) return photo.shotId;
  const pose = photo.pose;
  if (!pose || ![pose.yaw, pose.pitch].every(Number.isFinite)) return;
  if (Math.abs(pose.yaw) <= 7 && Math.abs(pose.pitch) <= 7 && photo.expression && photo.expression !== 'neutral') {
    const expression = shots.find(shot => shot.stage === 3 && shot.expression === photo.expression); if (expression) return expression.id;
  }
  const bin = poseBin(pose.yaw, pose.pitch);
  return shots.find(shot => shot.stage <= 2 && poseBin(shot.yaw, shot.pitch) === bin)?.id;
}
