import { expect, it } from 'vitest';
import { exportLayout, normalizeExportSettings, selectExportPhotos, defaultExportSettings } from '../../src/export/settings';
import type { Photo } from '../../src/storage/db';
const photo = (id: string, yaw: number, score = 90): Photo => ({ id, sessionId: 's', opfsPath: 'p.jpg', createdAt: 1, width: 2160, height: 3840, pose: { yaw, pitch: 0, roll: 0 }, quality: { score, tier: 'A', hardFailure: false, reason: null } });
it('keeps originals by default and fits a complete photo without cropping', () => {
  expect(exportLayout(2160, 3840, defaultExportSettings)).toMatchObject({ width: 2160, height: 3840, drawWidth: 2160, drawHeight: 3840, x: 0, y: 0 });
  const layout = exportLayout(2160, 3840, { ...defaultExportSettings, aspect: 'square', maxEdge: 2048 });
  expect(layout).toMatchObject({ width: 2048, height: 2048, drawWidth: 1152, drawHeight: 2048, x: 448, y: 0 });
});
it('rejects invalid settings and never downsizes below the existing hard floor', () => {
  expect(() => normalizeExportSettings({ ...defaultExportSettings, maxPhotos: -1 })).toThrow();
  expect(() => normalizeExportSettings({ ...defaultExportSettings, maxEdge: NaN })).toThrow();
  expect(() => exportLayout(2160, 3840, { ...defaultExportSettings, maxEdge: 1024 })).toThrow();
  expect(normalizeExportSettings({ ...defaultExportSettings, prefix: '../../my tool' }).prefix).toBe('my-tool');
});
it('respects a photo limit while preferring new actual angles over repetitions', () => {
  const photos = [photo('front-a', 0, 99), photo('front-b', 0, 98), photo('profile', 90, 80)];
  const selected = selectExportPhotos(photos, { ...defaultExportSettings, maxPhotos: 2 });
  expect(selected.map(photo => photo.id)).toEqual(['front-a','profile']);
  expect(selectExportPhotos(photos, defaultExportSettings)).toEqual(photos);
});
it('does not give an unmatched requested expression a diversity advantage', () => {
  const measurements = { faceCount: 1, occluded: false, occlusionVerified: true, headCutOff: false, sharpness: 100, clipped: .01, exposure: 100, faceRatio: .5, shortSide: 2048, angleError: 0, expressionMatch: 1 };
  const photos = [
    { ...photo('front', 0, 100), expression: 'neutral', measurements },
    { ...photo('unmatched', 0, 99), expression: 'laugh', measurements: { ...measurements, expressionMatch: 0 } },
    { ...photo('smile', 0, 80), expression: 'closed-smile', measurements },
  ];
  expect(selectExportPhotos(photos, { ...defaultExportSettings, maxPhotos: 2 }).map(photo => photo.id)).toEqual(['front','smile']);
});
