import Dexie, { type EntityTable } from 'dexie';
import type { Progress } from '../session/progress';
import type { Baseline, QualityResult, Measurements } from '../gates/quality';
import type { FaceRatios } from '../analysis/consistency';
import type { HairSession,HairPhoto } from '../hair/state';
import type { DetailSession } from '../details/plan';
import type { TargetEvidence } from '../analysis/region';
import type { DetailShot } from '../hair/plan';
import type {BodySession,BodyPhoto} from '../body/state';
export interface Session {
  revision?: number;
  id: string; createdAt: number; updatedAt: number; mode: 'face'|'hair'|'body'; preset: 'general';
  body?:BodySession;
  hair?:HairSession;
  details?: DetailSession;
  status: 'setup' | 'scanning' | 'review' | 'done'; stage: number; label: string;
  progress?: Progress; baseline?: Baseline; camera?: 'user' | 'environment';
  retakePhotoId?: string; retakeShotId?: string;
  stream?: { width: number; height: number };
  stats?: { captures: number; failures: number; sessionFixes: number; causes: Record<string, number> };
}
export interface Photo {
  id: string; sessionId: string; opfsPath: string; width: number; height: number; createdAt: number;
  thumbPath?: string; source?: 'captured' | 'imported'; shotId?: string; binId?: string;
  fulfilledShotIds?: string[];
  poseConvention?: 'subject-left-negative-v2';
  streamDimensions?: { width: number; height: number };
  hair?:HairPhoto;
  body?:BodyPhoto;
  detail?: { instruction: DetailShot; target: TargetEvidence | null; faceMeasurements: Measurements | null; reviewed: boolean };
  pose?: { yaw: number; pitch: number; roll: number } | null; quality?: QualityResult;
  measurements?: Measurements; hash?: string | null; camera?: 'user' | 'environment';
  method?: 'takePhoto' | 'canvas'; override?: boolean; requestedYaw?: number; requestedPitch?: number;
  expression?: string; direction?: string; context?: string; bestAttempt?: boolean; relaxed?: boolean;
  identityConfirmed?: boolean; contentConfirmed?: boolean; consistencyReviewed?: boolean; ratios?: FaceRatios | null;
  baseline?: Baseline;
  sourceName?: string; fileModifiedAt?: number | null; originalTakenAt?: string | null; sourceCamera?: string | null;
  ownershipDeclared?: boolean; importReason?: string | null;
}
export class AkutooDatabase extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  settings!: EntityTable<{ key: string; value: unknown }, 'key'>;
  constructor() {
    super('akutoo');
    this.version(1).stores({ sessions: 'id,updatedAt,status', photos: 'id,sessionId,createdAt', settings: 'key' });
  }
}
export const db = new AkutooDatabase();
