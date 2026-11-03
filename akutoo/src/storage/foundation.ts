import { db } from './db';
import { readLocalFile, removeLocalFile, writeLocalFile } from './opfs';
export async function checkLocalStorage(): Promise<void> {
  const path = `checks/${crypto.randomUUID()}.txt`;
  const marker = crypto.randomUUID();
  await writeLocalFile(path, new Blob([marker], { type: 'text/plain' }));
  try {
    if (await (await readLocalFile(path)).text() !== marker) throw new Error('Storage read-back failed');
    await db.settings.put({ key: 'foundationCheck', value: { passedAt: Date.now() } });
  } finally { await removeLocalFile(path); }
}
export async function storageAvailable(): Promise<boolean> {
  return !!(await db.settings.get('foundationCheck')) && !!navigator.storage?.getDirectory;
}
