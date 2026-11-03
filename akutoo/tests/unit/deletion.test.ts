import { expect, it } from 'vitest';
import { deletionPaths, deletionJournal } from '../../src/storage/deletion-plan';
const id = '12345678-1234-4321-8765-123456789abc', session = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const full = `sessions/${session}/${id}.jpg`, thumb = `thumbs/${id}.jpg`;
it('scopes explicit deletion to recognizable Akutoo photos, including unlinked files and previous retry paths', () => {
  expect(deletionPaths([full, `sessions/${session}/import-${id}.jpg`, 'notes/keep.txt'], [{ opfsPath: full, thumbPath: thumb }], [thumb])).toEqual([full, `sessions/${session}/import-${id}.jpg`, thumb]);
});
it('resumes only a valid durable deletion intent, never an arbitrary setting value', () => {
  expect(deletionJournal({ version: 1, confirmed: true, createdAt: 1, paths: [full, thumb] })?.paths).toEqual([full, thumb]);
  expect(deletionJournal({ version: 1, confirmed: false, createdAt: 1, paths: [full] })).toBeNull();
  expect(deletionJournal({ version: 1, confirmed: true, createdAt: 1, paths: ['../outside.jpg'] })).toBeNull();
});
