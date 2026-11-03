import { shots } from './shotlist';
import { initialAttempts, nextSlot, recordFailure, resetCause, type Attempts, type Cause } from './attempts';
export interface Progress {
  shotlistVersion?: 2;
  index: number; completed: string[]; missed: string[]; revisiting: boolean; revisitQueue: number[];
  attempts: Attempts; savedIds: string[]; skipped: Record<string, string>;
}
export function freshProgress(now: number): Progress { return { shotlistVersion: 2, index: 0, completed: [], missed: [], revisiting: false, revisitQueue: [], attempts: initialAttempts(now), savedIds: [], skipped: {} }; }
// Legacy sessions stored ordinal indexes for the 26-shot plan. Preserve their
// current instruction and photo IDs; never silently award the two added bins.
export function upgradeProgress(p: Progress): Progress {
  if (p.shotlistVersion === 2) return p;
  const added = ['turn--75', 'turn-75'];
  const legacy = shots.filter(shot => !added.includes(shot.id));
  const mapped = (index: number) => { const id = legacy[index]?.id; return id ? shots.findIndex(shot => shot.id === id) : shots.length; };
  const needsAdded = p.index >= 9 || p.revisiting;
  const queue = p.revisitQueue.map(mapped).filter(index => index < shots.length);
  if (p.revisiting) queue.push(...added.map(id => shots.findIndex(shot => shot.id === id)));
  return { ...p, shotlistVersion: 2, index: p.revisiting ? queue[0] ?? shots.length : mapped(p.index), revisitQueue: queue,
    missed: needsAdded ? [...new Set([...p.missed, ...added])] : p.missed };
}
export function failSlot(p: Progress, cause: Cause, now: number): Progress { return { ...p, attempts: recordFailure(p.attempts, cause, now) }; }
export function advanceSlot(p: Progress, reason?: string, plan: readonly { id: string }[] = shots): Progress {
  const id = plan[p.index]?.id;
  const queue = p.revisiting ? p.revisitQueue.slice(1) : p.revisitQueue;
  return { ...p, index: p.revisiting ? queue[0] ?? plan.length : p.index + 1, revisitQueue: queue,
    missed: id && reason ? [...new Set([...p.missed, id])] : p.missed,
    skipped: id && reason ? { ...p.skipped, [id]: reason } : p.skipped, attempts: nextSlot(p.attempts) };
}
export function acceptSlot(p: Progress, photoId: string, plan: readonly { id: string }[] = shots): Progress {
  const id = plan[p.index]?.id;
  return advanceSlot({ ...p, completed: id ? [...new Set([...p.completed, id])] : p.completed, missed: p.missed.filter(value => value !== id), savedIds: [...p.savedIds, photoId], attempts: resetCause(p.attempts) }, undefined, plan);
}
export function revisit(p: Progress, plan: readonly { id: string }[] = shots): Progress {
  if (p.revisiting) return p;
  const queue = plan.map((shot, index) => p.missed.includes(shot.id) ? index : -1).filter(index => index >= 0);
  return { ...p, revisiting: true, revisitQueue: queue, index: queue[0] ?? plan.length, attempts: nextSlot(p.attempts) };
}
export interface CalibrationWindow { began: number | null; values: { sharpness: number; exposure: number }[]; }
export function calibrationSample(state: CalibrationWindow, now: number, value: { sharpness: number; exposure: number } | null): CalibrationWindow {
  if (!value || !Number.isFinite(value.sharpness) || value.sharpness <= 0 || value.exposure <= 0) return { began: null, values: [] };
  return { began: state.began ?? now, values: [...state.values, value].slice(-100) };
}
export const startHold = (since: number | null, ready: boolean, now: number): number | null => ready ? since ?? now : null;
export const readyToCapture = (since: number | null, now: number, lastCapture: number): boolean => since !== null && now - since >= 500 && now - lastCapture >= 600;
