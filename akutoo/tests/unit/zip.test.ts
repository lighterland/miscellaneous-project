import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createTrialZip, sessionFolder } from '../../src/export/zip';

describe('trial archive', () => {
  it('uses a safe, deterministic session directory', () => {
    expect(sessionFolder('abc-123')).toBe('akutoo-abc-123');
    expect(() => sessionFolder('../private')).toThrow();
  });
  it('round-trips metadata and explicitly identifies a photo-free trial', () => {
    const zip = unzipSync(createTrialZip({ id: 'abc', createdAt: 123, label: 'My session' }));
    const metadata = JSON.parse(strFromU8(zip['akutoo-abc/metadata.json']));
    expect(metadata).toMatchObject({ schemaVersion: 1, session: { id: 'abc' }, images: [], trial: true });
    expect(strFromU8(zip['akutoo-abc/README.txt'])).toContain('No photos');
    expect(Object.keys(zip)).toHaveLength(2);
  });
});
