import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const modelPath = new URL('../public/models/face_landmarker.task', import.meta.url);
const url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const sha256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
await mkdir(new URL('../public/models/', import.meta.url), { recursive: true });
let model;
try { model = await readFile(modelPath); } catch {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  model = Buffer.from(await response.arrayBuffer());
}
if (createHash('sha256').update(model).digest('hex') !== sha256) throw new Error('Model checksum mismatch');
// The official .task is a ZIP bundle containing these three TFLite models.
for (const name of ['face_detector.tflite', 'face_landmarks_detector.tflite', 'face_blendshapes.tflite']) {
  if (!model.includes(Buffer.from(name))) throw new Error(`Invalid model bundle: missing ${name}`);
}
await writeFile(modelPath, model);
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url),
  new URL('../public/wasm/', import.meta.url), { recursive: true });
console.log(`Verified model (${model.length} bytes, SHA-256 ${sha256}); copied local WASM assets.`);
await import('./verify-assets.mjs');
