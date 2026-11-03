import { db } from './db';
import { storageLock } from './lock';
import { listPhotoFiles, removeLocalFile } from './opfs';
import { deletionJournal, deletionPaths, type DeletionJournal } from './deletion-plan';
const key = 'pending-deletion';
export async function deletionPending(): Promise<boolean> { return !!await db.settings.get(key); }
async function finish(journal: DeletionJournal): Promise<void> {
  for (const path of journal.paths) {
    try { await removeLocalFile(path); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
  }
  await db.settings.delete(key);
}
export async function resumeDeletion(): Promise<boolean> {
  return storageLock(async () => {
    const pending = await db.settings.get(key); if (!pending) return false;
    const journal = deletionJournal(pending.value); if (!journal) throw new Error('Invalid deletion intent');
    await finish(journal); return true;
  });
}
export async function deleteAllData(confirmed: boolean): Promise<void> {
  if (!confirmed) throw new Error('Deletion requires confirmation');
  return storageLock(async () => {
    const previous = deletionJournal((await db.settings.get(key))?.value);
    const journal: DeletionJournal = { version: 1, confirmed: true, createdAt: Date.now(), paths: deletionPaths(await listPhotoFiles(), await db.photos.toArray(), previous?.paths) };
    // Persist the user's deletion intent atomically with clearing metadata. A
    // process interruption can then resume only these explicitly selected paths.
    await db.transaction('rw', db.sessions, db.photos, db.settings, async () => {
      await db.sessions.clear(); await db.photos.clear(); await db.settings.clear(); await db.settings.put({ key, value: journal });
    });
    await finish(journal);
  });
}
