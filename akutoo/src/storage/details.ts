import { db, type Photo, type Session } from './db';
import { storageLock } from './lock';
import { nextRevision, SessionConflict } from './recovery-plan';
import { writeLocalFile, removeLocalFile } from './opfs';
import { acceptSlot } from '../session/progress';
import { detailPlan } from '../details/plan';
export async function saveDetailCapture(session: Session, photo: Photo, full: Blob, thumb: Blob) {
  return storageLock(async () => {
    if (!session.details?.active || !photo.detail || photo.sessionId !== session.id || photo.opfsPath !== `sessions/${session.id}/${photo.id}.jpg` || photo.thumbPath !== `thumbs/${photo.id}.jpg` || await db.photos.get(photo.id)) throw new Error('Invalid detail capture');
    const next = structuredClone(session);
    const previous = session.retakePhotoId ? await db.photos.get(session.retakePhotoId) : undefined;
    if (session.retakePhotoId && (!previous?.detail || previous.sessionId !== session.id || previous.shotId !== photo.shotId)) throw new SessionConflict();
    if (previous && (photo.quality?.hardFailure || photo.quality?.tier === 'D' || (photo.measurements?.sharpness ?? 0) <= (previous.measurements?.sharpness ?? 0))) return { session: { ...session, retakePhotoId: undefined, retakeShotId: undefined }, saved: false, outcome: 'kept-retake' as const };
    const paths: string[] = [];
    try {
      paths.push(photo.opfsPath); await writeLocalFile(photo.opfsPath, full);
      paths.push(photo.thumbPath!); await writeLocalFile(photo.thumbPath!, thumb);
      const progress = next.details!.progress;
      next.details!.progress = previous ? { ...progress, savedIds: [...progress.savedIds.filter(id => id !== previous.id), photo.id] } : acceptSlot(progress, photo.id, detailPlan(next.details));
      next.details!.baseline = undefined;
      next.retakePhotoId = undefined; next.retakeShotId = undefined; next.updatedAt = Date.now();
      await db.transaction('rw', db.sessions, db.photos, async () => {
        const current = await db.sessions.get(session.id); if (!current) throw new SessionConflict();
        next.revision = nextRevision(session.revision, current.revision);
        await db.photos.add(structuredClone(photo)); if (previous) await db.photos.delete(previous.id); await db.sessions.put(next);
      });
      if (previous) await Promise.all([previous.opfsPath, previous.thumbPath].filter((path): path is string => !!path).map(path => removeLocalFile(path).catch(() => undefined)));
      return { session: next, saved: true, outcome: 'saved' as const };
    } catch (error) { await Promise.all(paths.map(path => removeLocalFile(path).catch(() => undefined))); throw error; }
  });
}
