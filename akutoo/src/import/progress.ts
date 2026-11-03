import type { Session } from '../storage/db';
import { freshProgress } from '../session/progress';
export function importedSession(session: Session, photoIds: string[], now: number): Session {
  const progress = session.progress ?? freshProgress(now);
  return { ...session, status: 'review', updatedAt: now, progress: { ...progress, savedIds: [...new Set([...progress.savedIds, ...photoIds])] } };
}
