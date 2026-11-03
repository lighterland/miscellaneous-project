export type PersistenceStatus = 'unsupported' | 'unknown' | 'best-effort' | 'persistent';
type StoragePolicy = { persisted?: () => Promise<boolean>; persist?: () => Promise<boolean> };
export async function persistenceStatus(storage: StoragePolicy = navigator.storage ?? {}): Promise<PersistenceStatus> {
  if (!storage.persisted) return 'unsupported';
  try { return await storage.persisted() ? 'persistent' : 'best-effort'; } catch { return 'unknown'; }
}
export async function requestPersistence(storage: StoragePolicy = navigator.storage ?? {}): Promise<PersistenceStatus> {
  if (!storage.persist) return 'unsupported';
  try { return await storage.persist() ? 'persistent' : 'best-effort'; } catch { return 'unknown'; }
}
