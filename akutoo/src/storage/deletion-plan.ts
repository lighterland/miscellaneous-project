import { managedPhotoPath } from './recovery-plan';
export interface DeletionJournal { version: 1; confirmed: true; createdAt: number; paths: string[]; }
export function deletionPaths(files: string[], photos: { opfsPath: string; thumbPath?: string }[], pending: string[] = []): string[] {
  return [...new Set([...files, ...photos.flatMap(photo => [photo.opfsPath, photo.thumbPath].filter((path): path is string => !!path)), ...pending])].filter(managedPhotoPath);
}
export function deletionJournal(value: unknown): DeletionJournal | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<DeletionJournal>;
  return item.version === 1 && item.confirmed === true && typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) && Array.isArray(item.paths) && item.paths.every(path => typeof path === 'string' && managedPhotoPath(path)) ? item as DeletionJournal : null;
}
