import { db, type Photo, type Session } from './db';
import { freshProgress, acceptSlot } from '../session/progress';
import { readLocalFile, writeLocalFile, removeLocalFile } from './opfs';
import { requestPersistence } from './persistence';
import { storageLock } from './lock';
import { nextRevision, SessionConflict } from './recovery-plan';
import { deletionPending } from './deletion';
import { captureDecision, fulfilledShots, removeCapturedPhoto, reuseProgress, supportsShot } from '../capture/dedup';
import { shots } from '../session/shotlist';
import { freshHair } from '../hair/state';
import {freshBody} from '../body/state';
export async function newSession(label: string,mode:Session['mode']='face'): Promise<Session> {
  return storageLock(async () => {
  if (await deletionPending()) throw new Error('Deletion pending');
  const now = Date.now();
  const session: Session = { id: crypto.randomUUID(), label, createdAt: now, updatedAt: now, mode, preset: 'general', status: 'setup', stage: 1, progress: freshProgress(now),...(mode==='hair'?{hair:freshHair()}:{}) };
  if(mode==='body')session.body=freshBody();
  await db.sessions.add(session); return session;
  });
}
export async function putSession(session: Session): Promise<void> {
  const revision = await db.transaction('rw', db.sessions, async () => {
    const current = await db.sessions.get(session.id); if (!current) throw new SessionConflict();
    const revision = nextRevision(session.revision, current.revision);
    await db.sessions.put(structuredClone({ ...session, revision })); return revision;
  });
  session.revision = revision;
}
export async function saveCapture(session: Session, photo: Photo, full: Blob, thumbnail: Blob): Promise<{ session: Session; saved: boolean; outcome: 'saved' | 'kept-retake' | 'reused' | 'discarded' }> {
  return storageLock(async () => {
  if (photo.sessionId !== session.id || photo.opfsPath !== `sessions/${session.id}/${photo.id}.jpg` || photo.thumbPath !== `thumbs/${photo.id}.jpg` || await db.photos.get(photo.id)) throw new Error('Invalid capture destination');
  let previous = session.retakePhotoId ? await db.photos.get(session.retakePhotoId) : undefined;
  const explicitRetake = !!session.retakePhotoId;
  if (session.retakePhotoId && !previous) throw new SessionConflict();
  if (previous && previous.sessionId !== session.id) throw new Error('Session mismatch');
  if (previous && (photo.quality?.tier === 'D' || photo.quality?.hardFailure || (photo.measurements?.sharpness ?? 0) <= (previous.measurements?.sharpness ?? 0))) {
    const next: Session = { ...session, retakePhotoId: undefined, retakeShotId: undefined, status: 'review' };
    await putSession(next); return { session: next, saved: false, outcome: 'kept-retake' };
  }
  if (!explicitRetake) {
    const existing = await db.photos.where('sessionId').equals(session.id).toArray();
    const decision = captureDecision(photo, existing);
    if (decision.action !== 'keep') {
      const matched = existing.find(item => item.id === decision.id)!;
      if (decision.action === 'reuse') {
        const target = shots[session.progress!.index];
        // A duplicate in another actual pose is not completion of this request.
        if (!target || !supportsShot(photo, target) || !supportsShot(matched, target)) return { session, saved: false, outcome: 'discarded' };
        const next: Session = { ...session, updatedAt: Date.now(), progress: reuseProgress(session.progress!, matched.id) };
        await db.transaction('rw', db.photos, db.sessions, async () => {
          const current = await db.sessions.get(session.id); if (!current) throw new SessionConflict();
          next.revision = nextRevision(session.revision, current.revision);
          await db.photos.update(matched.id, { fulfilledShotIds: [...new Set([...fulfilledShots(matched), target.id])] });
          await db.sessions.put(structuredClone(next));
        });
        return { session: next, saved: false, outcome: 'reused' };
      }
      previous = matched;
    }
  }
  if (previous) photo = { ...photo, fulfilledShotIds: [...new Set([...fulfilledShots(previous), ...fulfilledShots(photo)])] };
  const paths: string[] = [];
  try {
    paths.push(photo.opfsPath); await writeLocalFile(photo.opfsPath, full);
    if (photo.thumbPath) { paths.push(photo.thumbPath); await writeLocalFile(photo.thumbPath, thumbnail); }
    // Persist progress and metadata together only after both files are durable.
    const progress = explicitRetake ? { ...session.progress!, savedIds: session.progress!.savedIds.map(id => id === previous!.id ? photo.id : id) } : acceptSlot({ ...session.progress!, savedIds: session.progress!.savedIds.filter(id => id !== previous?.id) }, photo.id);
    const next: Session = { ...session, updatedAt: Date.now(), progress, retakePhotoId: undefined, retakeShotId: undefined, ...(explicitRetake ? { status: 'review' as const } : {}) };
    await db.transaction('rw', db.photos, db.sessions, async () => {
      const current = await db.sessions.get(session.id); if (!current) throw new SessionConflict();
      next.revision = nextRevision(session.revision, current.revision);
      await db.photos.add(structuredClone(photo)); if (previous) await db.photos.delete(previous.id); await db.sessions.put(structuredClone(next));
    });
    if (previous) await Promise.all([previous.opfsPath, previous.thumbPath].filter((path): path is string => !!path).map(path => removeLocalFile(path).catch(() => undefined)));
    void requestPersistence();
    return { session: next, saved: true, outcome: 'saved' };
  } catch (error) { await Promise.all(paths.map(path => removeLocalFile(path).catch(() => undefined))); throw error; }
  });
}
export async function loadPhoto(photo: Photo, thumbnail = false): Promise<File> { return readLocalFile(thumbnail && photo.thumbPath ? photo.thumbPath : photo.opfsPath); }
export async function deletePhoto(session: Session, photo: Photo): Promise<Session> {
  return storageLock(async () => {
  if (photo.sessionId !== session.id) throw new Error('Session mismatch');
  const remaining = await db.photos.where('sessionId').equals(session.id).toArray();
  const p = photo.detail ? undefined : session.progress;
  const next: Session = { ...session, updatedAt: Date.now(), ...(p ? { progress: removeCapturedPhoto(p, photo, remaining.filter(other => other.id !== photo.id)) } : {}) };
  if(photo.hair&&next.hair){next.hair=structuredClone(next.hair);const set=next.hair.sets[photo.hair.style];if(set?.results[photo.hair.shotId]?.status==='saved')set.results[photo.hair.shotId]={status:'failed',reason:'deleted'};if(set)for(const [region,color] of Object.entries(set.colors))if(color.sourcePhotoId===photo.id)set.colors[region]={...color,confirmed:false,sourcePhotoId:undefined};}
  if(photo.detail&&next.details)next.details={...next.details,progress:removeCapturedPhoto(next.details.progress,photo,remaining.filter(other=>other.id!==photo.id))};
  if(photo.body&&next.body){next.body=structuredClone(next.body);const set=next.body.sets[photo.body.mode];if(set?.results[photo.body.instruction.id]?.status==='saved')set.results[photo.body.instruction.id]={status:'failed',reason:'deleted'};}
  await db.transaction('rw', db.photos, db.sessions, async () => {
    const current = await db.sessions.get(session.id); if (!current) throw new SessionConflict();
    next.revision = nextRevision(session.revision, current.revision);
    await db.photos.delete(photo.id); await db.sessions.put(structuredClone(next));
  });
  await Promise.all([photo.opfsPath, photo.thumbPath].filter((path): path is string => !!path).map(path => removeLocalFile(path).catch(() => undefined)));
  return next;
  });
}
