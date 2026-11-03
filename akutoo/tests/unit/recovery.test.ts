import { expect, it } from 'vitest';
import { nextRevision, orphanPaths, SessionConflict } from '../../src/storage/recovery-plan';

it('rejects a stale session rather than overwriting newer progress', () => {
  expect(nextRevision(undefined, undefined)).toBe(1);
  expect(nextRevision(3, 3)).toBe(4);
  expect(() => nextRevision(2, 3)).toThrow(SessionConflict);
});
it('identifies unlinked generated candidates separately from referenced or unknown files', () => {
  const id = '12345678-1234-4321-8765-123456789abc', session = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const full = `sessions/${session}/${id}.jpg`, thumb = `thumbs/${id}.jpg`, orphan = `sessions/${session}/import-${id}.jpg`;
  expect(orphanPaths([full,thumb,orphan,'sessions/notes.txt','thumbs/custom.jpg','checks/file.txt'], [{ opfsPath: full, thumbPath: thumb }])).toEqual([orphan]);
  expect(orphanPaths([full,thumb], [{ opfsPath: full, thumbPath: thumb }])).toEqual([]);
});
