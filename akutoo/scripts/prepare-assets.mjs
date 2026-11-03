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
const segmentationPath = new URL('../public/models/selfie_multiclass_256x256.tflite', import.meta.url);
const segmentationUrl = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite';
const segmentationHash = 'c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0';
let segmentation;
try { segmentation = await readFile(segmentationPath); } catch {
  const response = await fetch(segmentationUrl); if (!response.ok) throw new Error(`Segmentation model download failed: ${response.status}`);
  segmentation = Buffer.from(await response.arrayBuffer());
}
if (createHash('sha256').update(segmentation).digest('hex') !== segmentationHash || segmentation.toString('ascii',4,8) !== 'TFL3') throw new Error('Segmentation model checksum/format mismatch');
await writeFile(segmentationPath,segmentation);
const posePath=new URL('../public/models/pose_landmarker_lite.task',import.meta.url);
const poseUrl='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const poseHash='59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a';
let pose;
try{pose=await readFile(posePath);}catch{const response=await fetch(poseUrl);if(!response.ok)throw new Error(`Pose model download failed: ${response.status}`);pose=Buffer.from(await response.arrayBuffer());}
if(createHash('sha256').update(pose).digest('hex')!==poseHash)throw new Error('Pose model checksum mismatch');
for(const name of ['pose_detector.tflite','pose_landmarks_detector.tflite'])if(!pose.includes(Buffer.from(name)))throw new Error(`Invalid pose bundle: missing ${name}`);
await writeFile(posePath,pose);
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url),
  new URL('../public/wasm/', import.meta.url), { recursive: true });
console.log(`Verified model (${model.length} bytes, SHA-256 ${sha256}); copied local WASM assets.`);
console.log(`Verified segmentation model (${segmentation.length} bytes, SHA-256 ${segmentationHash}).`);
console.log(`Verified pose model (${pose.length} bytes, SHA-256 ${poseHash}).`);
