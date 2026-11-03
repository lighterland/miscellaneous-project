import type { AnalysisResponse, AnalysisResult } from './protocol';
import type { NormalizedRegion } from './region';
export class AnalysisClient {
  private worker: Worker;
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: AnalysisResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor() {
    // Classic bundled worker permits MediaPipe's local WASM loader to use importScripts.
    this.worker = new Worker(new URL('./worker.ts', import.meta.url));
    this.worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
      const pending = this.pending.get(event.data.id); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(event.data.id);
      if (event.data.type === 'error') pending.reject(new Error(event.data.error)); else pending.resolve(event.data);
    };
    this.worker.onerror = () => this.close();
  }
  private send(message: object, transfer: Transferable[] = []) {
    const id = ++this.sequence;
    return new Promise<AnalysisResponse>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Analysis timed out')); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.worker.postMessage({ ...message, id }, transfer); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async load() { await this.send({ type: 'load', base: new URL(import.meta.env.BASE_URL, document.baseURI).href }); }
  async measure(source: CanvasImageSource, time: number, still = false, target?: NormalizedRegion): Promise<AnalysisResult> {
    const bitmap = await createImageBitmap(source as ImageBitmapSource);
    const response = await this.send({ type: 'frame', bitmap, time, still, target }, [bitmap]);
    if (response.type !== 'result') throw new Error('Unexpected analysis response');
    return response.result;
  }
  close() {
    this.worker.terminate();
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Analysis stopped')); }
    this.pending.clear();
  }
}
