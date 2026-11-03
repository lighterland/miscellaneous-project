import { db, type Photo, type Session } from './db';
import { importedSession } from '../import/progress';
import { writeLocalFile, removeLocalFile } from './opfs';
import { storageLock } from './lock';
export interface PreparedImport { photo: Photo; full: Blob; thumb: Blob; }
export async function saveImportedBatch(sessionId: string, source: AsyncIterable<PreparedImport>): Promise<Session> {
  return storageLock(async () => {
  const paths: string[] = [], photos: Photo[] = [], ids = new Set<string>();
  try {
    for await (const item of source) {
      const photo = item.photo;
      if (photo.sessionId !== sessionId || photo.source !== 'imported' || !photo.ownershipDeclared || photo.opfsPath !== `sessions/${sessionId}/import-${photo.id}.jpg` || photo.thumbPath !== `thumbs/${photo.id}.jpg` || ids.has(photo.id) || await db.photos.get(photo.id)) throw new Error('Invalid import destination');
      ids.add(photo.id);
      paths.push(photo.opfsPath); await writeLocalFile(photo.opfsPath, item.full);
      paths.push(photo.thumbPath); await writeLocalFile(photo.thumbPath, item.thumb);
      photos.push(photo);
    }
    if (!photos.length) throw new Error('No photos selected');
    const next = await db.transaction('rw', db.photos, db.sessions, async () => {
      const current = await db.sessions.get(sessionId); if (!current) throw new Error('Session missing');
      const session = { ...importedSession(current, photos.map(photo => photo.id), Date.now()), revision: (current.revision ?? 0) + 1 };
      await db.photos.bulkAdd(photos.map(photo => structuredClone(photo))); await db.sessions.put(structuredClone(session)); return session;
    });
    return next;
  } catch (error) { await Promise.all(paths.map(path => removeLocalFile(path).catch(() => undefined))); throw error; }
  });
}
