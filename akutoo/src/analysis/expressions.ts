export type Expression = 'neutral' | 'closed-smile' | 'toothy-smile' | 'laugh' | 'surprise' | 'smirk';
export function expressionMatch(values: Record<string, number>, target: Expression): number {
  const score = (key: string) => Math.max(0, Math.min(1, values[key] ?? 0));
  const left = score('mouthSmileLeft'), right = score('mouthSmileRight');
  const smile = (left + right) / 2, jaw = score('jawOpen'), brow = score('browInnerUp');
  if (target === 'neutral') return 1 - Math.max(smile, jaw, brow);
  if (target === 'closed-smile') return smile > .4 && jaw < .1 ? 1 : Math.min(smile / .4, Math.max(0, 1 - jaw));
  if (target === 'toothy-smile') return smile > .5 && jaw >= .1 && jaw <= .3 ? 1 : 0;
  if (target === 'laugh') return smile > .5 && jaw > .3 ? 1 : 0;
  if (target === 'surprise') return brow > .5 && jaw > .3 ? 1 : 0;
  return Math.min(1, Math.abs(left - right) / .3);
}
