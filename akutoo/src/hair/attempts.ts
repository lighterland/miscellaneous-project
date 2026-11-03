import type { HairSet } from './state';
import {targetAttemptState,revisitTarget} from '../session/target-attempts';

export function hairAttemptState(set: HairSet, id: string) {
    return targetAttemptState(set,id);
}

export function revisitHairShot(set: HairSet, id: string): HairSet {
    return revisitTarget(set,id);
}
