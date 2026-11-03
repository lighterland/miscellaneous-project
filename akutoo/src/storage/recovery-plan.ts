export class SessionConflict extends Error { constructor() { super('Session changed in another view'); this.name = 'SessionConflict'; } }
export function nextRevision(expected: number | undefined, current: number | undefined): number {
  if ((expected ?? 0) !== (current ?? 0)) throw new SessionConflict();
  return (current ?? 0) + 1;
}
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const managed = new RegExp(`^(sessions/${uuid}/(?:import-)?${uuid}\\.jpg|thumbs/${uuid}\\.jpg)$`, 'i');
export const managedPhotoPath = (path: string) => managed.test(path);
export function orphanPaths(files: string[], photos: { opfsPath: string; thumbPath?: string }[]): string[] {
  const referenced = new Set(photos.flatMap(photo => [photo.opfsPath, photo.thumbPath].filter((path): path is string => !!path)));
  return files.filter(path => managed.test(path) && !referenced.has(path));
}
