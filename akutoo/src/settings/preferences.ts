export interface Preferences { units: 'metric' | 'imperial'; voice: boolean; voiceURI:string|null; }
export function preferences(value: unknown): Preferences {
  const item = value && typeof value === 'object' ? value as Partial<Preferences> : {};
  return { units: item.units === 'imperial' ? 'imperial' : 'metric', voice: item.voice === true,voiceURI:typeof item.voiceURI==='string'&&item.voiceURI.length<=512?item.voiceURI:null };
}
