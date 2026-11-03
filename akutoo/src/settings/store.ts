import { db } from '../storage/db';
import { storageLock } from '../storage/lock';
import { preferences, type Preferences } from './preferences';
import { deletionPending } from '../storage/deletion';
export async function loadPreferences(): Promise<Preferences> { return preferences((await db.settings.get('preferences'))?.value); }
export async function savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  return storageLock(async () => {
    if (await deletionPending()) throw new Error('Deletion pending');
    const next = preferences({ ...await loadPreferences(), ...patch });
    await db.settings.put({ key: 'preferences', value: next }); return next;
  });
}
