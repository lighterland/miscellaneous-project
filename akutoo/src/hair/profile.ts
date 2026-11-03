import { hairShots, type HairStyle } from './plan';
import type { HairSet } from './state';
export const patternSubtypes = { straight:['1A','1B','1C'], wavy:['2A','2B','2C'], curly:['3A','3B','3C'], coily:['4A','4B','4C'] } as const;
export type PatternFamily = keyof typeof patternSubtypes;
export interface HairPattern { family: PatternFamily; subtype?: string; source: 'user'; }
export function hairPattern(family: string, subtype = ''): HairPattern | null {
  if (family === '') return null;
  if (!Object.hasOwn(patternSubtypes,family) || (subtype && !(patternSubtypes[family as PatternFamily] as readonly string[]).includes(subtype))) throw new Error('Invalid hair pattern');
  return { family: family as PatternFamily, ...(subtype ? { subtype } : {}), source: 'user' };
}
export function hairCompletion(style: HairStyle, set: HairSet) {
  const required=hairShots(style).filter(shot=>!shot.optional);
  return { saved:required.filter(shot=>set.results[shot.id]?.status==='saved').length,required:required.length,
    optionalSaved:hairShots(style,true).filter(shot=>shot.optional&&set.results[shot.id]?.status==='saved').length };
}
