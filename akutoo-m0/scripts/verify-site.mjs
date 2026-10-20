import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { server } from './serve-site.mjs';

await new Promise(resolve => server.listen(0, 'localhost', resolve));
const origin = `http://localhost:${server.address().port}`;
const base = `${origin}/miscellaneous-project/`;
async function verifyCopy(source, destination) {
  const entries = await readdir(source, { withFileTypes: true });
  assert.deepEqual((await readdir(destination)).sort(), entries.map(entry => entry.name).sort());
  for (const entry of entries) {
    const from = new URL(entry.name + (entry.isDirectory() ? '/' : ''), source);
    const to = new URL(entry.name + (entry.isDirectory() ? '/' : ''), destination);
    if (entry.isDirectory()) await verifyCopy(from, to);
    else assert.deepEqual(await readFile(to), await readFile(from), from.href);
  }
}
try {
  assert.deepEqual(await readFile(new URL('../../_site/index.html', import.meta.url)), await readFile(new URL('../../index.html', import.meta.url)));
  for (const [source, destination] of [['hbd-nyomin/dist', 'hbd-nyomin'], ['hbd-zul', 'hbd-zul'], ['nusaeco', 'nusaeco'], ['akutoo-m0/dist', 'akutoo-m0']]) {
    await verifyCopy(new URL(`../../${source}/`, import.meta.url), new URL(`../../_site/${destination}/`, import.meta.url));
  }
  console.log('All four assembled project trees and the root index match their sources byte for byte.');
  for (const path of ['', 'hbd-nyomin/', 'hbd-zul/', 'nusaeco/', 'akutoo-m0/']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<html/i);
    if (!path) assert.doesNotMatch(html, /akutoo-m0/);
    if (path === 'akutoo-m0/') {
      assert.match(html, /name="robots" content="noindex,nofollow"/);
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
      for (const asset of assets) {
        assert.ok(asset.startsWith('./'), asset);
        assert.equal((await fetch(new URL(asset, base + path))).status, 200, asset);
      }
    }
    console.log(`HTTP 200: ${path || 'index.html'}`);
  }
  const wasm = await readdir(new URL('../public/wasm/', import.meta.url));
  for (const path of ['models/face_landmarker.task', ...wasm.map(name => `wasm/${name}`)]) {
    const response = await fetch(base + 'akutoo-m0/' + path);
    assert.equal(response.status, 200, path);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(`../public/${path}`, import.meta.url)), path);
    console.log(`HTTP 200, identical bytes: ${path}`);
  }
  const sw = await (await fetch(base + 'akutoo-m0/sw.js')).text();
  assert.doesNotMatch(sw, /url:["']\//);
  assert.match(sw, /models\/face_landmarker\.task/);
  for (const file of wasm) assert.ok(sw.includes(`wasm/${file}`), file);
  assert.equal((await fetch(origin + '/akutoo-m0/')).status, 404);
  console.log('Relative service-worker precache and sub-path isolation passed.');
} finally { await new Promise(resolve => server.close(resolve)); }
