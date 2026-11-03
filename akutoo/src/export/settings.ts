import type { Photo } from '../storage/db';
import { poseBin } from '../analysis/metrics';
export interface ExportSettings { maxPhotos: number; maxEdge: number; aspect: 'original' | 'square' | 'portrait-3-4' | 'portrait-4-5'; prefix: string; }
export const defaultExportSettings: ExportSettings = { maxPhotos: 0, maxEdge: 0, aspect: 'original', prefix: '' };
export function normalizeExportSettings(settings: ExportSettings): ExportSettings {
  if (!Number.isInteger(settings.maxPhotos) || settings.maxPhotos < 0 || settings.maxPhotos > 1000 || !Number.isInteger(settings.maxEdge) || settings.maxEdge < 0 || settings.maxEdge > 16384 || (settings.maxEdge > 0 && settings.maxEdge < 1024) || !['original','square','portrait-3-4','portrait-4-5'].includes(settings.aspect) || typeof settings.prefix !== 'string') throw new Error('Invalid export settings');
  return { ...settings, prefix: settings.prefix.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) };
}
export function exportLayout(width: number, height: number, raw: ExportSettings) {
  const settings = normalizeExportSettings(raw);
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid source dimensions');
  const ratio = settings.aspect === 'square' ? 1 : settings.aspect === 'portrait-3-4' ? 3 / 4 : settings.aspect === 'portrait-4-5' ? 4 / 5 : width / height;
  const canvasWidth = Math.max(width, height * ratio), canvasHeight = Math.max(height, width / ratio);
  const scale = settings.maxEdge ? Math.min(1, settings.maxEdge / Math.max(canvasWidth, canvasHeight)) : 1;
  const outWidth = Math.round(canvasWidth * scale), outHeight = Math.round(canvasHeight * scale), drawWidth = Math.round(width * scale), drawHeight = Math.round(height * scale);
  if (Math.min(drawWidth, drawHeight) < Math.min(1024, width, height)) throw new Error('Output would be below the resolution floor');
  return { width: outWidth, height: outHeight, drawWidth, drawHeight, x: Math.floor((outWidth - drawWidth) / 2), y: Math.floor((outHeight - drawHeight) / 2) };
}
export function selectExportPhotos(photos: Photo[], raw: ExportSettings): Photo[] {
  const settings = normalizeExportSettings(raw);
  if (!settings.maxPhotos || photos.length <= settings.maxPhotos) return photos;
  const remaining = [...photos], selected: Photo[] = [], bins = new Set<string>(), expressions = new Set<string>(), contexts = new Set<string>();
  const bin = (photo: Photo) => photo.pose && [photo.pose.yaw, photo.pose.pitch].every(Number.isFinite) ? poseBin(photo.pose.yaw, photo.pose.pitch) : null;
  const measuredExpression = (photo: Photo) => photo.expression && (photo.measurements?.expressionMatch ?? 0) >= .8 ? photo.expression : null;
  const priority = (photo: Photo) => { const pose = bin(photo), expression = measuredExpression(photo); return (pose && !bins.has(pose) ? 4 : 0) + (expression && !expressions.has(expression) ? 1 : 0) + (photo.context && photo.contentConfirmed && !contexts.has(photo.context) ? 1 : 0) + Math.max(0, Math.min(100, photo.quality?.score ?? 0)) / 100; };
  while (selected.length < settings.maxPhotos && remaining.length) {
    remaining.sort((a, b) => priority(b) - priority(a)); const photo = remaining.shift()!; selected.push(photo);
    const pose = bin(photo), expression = measuredExpression(photo); if (pose) bins.add(pose); if (expression) expressions.add(expression); if (photo.context && photo.contentConfirmed) contexts.add(photo.context);
  }
  return selected;
}
