export interface CameraSource {
  open(facing: 'user' | 'environment'): Promise<MediaStreamTrack>;
  frame(): HTMLCanvasElement;
  still?(): Promise<HTMLCanvasElement | null>;
  stop(): void;
}
export class BrowserCamera implements CameraSource {
  private stream?: MediaStream;
  constructor(private video: HTMLVideoElement) {}
  async open(facing: 'user' | 'environment') {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } } });
    this.video.srcObject = this.stream;
    try { await this.video.play(); } catch (error) { this.stop(); throw error; }
    return this.stream.getVideoTracks()[0];
  }
  frame() {
    if (!this.stream?.active || !this.video.videoWidth) throw new Error('Camera is not ready');
    const canvas = document.createElement('canvas'); canvas.width = this.video.videoWidth; canvas.height = this.video.videoHeight;
    canvas.getContext('2d')!.drawImage(this.video, 0, 0); return canvas;
  }
  async still(): Promise<HTMLCanvasElement | null> {
    // PRD 21.7: sensor still on Android; iOS keeps its native stream path.
    const Constructor = (window as unknown as { ImageCapture?: new (track: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
    const track = this.stream?.getVideoTracks()[0];
    if (!/Android/i.test(navigator.userAgent) || !Constructor || !track || track.readyState !== 'live') return null;
    let timer: ReturnType<typeof setTimeout> | undefined, bitmap: ImageBitmap | undefined;
    try {
      const photo = await Promise.race([new Constructor(track).takePhoto(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Still capture timed out')), 8000); })]);
      bitmap = await createImageBitmap(photo);
      // Bound additional canvas/inference work after decode, like imports.
      // This does not guarantee the browser's peak decoding memory usage.
      if (bitmap.width * bitmap.height > 24_000_000 || Math.max(bitmap.width, bitmap.height) > 8192 || track.readyState !== 'live') return null;
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0); return canvas;
    } catch { return null; }
    finally { clearTimeout(timer); bitmap?.close(); }
  }
  stop() { this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined; this.video.srcObject = null; }
}
export function jpeg(canvas: HTMLCanvasElement, quality = .92): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('JPEG encoding failed')), 'image/jpeg', quality));
}
export function thumbnail(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const result = document.createElement('canvas'), scale = Math.min(1, 320 / Math.max(canvas.width, canvas.height));
  result.width = Math.round(canvas.width * scale); result.height = Math.round(canvas.height * scale);
  result.getContext('2d')!.drawImage(canvas, 0, 0, result.width, result.height); return result;
}
