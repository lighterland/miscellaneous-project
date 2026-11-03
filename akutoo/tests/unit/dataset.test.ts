import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { exportable, photoName, datasetMetadata, datasetZip } from '../../src/export/dataset';
import type { Photo, Session } from '../../src/storage/db';
const session: Session = { id: 'session-1', label: 'Face scan', createdAt: 1, updatedAt: 2, mode: 'face', preset: 'general', status: 'review', stage: 1 };
const good: Photo = { id: 'photo-1', sessionId: session.id, width: 2160, height: 3840, createdAt: 1, opfsPath: 'sessions/session-1/photo-1.jpg', shotId: 'turn--30', pose: { yaw: -33, pitch: 0, roll: 0 }, requestedYaw: -30, quality: { score: 90, tier: 'A', hardFailure: false, reason: null }, measurements: { faceCount: 1, occluded: false, occlusionVerified: true, headCutOff: false, sharpness: 100, clipped: .01, exposure: 100, faceRatio: .5, shortSide: 2160, angleError: 3, expressionMatch: 1 }, override: false };
describe('dataset export', () => {
  it('excludes risky, unverified and lower-tier photos from Recommended', () => {
    const photos = [good, { ...good, id: 'risky', override: true }, { ...good, id: 'unknown', measurements: undefined }, { ...good, id: 'tier-c', quality: { ...good.quality!, tier: 'C' as const } }];
    expect(exportable(photos, 'recommended').map(photo => photo.id)).toEqual(['photo-1']);
    expect(exportable(photos, 'all')).toHaveLength(4);
  });
  it('has safe unique paths and preserves actual versus requested angles', () => {
    expect(photoName(good)).toBe('face/turn--30_photo-1.jpg');
    expect(photoName({ ...good, shotId: '../../bad' })).not.toContain('..');
    const metadata = datasetMetadata(session, [good], 'recommended');
    expect(metadata.images[0]).toMatchObject({ pose: { yaw: -33 }, requestedPose: { yaw: -30 }, override: false });
    expect(datasetMetadata(session, [{ ...good, fulfilledShotIds: ['turn--30', 'another-request'] }], 'recommended').images[0].fulfilledShotIds).toEqual(['turn--30', 'another-request']);
    expect(metadata.poseCoverage?.filled).toEqual(['yaw:-30']);
    expect(datasetMetadata(session, [{ ...good, override: true }], 'recommended').poseCoverage?.filled).toEqual([]);
  });
  it('round-trips photo bytes and metadata in a valid ZIP', async () => {
    const bytes = new Uint8Array([255, 216, 255, 217]);
    const zip = unzipSync(await datasetZip(session, [good], 'all', async () => new Blob([bytes])));
    expect(zip['akutoo-session-1/' + photoName(good)]).toEqual(bytes);
    const metadata = JSON.parse(strFromU8(zip['akutoo-session-1/metadata.json']));
    expect(metadata.images).toHaveLength(1); expect(metadata.trial).toBeUndefined();
  });
  it('uses converted PNG bytes and matching paths and format metadata', async () => {
    const png = new Uint8Array([137,80,78,71,13,10,26,10]); let conversions = 0;
    const zip = unzipSync(await datasetZip(session, [good], 'recommended', async () => new Blob(['jpeg']), {
      format: 'png', encode: async (_blob, format) => { conversions++; expect(format).toBe('png'); return new Blob([png], { type: 'image/png' }); },
    }));
    expect(conversions).toBe(1);
    const metadata = JSON.parse(strFromU8(zip['akutoo-session-1/metadata.json']));
    expect(metadata.format).toBe('png'); expect(metadata.images[0].file).toMatch(/\.png$/);
    expect(zip['akutoo-session-1/' + metadata.images[0].file]).toEqual(png);
    expect(Object.keys(zip).some(name => name.endsWith('.jpg'))).toBe(false);
  });
  it('does not create a mislabeled archive when PNG encoding fails', async () => {
    await expect(datasetZip(session, [good], 'all', async () => new Blob(['jpeg']), {
      format: 'png', encode: async () => new Blob(['jpeg'], { type: 'image/jpeg' }),
    })).rejects.toThrow();
  });
  it('matches transformed dimensions, source dimensions and configured file names', () => {
    const metadata = datasetMetadata(session, [good], 'all', 'png', { maxPhotos: 1, maxEdge: 2048, aspect: 'square', prefix: 'avatar' });
    expect(metadata.images[0]).toMatchObject({ width: 2048, height: 2048, sourceDimensions: { width: 2160, height: 3840 }, file: 'face/avatar_turn--30_photo-1.png', mode: 'face', shot_id: 'turn--30' });
    expect(metadata.session_id).toBe(session.id); expect(metadata.readiness?.provisional).toBe(true);
  });
  it('excludes unresolved proportion flags from Recommended until explicitly reviewed', () => {
    const frontal = { ...good, pose: { yaw: 0, pitch: 0, roll: 0 }, identityConfirmed: true, ratios: { eyeSpan: .3, faceWidth: .7 } };
    const base = ['a','b','c'].map(id => ({ ...frontal, id })), odd = { ...frontal, id: 'odd', ratios: { eyeSpan: .7, faceWidth: .7 } };
    expect(exportable([...base, odd], 'recommended').map(photo => photo.id)).not.toContain('odd');
    expect(exportable([...base, { ...odd, consistencyReviewed: true }], 'recommended').map(photo => photo.id)).toContain('odd');
    expect(exportable([...base, odd], 'all')).toHaveLength(4);
  });
});
