import type { Assistance, Pace } from '../solo/round';
import type { Baseline } from '../gates/quality';
import type { HairStyle } from './plan';
import type { AngleResult } from '../solo/round';
import type { HairAnalysis } from './protocol';
import type { HairPattern } from './profile';
export interface HairSet {
    pattern?: HairPattern | null;
    includeLength?: boolean;
    results: Record<string, AngleResult>;
    attempts?: Record<string, number>;
    revisited?: Record<string, boolean>;
    baseline?: Baseline;
    colors: Record<string, {
        hex: string;
        confirmed: boolean;
        sourcePhotoId?: string;
        name?: string;
        nameSource?: 'user';
        role?: 'base' | 'highlight' | 'gray';
        roleSource?: 'user';
        fraction?: number;
        sampleRegion?: string;
    }>;
}
export interface HairSession {
    assistance: Assistance;
    pace: Pace;
    style: HairStyle;
    sets: Partial<Record<HairStyle, HairSet>>;
}
export interface HairPhoto {
    style: HairStyle;
    shotId: string;
    kind: string;
    region: string;
    angle?: string;
    labelSource: 'instruction';
    analysis: HairAnalysis;
    baseline: Baseline | null;
    visibleFaces: number | null;
    reviewed: boolean;
}
export function freshHair(): HairSession { return { assistance: 'stand', pace: 'normal', style: 'down', sets: { down: { results: {}, colors: {} } } }; }
