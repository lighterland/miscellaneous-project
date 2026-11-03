import { describe, expect, it } from 'vitest';
import { persistenceStatus, requestPersistence } from '../../src/storage/persistence';

describe('persistent storage reporting', () => {
  it('distinguishes unsupported, denied and granted without promising permanent storage', async () => {
    expect(await persistenceStatus({})).toBe('unsupported');
    expect(await requestPersistence({})).toBe('unsupported');
    expect(await requestPersistence({ persist: async () => false })).toBe('best-effort');
    expect(await requestPersistence({ persist: async () => true })).toBe('persistent');
    expect(await persistenceStatus({ persisted: async () => false })).toBe('best-effort');
  });
  it('treats API errors as unknown rather than approval', async () => {
    const fail = async () => { throw new Error('Browser policy'); };
    expect(await persistenceStatus({ persisted: fail })).toBe('unknown');
    expect(await requestPersistence({ persist: fail })).toBe('unknown');
  });
});
