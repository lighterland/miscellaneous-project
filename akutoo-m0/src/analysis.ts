import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { faceCrop, laplacianVariance, poseFromMatrix } from './metrics';

export class FaceAnalysis {
  private model?: FaceLandmarker;
  private frame = document.createElement('canvas');
  private crop = document.createElement('canvas');
  async load() {
    this.model = await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('./wasm'), {
      baseOptions: { modelAssetPath: './models/face_landmarker.task', delegate: 'CPU' },
      runningMode: 'VIDEO', numFaces: 1,
      outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true,
    });
  }
  close() { this.model?.close(); this.model = undefined; }
  measure(source: HTMLVideoElement | HTMLCanvasElement, time: number, still = false) {
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    const scale = Math.min(1, 480 / Math.max(width, height));
    this.frame.width = Math.round(width * scale); this.frame.height = Math.round(height * scale);
    this.frame.getContext('2d')!.drawImage(source, 0, 0, this.frame.width, this.frame.height);
    const result = still ? this.model!.detect(this.frame) : this.model!.detectForVideo(this.frame, time);
    const bounds = faceCrop(result.faceLandmarks[0] ?? [], width, height);
    let sharpness: number | null = null;
    if (bounds) {
      this.crop.width = 256; this.crop.height = 256;
      const ctx = this.crop.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, 256, 256);
      const rgba = ctx.getImageData(0, 0, 256, 256).data;
      const gray = new Float64Array(256 * 256);
      for (let i = 0; i < gray.length; i++) gray[i] = .299 * rgba[i * 4] + .587 * rgba[i * 4 + 1] + .114 * rgba[i * 4 + 2];
      sharpness = laplacianVariance(gray, 256, 256);
    }
    return { detected: !!bounds, ratio: bounds ? bounds.height / height * 100 : null, sharpness,
      pose: result.facialTransformationMatrixes[0] ? poseFromMatrix(result.facialTransformationMatrixes[0].data) : null };
  }
  async measurePhoto(canvas: HTMLCanvasElement) {
    await this.model!.setOptions({ runningMode: 'IMAGE' });
    try { return this.measure(canvas, performance.now(), true); }
    finally { await this.model!.setOptions({ runningMode: 'VIDEO' }); }
  }
}
