import { db, type Photo, type Session } from './db';
import { storageLock } from './lock';
import { nextRevision, SessionConflict } from './recovery-plan';
import { writeLocalFile, removeLocalFile } from './opfs';
import { hairColorSuggestions } from '../hair/swatches';
export async function saveHairPhoto(session: Session, photo: Photo, full: Blob, thumb: Blob): Promise<{
    session: Session;
    saved: boolean;
}> {
    return storageLock(async () => {
        if (session.mode !== 'hair' || !session.hair || !photo.hair || photo.sessionId !== session.id || photo.opfsPath !== `sessions/${session.id}/${photo.id}.jpg` || photo.thumbPath !== `thumbs/${photo.id}.jpg` || await db.photos.get(photo.id))
            throw new Error('Invalid hair capture');
        const next = structuredClone(session), data = photo.hair, set = next.hair!.sets[data.style] ??= { results: {}, colors: {} };
        const prior = set.results[data.shotId], previous = prior?.status === 'saved' ? await db.photos.get(prior.photoId) : undefined;
        if (prior?.status === 'saved' && !previous)
            throw new SessionConflict();
        if (previous && (photo.quality?.hardFailure || photo.quality?.tier === 'D' || (data.analysis.sharpness ?? 0) <= (previous.hair?.analysis.sharpness ?? 0)))
            return { session, saved: false };
        const paths: string[] = [];
        try {
            paths.push(photo.opfsPath);
            await writeLocalFile(photo.opfsPath, full);
            paths.push(photo.thumbPath!);
            await writeLocalFile(photo.thumbPath!, thumb);
            set.results[data.shotId] = { status: 'saved', photoId: photo.id };
            if (!photo.override)
                set.colors = hairColorSuggestions(set.colors, data.region, data.analysis, photo.id);
            next.progress!.savedIds = [...next.progress!.savedIds.filter(id => id !== previous?.id), photo.id];
            next.updatedAt = Date.now();
            next.retakePhotoId = undefined;
            next.retakeShotId = undefined;
            await db.transaction('rw', db.sessions, db.photos, async () => { const current = await db.sessions.get(session.id); if (!current)
                throw new SessionConflict(); next.revision = nextRevision(session.revision, current.revision); await db.photos.add(structuredClone(photo)); if (previous)
                await db.photos.delete(previous.id); await db.sessions.put(next); });
            if (previous)
                await Promise.all([previous.opfsPath, previous.thumbPath].filter((path): path is string => !!path).map(path => removeLocalFile(path).catch(() => undefined)));
            return { session: next, saved: true };
        }
        catch (error) {
            await Promise.all(paths.map(path => removeLocalFile(path).catch(() => undefined)));
            throw error;
        }
    });
}
