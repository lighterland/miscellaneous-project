import type { Expression } from '../analysis/expressions';
import type { DetailShot } from '../hair/plan';
export interface Shot { id: string; stage: number; yaw: number; pitch: number; expression: Expression; manual: boolean; detail?: DetailShot; direction?: 'left' | 'right' | 'up' | 'down'; context?: 'side-light' | 'new-background' | 'new-outfit'; }
const shot = (id: string, stage: number, yaw = 0, pitch = 0, expression: Expression = 'neutral', manual = false): Shot => ({ id, stage, yaw, pitch, expression, manual });
export const shots: Shot[] = [
  ...[0,-15,-30,-45,15,30,45,-60,-75,-90,60,75,90].map(yaw => shot(`turn-${yaw}`, 1, yaw, 0, 'neutral', false)),
  shot('chin-up', 2, 0, -15), shot('chin-down', 2, 0, 15),
  ...(['neutral','closed-smile','toothy-smile','laugh','surprise','smirk'] as Expression[]).map(expression => shot(`expression-${expression}`, 3, 0, 0, expression)),
  ...(['left','right','up','down'] as const).map(direction => ({ ...shot(`gaze-${direction}`, 4, 0, 0, 'neutral', true), direction })),
  ...(['side-light','new-background','new-outfit'] as const).map(context => ({ ...shot(context, 5, 0, 0, 'neutral', true), context })),
];
