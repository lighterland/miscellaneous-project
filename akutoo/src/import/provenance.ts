export interface Provenance { originalTakenAt: string | null; sourceCamera: string | null; }
const unknown = (): Provenance => ({ originalTakenAt: null, sourceCamera: null });
// Read an allowlist only. Never return GPS, arbitrary EXIF, or editor modification dates.
export function jpegProvenance(bytes: Uint8Array): Provenance {
  try {
    if (bytes[0] !== 255 || bytes[1] !== 216) return unknown();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at++] !== 255) break;
      while (bytes[at] === 255) at++;
      const marker = bytes[at++]; if (marker === 0xda || marker === 0xd9) break;
      const size = view.getUint16(at); if (size < 2 || at + size > bytes.length) break;
      const payload = at + 2, end = at + size;
      if (marker === 0xe1 && [69,120,105,102,0,0].every((value, index) => bytes[payload + index] === value)) {
        const base = payload + 6, little = bytes[base] === 73 && bytes[base + 1] === 73;
        if (!(little || (bytes[base] === 77 && bytes[base + 1] === 77)) || view.getUint16(base + 2, little) !== 42) return unknown();
        const directory = (relative: number) => {
          const values = new Map<number, string | number>(), start = base + relative;
          if (relative < 8 || start + 2 > end) return values;
          const count = Math.min(128, view.getUint16(start, little));
          for (let i = 0; i < count; i++) {
            const entry = start + 2 + i * 12; if (entry + 12 > end) break;
            const tag = view.getUint16(entry, little), type = view.getUint16(entry + 2, little), length = view.getUint32(entry + 4, little);
            if (![0x010f,0x0110,0x8769,0x9003].includes(tag)) continue;
            if (type === 4 && length === 1) values.set(tag, view.getUint32(entry + 8, little));
            if (type === 2 && length > 0 && length <= 256) {
              const offset = length <= 4 ? entry + 8 : base + view.getUint32(entry + 8, little);
              if (offset < base || offset + length > end) continue;
              values.set(tag, new TextDecoder('ascii').decode(bytes.subarray(offset, offset + length)).split('\0')[0].replace(/[^\x20-\x7e]/g, '').trim());
            }
          }
          return values;
        };
        const root = directory(view.getUint32(base + 4, little)), pointer = root.get(0x8769), exif = typeof pointer === 'number' ? directory(pointer) : new Map<number, string | number>();
        const date = exif.get(0x9003), match = typeof date === 'string' ? /^(\d{4}):(0[1-9]|1[0-2]):([0-2]\d|3[01]) ([0-2]\d):([0-5]\d):([0-5]\d)$/.exec(date) : null;
        const parts = match?.slice(1).map(Number), calendar = parts ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])) : null;
        const valid = parts && calendar && [calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate(), calendar.getUTCHours(), calendar.getUTCMinutes(), calendar.getUTCSeconds()].every((value, index) => value === parts[index]);
        const camera = [root.get(0x010f), root.get(0x0110)].filter((value): value is string => typeof value === 'string' && !!value).join(' ');
        return { originalTakenAt: match && valid ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : null, sourceCamera: camera || null };
      }
      at = end;
    }
  } catch { /* Malformed metadata is unknown, never a reason to guess. */ }
  return unknown();
}
