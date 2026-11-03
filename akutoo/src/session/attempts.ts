export type Cause = 'light' | 'focus' | 'distance' | 'angle' | 'occlusion' | 'expression' | 'device';
export interface Attempts {
  startedAt: number; slotAttempts: number; prompts: number; consecutive: number; lastCause: Cause | null;
  sessionFix: Cause | null; moveOn: boolean; relaxed: boolean; offerFinish: boolean;
  promptRetake?: boolean;
}
export function initialAttempts(now: number): Attempts { return { startedAt: now, slotAttempts: 0, prompts: 0, consecutive: 0, lastCause: null, sessionFix: null, moveOn: false, relaxed: false, offerFinish: false, promptRetake: true }; }
export function elapsedAttempts(state: Attempts, now: number): Attempts { return state.offerFinish || now - state.startedAt < 1200000 ? state : { ...state, offerFinish: true }; }
export function recordFailure(state: Attempts, cause: Cause, now: number): Attempts {
  if (state.moveOn) return { ...elapsedAttempts(state, now), promptRetake: false };
  const slotAttempts = Math.min(3, state.slotAttempts + 1);
  const prompts = Math.min(10, state.prompts + 1);
  const consecutive = state.lastCause === cause ? state.consecutive + 1 : 1;
  const promptRetake = state.prompts < 10;
  return { ...state, slotAttempts, prompts, consecutive, lastCause: cause, promptRetake, sessionFix: promptRetake && consecutive >= 3 ? cause : null,
    moveOn: slotAttempts >= 3, relaxed: state.relaxed || prompts >= 10, offerFinish: state.offerFinish || now - state.startedAt >= 1200000 };
}
export function resetCause(state: Attempts): Attempts { return { ...state, consecutive: 0, lastCause: null, sessionFix: null }; }
export function nextSlot(state: Attempts): Attempts { return { ...state, slotAttempts: 0, moveOn: false, promptRetake: state.prompts < 10 }; }
