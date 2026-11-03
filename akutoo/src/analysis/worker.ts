/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { faceCrop, laplacianVariance, poseFromMatrix } from './image-metrics';
import { dHash } from './metrics';
import { faceRatios, frontal } from './consistency';
import { regionBounds, regionMetrics, type TargetEvidence } from './region';
import type { AnalysisRequest, AnalysisResponse, AnalysisResult } from './protocol';

let model: FaceLandmarker | undefined;
let chain = Promise.resolve();
const frame = new OffscreenCanvas(1, 1), crop = new OffscreenCanvas(256, 256), targetCrop = new OffscreenCanvas(256, 256), hashCanvas = new OffscreenCanvas(9, 8);
function grayscale(rgba: Uint8ClampedArray) {
  const gray = new Float64Array(rgba.length / 4);
  for (let i = 0; i < gray.length; i++) gray[i] = .299 * rgba[i * 4] + .587 * rgba[i * 4 + 1] + .114 * rgba[i * 4 + 2];
  return gray;
}
function reply(message: AnalysisResponse) { self.postMessage(message); }
async function handle(request: AnalysisRequest) {
  try {
    if (request.type === 'load') {
      model?.close();
      const base = new URL(request.base);
      model = await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(new URL('wasm', base).href), {
        baseOptions: { modelAssetPath: new URL('models/face_landmarker.task', base).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 2, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true,
      });
      reply({ id: request.id, type: 'ready' }); return;
    }
    if (!model) throw new Error('Model is not loaded');
    const started = performance.now();
    const { width, height } = request.bitmap;
    const scale = Math.min(1, 480 / Math.max(width, height));
    frame.width = Math.round(width * scale); frame.height = Math.round(height * scale);
    frame.getContext('2d')!.drawImage(request.bitmap, 0, 0, frame.width, frame.height);
    if (request.still) await model.setOptions({ runningMode: 'IMAGE' });
    const result = await (async () => {
      try { return request.still ? model!.detect(frame) : model!.detectForVideo(frame, request.time); }
      finally { if (request.still) await model!.setOptions({ runningMode: 'VIDEO' }); }
    })();
    const bounds = faceCrop(result.faceLandmarks[0] ?? [], width, height);
    let sharpness = 0, exposure = 0, clipped = 0, hash: string | null = null;
    if (bounds) {
      const ctx = crop.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(request.bitmap, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, 256, 256);
      const gray = grayscale(ctx.getImageData(0, 0, 256, 256).data);
      sharpness = laplacianVariance(gray, 256, 256);
      for (const value of gray) { exposure += value; if (value <= 5 || value >= 250) clipped++; }
      exposure /= gray.length; clipped /= gray.length;
      const hashCtx = hashCanvas.getContext('2d', { willReadFrequently: true })!;
      hashCtx.drawImage(crop, 0, 0, 9, 8);
      hash = dHash(grayscale(hashCtx.getImageData(0, 0, 9, 8).data));
    }
    const pose = result.facialTransformationMatrixes[0] ? poseFromMatrix(result.facialTransformationMatrixes[0].data) : null;
    let target: TargetEvidence | undefined;
    if (request.target) {
      const bounds = regionBounds(request.target, width, height);
      target = { source: 'guide', visibilityVerified: false, bounds, metrics: null, sourceDimensions: { width, height } };
      if (bounds) {
        const context = targetCrop.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(request.bitmap, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, 256, 256);
        target.metrics = regionMetrics(grayscale(context.getImageData(0, 0, 256, 256).data), 256, 256);
      }
    }
    const measured: AnalysisResult = {
      measurements: { faceCount: result.faceLandmarks.length, occluded: false, occlusionVerified: false, headCutOff: !!bounds && (bounds.y <= 0 || bounds.y + bounds.height >= height), sharpness, clipped, exposure, faceRatio: bounds ? bounds.height / height : 0, shortSide: Math.min(width, height), angleError: 0, expressionMatch: 1 },
      pose, blendshapes: Object.fromEntries((result.faceBlendshapes[0]?.categories ?? []).map(category => [category.categoryName, category.score])),
      hash, durationMs: performance.now() - started, occlusionVerified: false,
      ...(target ? { target } : {}),
      ratios: result.faceLandmarks.length === 1 && frontal({ pose }) ? faceRatios(result.faceLandmarks[0], { left: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, right: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, oval: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL }, width, height) : null,
    };
    reply({ id: request.id, type: 'result', result: measured });
  } catch (error) { reply({ id: request.id, type: 'error', error: error instanceof Error ? error.message : 'Analysis failed' }); }
  finally { if (request.type === 'frame') request.bitmap.close(); }
}
self.onmessage = (event: MessageEvent<AnalysisRequest>) => { chain = chain.then(() => handle(event.data)); };
