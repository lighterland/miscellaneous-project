import { expect, it } from 'vitest';
import { preferences } from '../../src/settings/preferences';
it('loads explicit preferences without converting truthy corrupt values into consent', () => {
  expect(preferences(undefined)).toEqual({ units: 'metric', voice: false,voiceURI:null });
  expect(preferences({ units: 'imperial', voice: true })).toEqual({ units: 'imperial', voice: true,voiceURI:null });
  expect(preferences({ units: 'unknown', voice: 'true' })).toEqual({ units: 'metric', voice: false,voiceURI:null });
});
