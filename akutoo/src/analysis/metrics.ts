export function poseBin(yaw: number, pitch: number): string {
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) throw new Error('Invalid pose');
  if (Math.abs(yaw) < 15 && Math.abs(pitch) >= 12) return `pitch:${pitch > 0 ? 15 : -15}`;
  return `yaw:${Math.max(-90, Math.min(90, Math.round(yaw / 15) * 15))}`;
}
export function dHash(gray9x8: ArrayLike<number>): string {
  if (gray9x8.length !== 72) throw new Error('dHash requires a 9x8 grayscale image');
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (gray9x8[y * 9 + x] > gray9x8[y * 9 + x + 1] ? 1n : 0n);
  return bits.toString(16).padStart(16, '0');
}
export function hashDistance(a: string, b: string): number {
  if (![a, b].every(hash => /^[0-9a-f]{16}$/i.test(hash))) throw new Error('Invalid image hash');
  let value = BigInt(`0x${a}`) ^ BigInt(`0x${b}`), count = 0;
  while (value) { value &= value - 1n; count++; }
  return count;
}
export function readiness(components: { coverage: number; quality: number; variety: number; consistency: number }): number {
  const clamp = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  return Math.round(clamp(components.coverage) * 40 + clamp(components.quality) * 30 + clamp(components.variety) * 20 + clamp(components.consistency) * 10);
}
