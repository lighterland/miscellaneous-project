import { expect, it } from 'vitest';
import { expressionMatch } from '../../src/analysis/expressions';
it('matches PRD blendshape starting rules', () => {
  expect(expressionMatch({ mouthSmileLeft: .8, mouthSmileRight: .8, jawOpen: .05 }, 'closed-smile')).toBe(1);
  expect(expressionMatch({ mouthSmileLeft: .8, mouthSmileRight: .8, jawOpen: .2 }, 'toothy-smile')).toBe(1);
  expect(expressionMatch({ mouthSmileLeft: .8, mouthSmileRight: .8, jawOpen: .5 }, 'laugh')).toBe(1);
  expect(expressionMatch({ browInnerUp: .7, jawOpen: .5 }, 'surprise')).toBe(1);
  expect(expressionMatch({ mouthSmileLeft: .8, mouthSmileRight: .1 }, 'smirk')).toBe(1);
  expect(expressionMatch({ mouthSmileLeft: .1, mouthSmileRight: .1, jawOpen: .05 }, 'neutral')).toBe(.9);
});
