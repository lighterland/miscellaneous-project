export type ExportFormat = 'jpeg' | 'png';
import { defaultExportSettings, exportLayout, type ExportSettings } from './settings';

// Decode and draw on-device so source metadata is never copied into PNG output.
export async function encodePhoto(blob: Blob, format: ExportFormat, settings: ExportSettings = defaultExportSettings, expected?: { width: number; height: number }): Promise<Blob> {
  const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
  try {
    if (expected && (bitmap.width !== expected.width || bitmap.height !== expected.height)) throw new Error('Stored photo dimensions do not match');
    const layout = exportLayout(bitmap.width, bitmap.height, settings);
    canvas.width = layout.width; canvas.height = layout.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image encoder unavailable');
    context.fillStyle = '#14101f'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, layout.x, layout.y, layout.drawWidth, layout.drawHeight);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Image encoding failed')), `image/${format}`, .92));
  } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
}
