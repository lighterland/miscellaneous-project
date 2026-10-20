import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse((await readFile(new URL('../assets.sha256.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
let bytes = 0;
for (const [path, expected] of Object.entries(manifest)) {
  const data = await readFile(new URL(`../public/${path}`, import.meta.url));
  if (createHash('sha256').update(data).digest('hex') !== expected) throw new Error(`Asset checksum mismatch: ${path}`);
  bytes += data.length;
}
console.log(`Verified ${Object.keys(manifest).length} vendored assets (${bytes} bytes), without downloads.`);
