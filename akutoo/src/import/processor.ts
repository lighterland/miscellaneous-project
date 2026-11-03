import { AnalysisClient } from '../analysis/client';
import { jpeg, thumbnail } from '../capture/camera';
import type { Baseline } from '../gates/quality';
import type { Photo } from '../storage/db';
import type { PreparedImport } from '../storage/imports';
import { planImport, type ImportCandidate, type ImportDecision } from './planner';
import { jpegProvenance, type Provenance } from './provenance';

export interface ImportItem extends ImportCandidate { file: File; preview: string; width: number; height: number; digest: string | null; provenance: Provenance; decision: ImportDecision; }
export interface ImportBatch { items: ImportItem[]; baseline: Baseline | null; }
class ImageFailure extends Error { constructor(public reason: 'unreadable' | 'large') { super(reason); } }
const cancelled = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Import stopped', 'AbortError'); };
const digest = async (blob: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), value => value.toString(16).padStart(2, '0')).join('');
async function raster(file: File): Promise<{ canvas: HTMLCanvasElement; provenance: Provenance }> {
  if (file.size > 50 * 1024 * 1024) throw new ImageFailure('large');
  const header = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer()), text = (a: number, b: number) => String.fromCharCode(...header.subarray(a, b));
  const supported = (header[0] === 255 && header[1] === 216) || [137,80,78,71,13,10,26,10].every((value, i) => header[i] === value) || (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') || (text(4, 8) === 'ftyp' && ['heic','heix','hevc','hevx','mif1','msf1','avif','avis'].includes(text(8, 12)));
  if (!supported) throw new ImageFailure('unreadable');
  const bitmap = await createImageBitmap(file), canvas = document.createElement('canvas');
  try {
    if (bitmap.width * bitmap.height > 24_000_000 || Math.max(bitmap.width, bitmap.height) > 8192) throw new ImageFailure('large');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); if (!context) throw new ImageFailure('unreadable');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0);
    return { canvas, provenance: jpegProvenance(header) };
  } catch (error) { canvas.width = 0; throw error; } finally { bitmap.close(); }
}
export function releaseImport(batch: ImportBatch | null) { batch?.items.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); }); }
export async function analyzeImports(files: File[], existing: Photo[], owner: boolean, progress: (done: number, total: number) => void, signal?: AbortSignal): Promise<ImportBatch> {
  if (!owner) throw new Error('Confirm ownership before import');
  const items: ImportItem[] = []; let client: AnalysisClient | undefined;
  const abort = () => client?.close(); signal?.addEventListener('abort', abort, { once: true });
  try {
    cancelled(signal);
    try { client = new AnalysisClient(); await client.load(); } catch { client?.close(); client = undefined; }
    for (let index = 0; index < files.length; index++) {
      cancelled(signal); const file = files[index], id = crypto.randomUUID();
      const item: ImportItem = { id, file, result: null, preview: '', width: 0, height: 0, digest: null, provenance: { originalTakenAt: null, sourceCamera: null }, decision: { id, accepted: false, reason: 'unreadable', quality: null, measurements: null, binId: null } };
      items.push(item); let canvas: HTMLCanvasElement | undefined;
      try {
        const decoded = await raster(file); canvas = decoded.canvas; item.provenance = decoded.provenance;
        const full = await jpeg(canvas), bitmap = await createImageBitmap(full);
        try { canvas.getContext('2d')!.drawImage(bitmap, 0, 0); } finally { bitmap.close(); }
        item.width = canvas.width; item.height = canvas.height; item.digest = await digest(full);
        const thumb = thumbnail(canvas); try { item.preview = URL.createObjectURL(await jpeg(thumb)); } finally { thumb.width = 0; }
        cancelled(signal);
        if (client) { try { item.result = await client.measure(canvas, performance.now(), true); } catch { item.error = 'analysis'; } }
        else item.error = 'analysis';
      } catch (error) { if (signal?.aborted) throw error; item.error = error instanceof ImageFailure ? error.reason : 'unreadable'; }
      finally { if (canvas) canvas.width = 0; }
      cancelled(signal); progress(index + 1, files.length);
    }
    const plan = planImport(items, existing, owner); items.forEach((item, index) => { item.decision = plan.decisions[index]; });
    return { items, baseline: plan.baseline };
  } catch (error) { releaseImport({ items, baseline: null }); throw error; }
  finally { client?.close(); signal?.removeEventListener('abort', abort); }
}
// Re-encode one selected file at a time; do not retain a whole batch of full-size pixels.
export async function* prepareImports(sessionId: string, batch: ImportBatch, selected: Set<string>, owner: boolean, progress: (done: number, total: number) => void): AsyncGenerator<PreparedImport> {
  if (!owner) throw new Error('Confirm ownership before import');
  const items = batch.items.filter(item => selected.has(item.id));
  for (let index = 0; index < items.length; index++) {
    const item = items[index]; if (!item.digest || !item.preview) throw new Error('Photo cannot be decoded');
    const { canvas } = await raster(item.file);
    try {
      const full = await jpeg(canvas); if (await digest(full) !== item.digest) throw new Error('Source pixels changed; analyze again');
      const thumbCanvas = thumbnail(canvas); let thumb: Blob;
      try { thumb = await jpeg(thumbCanvas); } finally { thumbCanvas.width = 0; }
      const risky = !item.decision.accepted, quality = item.decision.quality ?? { score: 0, tier: 'D' as const, hardFailure: true, reason: 'invalid' as const };
      const photo: Photo = { id: item.id, sessionId, source: 'imported', opfsPath: `sessions/${sessionId}/import-${item.id}.jpg`, thumbPath: `thumbs/${item.id}.jpg`, createdAt: Date.now(), width: canvas.width, height: canvas.height, sourceName: item.file.name, fileModifiedAt: item.file.lastModified || null, ...item.provenance, ownershipDeclared: true, importReason: item.decision.reason, pose: item.result?.pose ?? null, binId: item.decision.binId ?? undefined, expression: item.decision.expression, measurements: item.decision.measurements ?? undefined, quality, hash: item.result?.hash ?? null, ratios: item.result?.ratios ?? null, override: risky, identityConfirmed: false, baseline: batch.baseline ? { ...batch.baseline } : undefined };
      canvas.width = 0; yield { photo, full, thumb }; progress(index + 1, items.length);
    } finally { canvas.width = 0; }
  }
}
