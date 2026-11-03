let localQueue: Promise<unknown> = Promise.resolve();
// The same-origin lock includes the entire OPFS-write / database-commit window.
export async function storageLock<T>(work: () => Promise<T>): Promise<T> {
  if (navigator.locks?.request) return await navigator.locks.request('akutoo-photo-files-v1', work);
  const next = localQueue.then(work, work); localQueue = next.catch(() => undefined); return next;
}
