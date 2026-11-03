import type { Photo } from '../storage/db';
import { hashDistance, poseBin, readiness } from '../analysis/metrics';
import { consistency } from '../analysis/consistency';
import { poseCoverage } from './coverage';

export const importantBins = ['yaw:0', 'yaw:-45', 'yaw:45', 'yaw:-90', 'yaw:90', 'pitch:-15', 'pitch:15'];
const expressions = ['neutral','closed-smile','toothy-smile','laugh','surprise','smirk'];
const contexts = ['side-light','new-background','new-outfit'];
const validHash = (hash: Photo['hash']): hash is string => typeof hash === 'string' && /^[0-9a-f]{16}$/i.test(hash);
export function datasetReadiness(photos: Photo[]) {
  const used = photos.filter(photo => !photo.override && photo.quality && !photo.quality.hardFailure && ['A','B','C'].includes(photo.quality.tier) && Number.isFinite(photo.quality.score) && photo.measurements?.faceCount === 1);
  const unique: Photo[] = [], duplicateIds: string[] = [];
  const bin = (photo: Photo) => photo.pose && [photo.pose.yaw, photo.pose.pitch].every(Number.isFinite) ? poseBin(photo.pose.yaw, photo.pose.pitch) : null;
  const key = (photo: Photo) => JSON.stringify([bin(photo), photo.expression, photo.context, photo.direction]);
  for (const photo of [...used].sort((a, b) => Number(!!b.contentConfirmed) - Number(!!a.contentConfirmed) || b.quality!.score - a.quality!.score)) {
    if (bin(photo) && validHash(photo.hash) && unique.some(previous => validHash(previous.hash) && key(previous) === key(photo) && hashDistance(previous.hash, photo.hash!) < 6)) duplicateIds.push(photo.id);
    else unique.push(photo);
  }
  const coverage = poseCoverage(used), missingImportant = importantBins.filter(bin => !coverage.filled.includes(bin));
  const identity = consistency(used), unknownHashes = used.filter(photo => !validHash(photo.hash)).map(photo => photo.id);
  const expressionCount = expressions.filter(expression => unique.some(photo => photo.expression === expression && (photo.measurements?.expressionMatch ?? 0) >= .8)).length;
  const contextCount = contexts.filter(context => unique.some(photo => photo.context === context && photo.contentConfirmed)).length;
  const components = {
    coverage: (importantBins.length - missingImportant.length) / importantBins.length,
    quality: unique.length ? (unique.reduce((sum, photo) => sum + Math.max(0, Math.min(100, photo.quality!.score)) / 100, 0) / unique.length + unique.filter(photo => ['A','B'].includes(photo.quality!.tier)).length / unique.length) / 2 : 0,
    variety: unknownHashes.length ? null : used.length ? (expressionCount + contextCount) / 9 * unique.length / used.length : 0,
    consistency: !used.length ? 0 : identity.reference && !identity.unknown.length ? identity.verified.length / used.length : null,
  };
  const score = readiness({ ...components, variety: components.variety ?? 0, consistency: components.consistency ?? 0 });
  const status: 'needs-work' | 'unmeasured' | 'needs-review' | 'ready' | 'good-enough' = !used.length ? 'needs-work' : components.variety === null || components.consistency === null ? 'unmeasured' : identity.unresolved.length ? 'needs-review' : score >= 80 ? 'ready' : score >= 60 ? 'good-enough' : 'needs-work';
  const tiers = Object.fromEntries(['A','B','C','D'].map(tier => [tier, photos.filter(photo => photo.quality?.tier === tier).length]));
  return { score, status, components, tiers, usedCount: used.length, riskyCount: photos.filter(photo => photo.override).length, missingImportant, duplicateIds, unknownHashes, identity, provisional: true as const };
}
