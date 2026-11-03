import { expect, it } from 'vitest';
import { jpegProvenance } from '../../src/import/provenance';
function fixture() {
  const tiff = new Uint8Array(256), view = new DataView(tiff.buffer), write = (offset: number, value: string) => tiff.set(new TextEncoder().encode(value), offset);
  tiff.set([73,73,42,0,8,0,0,0]); view.setUint16(8, 3, true);
  view.setUint16(10, 0x010f, true); view.setUint16(12, 2, true); view.setUint32(14, 5, true); view.setUint32(18, 100, true); write(100, 'Test\0');
  view.setUint16(22, 0x0110, true); view.setUint16(24, 2, true); view.setUint32(26, 3, true); write(30, 'Z9\0');
  view.setUint16(34, 0x8769, true); view.setUint16(36, 4, true); view.setUint32(38, 1, true); view.setUint32(42, 160, true);
  view.setUint16(160, 1, true); view.setUint16(162, 0x9003, true); view.setUint16(164, 2, true); view.setUint32(166, 20, true); view.setUint32(170, 220, true); write(220, '2024:03:09 10:11:12\0');
  const jpeg = new Uint8Array(270); jpeg.set([255,216,255,225,1,8,69,120,105,102,0,0]); jpeg.set(tiff, 12); jpeg.set([255,217], 268); return jpeg;
}
it('reads only original date and camera, without inventing a timezone or modification-date fallback', () => {
  expect(jpegProvenance(fixture())).toEqual({ originalTakenAt: '2024-03-09T10:11:12', sourceCamera: 'Test Z9' });
  expect(jpegProvenance(new Uint8Array([137,80,78,71]))).toEqual({ originalTakenAt: null, sourceCamera: null });
});
it('treats truncated and invalid offsets as unknown without throwing', () => {
  for (let length = 0; length < 270; length += 7) expect(() => jpegProvenance(fixture().slice(0, length))).not.toThrow();
  const broken = fixture(); new DataView(broken.buffer).setUint32(12 + 42, 0xffffffff, true);
  expect(jpegProvenance(broken).originalTakenAt).toBeNull();
  const invalid = fixture(); invalid.set(new TextEncoder().encode('2024:02:31 29:11:12\0'), 12 + 220);
  expect(jpegProvenance(invalid).originalTakenAt).toBeNull();
});
