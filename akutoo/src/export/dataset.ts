import { strToU8, zipSync } from 'fflate';
import type { Photo, Session } from '../storage/db';
import { sessionFolder } from './zip';
import { poseCoverage } from '../session/coverage';
import { encodePhoto, type ExportFormat } from './encode';
import { consistency } from '../analysis/consistency';
import { datasetReadiness } from '../session/readiness';
import { defaultExportSettings, exportLayout, normalizeExportSettings, selectExportPhotos, type ExportSettings } from './settings';
export type ExportPreset = 'recommended' | 'all';
export function exportable(photos: Photo[], preset: ExportPreset): Photo[] {
  if (preset === 'all') return photos;
  const flagged = new Set(consistency(photos).unresolved);
  return photos.filter(photo => !flagged.has(photo.id) && !photo.override && (photo.body?photo.body.reviewed&&photo.identityConfirmed&&photo.contentConfirmed:photo.detail?photo.detail.reviewed&&photo.identityConfirmed&&photo.contentConfirmed:photo.hair?photo.hair.reviewed&&photo.identityConfirmed&&photo.contentConfirmed:photo.measurements?.occlusionVerified===true) && !photo.quality?.hardFailure && ['A','B'].includes(photo.quality?.tier ?? ''));
}
const safe = (value: string) => value.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 100) || 'photo';
export function photoName(photo: Photo, format: ExportFormat = 'jpeg', prefix = ''): string { return `${photo.body?`body/${safe(photo.body.mode)}`:photo.hair?`hair/${safe(photo.hair.style)}`:photo.detail?'face/details':'face'}/${prefix ? safe(prefix) + '_' : ''}${safe(photo.shotId ?? 'photo')}_${safe(photo.id)}.${format === 'png' ? 'png' : 'jpg'}`; }
export function datasetMetadata(session: Session, photos: Photo[], preset: ExportPreset, format: ExportFormat = 'jpeg', raw: ExportSettings = defaultExportSettings) {
  const settings = normalizeExportSettings(raw), selected = selectExportPhotos(exportable(photos, preset), settings);
  return { schemaVersion: 1, session_id: session.id, created_at: new Date(session.createdAt).toISOString(), subject: { label: session.label }, session: { id: session.id, label: session.label, createdAt: session.createdAt, updatedAt: session.updatedAt, mode: session.mode }, preset, format, exportSettings: settings, hair: session.hair ?? null, details: session.details ?? null, readiness: session.mode === 'face' ? datasetReadiness(selected.filter(photo=>!photo.detail)) : null, poseCoverage: session.mode === 'face' ? poseCoverage(selected) : null, baseline: session.baseline ?? null, stats: session.stats ?? null,
    body:session.body??null,images: selected.map(photo => ({ body:photo.body??null,file: photoName(photo, format, settings.prefix), id: photo.id, mode: session.mode, source: photo.source ?? 'captured', shot_id: photo.shotId ?? null, shotId: photo.shotId ?? null, binId: photo.binId ?? null, width: exportLayout(photo.width, photo.height, settings).width, height: exportLayout(photo.width, photo.height, settings).height, sourceDimensions: { width: photo.width, height: photo.height }, pose: photo.pose ?? null, poseConvention:photo.poseConvention??null,
      detail:photo.detail??null,hair:photo.hair??null,streamDimensions: photo.streamDimensions ?? null, requestedPose: { yaw: photo.requestedYaw ?? null, pitch: photo.requestedPitch ?? null }, fulfilledShotIds: photo.fulfilledShotIds ?? (photo.shotId ? [photo.shotId] : []), expression: photo.expression ?? null, direction: photo.direction ?? null, context: photo.context ?? null,
      sourceProvenance: { fileName: photo.sourceName ?? null, fileModifiedAt: photo.fileModifiedAt ?? null, originalTakenAt: photo.originalTakenAt ?? null, originalTimezone: null, camera: photo.sourceCamera ?? null, ownershipDeclared: !!photo.ownershipDeclared, importReason: photo.importReason ?? null },
      quality: photo.quality ?? null, measurements: photo.measurements ?? null, baseline: photo.baseline ?? null, identityConfirmed: !!photo.identityConfirmed, contentConfirmed: !!photo.contentConfirmed, consistencyReviewed: !!photo.consistencyReviewed, ratios: photo.ratios ?? null, override: !!photo.override, relaxed: !!photo.relaxed, camera: photo.camera ?? null, captureMethod: photo.method ?? null, createdAt: photo.createdAt,
    })) };
}
export async function datasetZip(session: Session, photos: Photo[], preset: ExportPreset, read: (photo: Photo) => Promise<Blob>, options: { format?: ExportFormat; settings?: ExportSettings; encode?: typeof encodePhoto } = {}): Promise<Uint8Array> {
  const format = options.format ?? 'jpeg';
  const settings = normalizeExportSettings(options.settings ?? defaultExportSettings), transformed = settings.aspect !== 'original' || settings.maxEdge > 0;
  const folder = sessionFolder(session.id), files: Record<string, Uint8Array> = {};
  for (const photo of selectExportPhotos(exportable(photos, preset), settings)) {
    exportLayout(photo.width, photo.height, settings);
    const source = await read(photo), encoded = format === 'png' || transformed;
    const output = encoded ? await (options.encode ?? encodePhoto)(source, format, settings, photo) : source;
    if (encoded && output.type !== `image/${format}`) throw new Error('Image encoding failed');
    files[`${folder}/${photoName(photo, format, settings.prefix)}`] = new Uint8Array(await output.arrayBuffer());
  }
  files[`${folder}/metadata.json`] = strToU8(JSON.stringify(datasetMetadata(session, photos, preset, format, settings), null, 2));
  files[`${folder}/README.txt`] = strToU8(`Akutoo on-device dataset. ${format === 'png' ? 'PNG files were converted locally from the stored JPEGs; conversion does not add detail.' : 'Photos are re-encoded JPEGs without EXIF.'}\nActual detected pose and requested pose are separate. Null means unmeasured.\nRecommended excludes risky, unreviewed and lower-tier photos. All kept includes explicit overrides.\nKeep a backup before clearing browser data.\n`);
  return zipSync(files, { level: 0 });
}
