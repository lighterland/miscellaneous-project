export type Facing = 'user' | 'environment';
export interface CameraSource {
  open(facing: Facing): Promise<MediaStreamTrack>;
  stop(): void;
  capture(): Promise<{ canvas: HTMLCanvasElement; method: 'takePhoto' | 'canvas'; fallback: boolean }>;
}
type PhotoCapture = { takePhoto(): Promise<Blob> };
type PhotoConstructor = new (track: MediaStreamTrack) => PhotoCapture;
const imageCapture = () => (window as unknown as { ImageCapture?: PhotoConstructor }).ImageCapture;
export const hasTakePhoto = () => typeof imageCapture()?.prototype.takePhoto === 'function';

export class BrowserCamera implements CameraSource {
  private stream?: MediaStream;
  constructor(private video: HTMLVideoElement) {}
  async open(facing: Facing) {
    this.stop();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 },
      } });
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'OverconstrainedError') throw error;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing } });
    }
    this.video.srcObject = this.stream;
    try { await this.video.play(); } catch (error) { this.stop(); throw error; }
    return this.stream.getVideoTracks()[0];
  }
  stop() { this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined; this.video.srcObject = null; }
  async capture() {
    const track = this.stream?.getVideoTracks()[0];
    if (!track || track.readyState !== 'live' || !this.video.videoWidth) throw new Error('Camera is not ready');
    const canvas = document.createElement('canvas');
    const Constructor = imageCapture();
    if (Constructor && hasTakePhoto()) {
      let bitmap: ImageBitmap | undefined;
      try {
        bitmap = await createImageBitmap(await new Constructor(track).takePhoto());
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
        return { canvas, method: 'takePhoto' as const, fallback: false };
      } catch { /* A supported API may still fail on a particular camera. */ }
      finally { bitmap?.close(); }
    }
    canvas.width = this.video.videoWidth; canvas.height = this.video.videoHeight;
    canvas.getContext('2d')!.drawImage(this.video, 0, 0);
    return { canvas, method: 'canvas' as const, fallback: !!Constructor && hasTakePhoto() };
  }
}
export const jpeg = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('JPEG encoding failed')), 'image/jpeg', 0.92);
});
