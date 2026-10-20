import './style.css';
import { BrowserCamera, hasTakePhoto, jpeg, type Facing } from './camera';
import { FaceAnalysis } from './analysis';
import { rollingFps } from './metrics';
import { s } from './i18n/strings.en';

document.title = s.title;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <h1>${s.title}</h1><p>${s.intro}</p>
  <label for="camera">${s.camera}</label>
  <select id="camera"><option value="user">${s.front}</option><option value="environment">${s.rear}</option></select>
  <div class="controls"><button id="start">${s.start}</button><button id="stop" disabled>${s.stop}</button></div>
  <p id="status" role="status">${s.ready}</p><p id="offline"></p>
  <video id="video" autoplay muted playsinline></video>
  <dl>${['requested', 'actual', 'track', 'available', 'detected', 'angles', 'fps', 'faceSize', 'sharpness', 'maxYaw', 'photo']
    .map(key => `<dt>${s[key as keyof typeof s]}</dt><dd id="${key}">${s.na}</dd>`).join('')}</dl>
  <p>${s.yawNote}</p><p>${s.captureNote}</p>
  <div class="controls"><button class="primary" id="capture" disabled>${s.capture}</button>
    <button id="copy">${s.copy}</button><a id="download" hidden>${s.download}</a></div>
  <img id="photo-preview" alt="${s.photoAlt}" hidden>
  <label for="report">${s.report}</label><textarea id="report" readonly></textarea>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = el<HTMLVideoElement>('video');
const cameraSelect = el<HTMLSelectElement>('camera');
const start = el<HTMLButtonElement>('start'), stop = el<HTMLButtonElement>('stop');
const capture = el<HTMLButtonElement>('capture'), report = el<HTMLTextAreaElement>('report');
const download = el<HTMLAnchorElement>('download'), preview = el<HTMLImageElement>('photo-preview');
const camera = new BrowserCamera(video), analysis = new FaceAnalysis();
let running = false, analyzing = false, busy = false, raf = 0, lastFrame = -1, lastTick = 0;
let started = 0, ended = 0, samples: number[] = [], facing: Facing = 'user';
let settings: MediaTrackSettings = {}, trackLabel = s.na, photoUrl = '';
let current: ReturnType<FaceAnalysis['measure']> | null = null;
let left: number | null = null, right: number | null = null, photoInfo = s.none;
const text = (id: string, value: string) => { el(id).textContent = value; };
const number = (value: number | null | undefined) => value == null ? s.na : value.toFixed(1);
const resolution = () => settings.width && settings.height ? `${settings.width} × ${settings.height}` : s.na;
function render() {
  const now = running ? performance.now() : ended;
  const fps = started ? rollingFps(samples, started, now) : 0;
  const yaw = `${number(left)} / ${number(right)}`;
  text('requested', s.requestValue); text('actual', resolution());
  text('track', `${trackLabel} / ${settings.facingMode ?? s.na}`);
  text('available', hasTakePhoto() ? s.yes : s.no);
  text('detected', current ? current.detected ? s.yes : s.no : s.na);
  text('angles', current?.pose ? `${number(current.pose.yaw)} / ${number(current.pose.pitch)} / ${number(current.pose.roll)}` : s.na);
  text('fps', number(fps)); text('faceSize', number(current?.ratio));
  text('sharpness', number(current?.sharpness)); text('maxYaw', yaw); text('photo', photoInfo);
  report.value = [s.title, `${s.ua}: ${navigator.userAgent}`, `${s.selected}: ${facing === 'user' ? s.front : s.rear}`,
    `${s.track}: ${trackLabel} / ${settings.facingMode ?? s.na}`, `${s.requested}: ${s.requestValue}`,
    `${s.actual}: ${resolution()}`, `${s.available}: ${hasTakePhoto() ? s.yes : s.no}`,
    `${s.photo}: ${photoInfo}`, `${s.fps}: ${number(fps)}`, `${s.duration}: ${number(Math.min(10, Math.max(0, now - started) / 1000))}`,
    `${s.maxYaw}: ${yaw}`, `${s.model}: ${s.mode}`, `${s.options}: ${s.skipped}`, s.yawNote].join('\n');
}
function tick(time: number) {
  if (!running) return;
  if (!busy && analyzing && video.readyState >= 2 && time - lastTick >= 1000 / 15 && video.currentTime !== lastFrame) {
    lastTick = time; lastFrame = video.currentTime;
    try {
      current = analysis.measure(video, time);
      const yaw = current.pose?.yaw;
      if (current.detected && yaw != null) {
        if (yaw <= 0) left = Math.max(left ?? 0, -yaw);
        if (yaw >= 0) right = Math.max(right ?? 0, yaw);
      }
      const completed = performance.now();
      samples.push(completed); samples = samples.filter(t => t > completed - 10000);
    } catch { analyzing = false; current = null; text('status', s.manual); }
    render();
  }
  raf = requestAnimationFrame(tick);
}
function stopRun(message = s.stopped) {
  running = false; ended = performance.now(); cancelAnimationFrame(raf); camera.stop();
  capture.disabled = true; stop.disabled = true; text('status', message); render();
}
start.onclick = async () => {
  if (busy) return;
  busy = true; start.disabled = true; stopRun(s.loading); cameraSelect.disabled = true;
  facing = cameraSelect.value as Facing;
  samples = []; left = right = null; current = null; settings = {}; trackLabel = s.na; started = 0;
  photoInfo = s.none; URL.revokeObjectURL(photoUrl); photoUrl = ''; preview.hidden = download.hidden = true;
  analysis.close(); analyzing = false;
  try {
    if (!isSecureContext || !navigator.mediaDevices) throw new Error(s.insecure);
    const track = await camera.open(facing);
    settings = track.getSettings(); trackLabel = track.label || s.na;
    video.classList.toggle('mirror', settings.facingMode ? settings.facingMode === 'user' : facing === 'user');
    track.onended = () => stopRun(s.interrupted);
    try { await analysis.load(); analyzing = true; } catch { text('status', s.manual); }
    running = true; started = performance.now(); lastTick = 0; lastFrame = -1;
    capture.disabled = false; stop.disabled = false;
    if (analyzing) text('status', s.running);
    raf = requestAnimationFrame(tick);
  } catch { camera.stop(); text('status', !isSecureContext ? s.insecure : s.failed); }
  finally { busy = false; start.disabled = false; cameraSelect.disabled = false; render(); }
};
stop.onclick = () => stopRun();
capture.onclick = async () => {
  if (busy || !running) return;
  busy = true; capture.disabled = start.disabled = stop.disabled = true;
  try {
    const photo = await camera.capture();
    const blob = await jpeg(photo.canvas);
    // Decode the exported JPEG so the metric describes the actual downloaded image.
    const bitmap = await createImageBitmap(blob);
    photo.canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close();
    let sharpness: number | null = null;
    if (analyzing) {
      try { sharpness = (await analysis.measurePhoto(photo.canvas)).sharpness; }
      catch { analyzing = false; current = null; text('status', s.manual); }
    }
    URL.revokeObjectURL(photoUrl); photoUrl = URL.createObjectURL(blob);
    download.href = preview.src = photoUrl; download.download = `akutoo-m0-${Date.now()}.jpg`;
    download.hidden = preview.hidden = false;
    photoInfo = `${photo.method} · ${photo.canvas.width} × ${photo.canvas.height} · ${(blob.size / 1024).toFixed(1)} KiB · ${number(sharpness)}${photo.fallback ? ` · ${s.fallback}` : ''}`;
    render();
  } catch { text('status', s.failed); }
  finally { busy = false; capture.disabled = stop.disabled = !running; start.disabled = false; }
};
el('copy').onclick = async () => {
  render();
  try { await navigator.clipboard.writeText(report.value); text('status', s.copied); }
  catch { report.focus(); report.select(); text('status', s.copyFailed); }
};
window.addEventListener('pagehide', () => { stopRun(); analysis.close(); URL.revokeObjectURL(photoUrl); });
text('offline', import.meta.env.DEV ? s.offlineDev : s.offlinePending);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => text('offline', s.offlineReady)).catch(() => text('offline', s.offlinePending));
}
render();
