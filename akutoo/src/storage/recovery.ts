import { db } from './db';
import { storageLock } from './lock';
import { readLocalFile, listPhotoFiles } from './opfs';
import { orphanPaths } from './recovery-plan';
export interface RecoveryReport { unlinked: number; missing: number; skipped: boolean; }
export async function recoverStorage(): Promise<RecoveryReport> {
  // Never delete against a cross-tab writer when the browser cannot coordinate it.
  if (!navigator.locks?.request || !navigator.storage?.getDirectory) return { unlinked: 0, missing: 0, skipped: true };
  return storageLock(async () => {
    const files = await listPhotoFiles();
    const photos = await db.photos.toArray(); let missing = 0;
    // Preserve metadata for missing files so recovery never disguises lost data.
    for (const photo of photos) {
      try { await readLocalFile(photo.opfsPath); }
      catch (error) { if (error instanceof DOMException && error.name === 'NotFoundError') missing++; else throw error; }
    }
    // Missing metadata is not proof of a failed save. Preserve every unmatched
    // file; only a caught writer failure may clean its own newly created paths.
    return { unlinked: orphanPaths(files, photos).length, missing, skipped: false };
  });
}
