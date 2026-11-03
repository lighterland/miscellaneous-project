import { expect, it } from 'vitest';
import { importedSession } from '../../src/import/progress';
import { freshProgress } from '../../src/session/progress';
import type { Session } from '../../src/storage/db';
it('adds import IDs without completing or advancing a guided shot', () => {
  const session: Session = { id: 's', createdAt: 1, updatedAt: 1, mode: 'face', preset: 'general', status: 'scanning', stage: 1, label: 'Face', progress: { ...freshProgress(0), index: 4, completed: ['turn-0'], savedIds: ['old'] } };
  const next = importedSession(session, ['new-a','new-b'], 2);
  expect(next.progress!.savedIds).toEqual(['old','new-a','new-b']);
  expect(next.progress!.index).toBe(4); expect(next.progress!.completed).toEqual(['turn-0']);
  expect(next.status).toBe('review'); expect(session.progress!.savedIds).toEqual(['old']);
});
