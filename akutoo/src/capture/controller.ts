import {beginGuidedScan,guidedActive,updateGuide,scanFeedback,chooseScanGroup,deferUntrackedSide,stallLevel,type ScanStatus,type ScanCue} from '../session/guided-scan';
import {selectSweepShot,finishSweep,sweepActive,chooseTimedProfile} from '../session/free-sweep';
import {handsFreeStep} from './hands-free';
import {autoCaptureReady} from './auto-ready';
import {poseGuidance, type PoseCue} from './pose-guidance';
import { AnalysisClient } from '../analysis/client';
import type { AnalysisResult } from '../analysis/protocol';
import { expressionMatch } from '../analysis/expressions';
import {measuredGaze} from '../analysis/gaze';
import { poseBin } from '../analysis/metrics';
import { calibrate, evaluateQuality, type QualityResult } from '../gates/quality';
import { s } from '../i18n/strings.en';
import { acceptSlot, advanceSlot, calibrationSample, failSlot, freshProgress, upgradeProgress, readyToCapture, revisit, startHold, type CalibrationWindow } from '../session/progress';
import { elapsedAttempts, resetCause, type Cause } from '../session/attempts';
import type { Shot } from '../session/shotlist';
import { db, type Photo, type Session } from '../storage/db';
import { poseCoverage } from '../session/coverage';
import { putSession, saveCapture } from '../storage/sessions';
import { SessionConflict } from '../storage/recovery-plan';
import { BrowserCamera, jpeg, thumbnail, type CameraSource } from './camera';
import { preferStill } from './still-selection';
import {offerFrame,measuredTarget,type FrameWindow} from './rolling-burst';
import {FrameQueue} from './frame-queue';
import { capturePlan, captureProgress, detailGuide, detailMeasurements, syncDetailBudget } from '../details/plan';
import { saveDetailCapture } from '../storage/details';

export interface CaptureState {
  scan: {status:ScanStatus;cue:ScanCue;target:Shot|undefined}|null; stall:'none'|'help'|'offer';
  session: Session; running: boolean; loading: boolean; paused: boolean; busy: boolean; modelFailed: boolean;
  message: string; seconds: number; result: AnalysisResult | null; quality: QualityResult | null;
  pending: { photo: Photo; full: Blob; thumb: Blob; url: string } | null; camera: 'user' | 'environment';
  retakeFinished: boolean; coveredBins: string[]; autoReady:boolean; holdProgress:number; poseCue:PoseCue|null; countdown:number|null; handsFreeReturning:boolean;
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
interface SweepFrame {index:number;score:number;sharpness:number;canvas:HTMLCanvasElement;result:AnalysisResult;quality:QualityResult;}
export class CaptureController {
  state: CaptureState;
  private camera: CameraSource;
  private analysis?: AnalysisClient;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private calibration: CalibrationWindow = { began: null, values: [] };
  private hold: number | null = null;
  private lastCapture = 0;
  private activeWithoutSave=0;
  private lastActiveTick:number|null=null;
  private frames:FrameWindow<SweepFrame>|null=null;
  private queued=new FrameQueue<SweepFrame>(2,frame=>{frame.canvas.width=0;});
  private processing=false;
  private savingIndex:number|null=null;
  private lastSweepYaw=0;
  private lostSince:number|null=null;
  private previousPose: { yaw: number; pitch: number; time: number } | null = null;
  private disposed = false;
  private countdownTimer?:ReturnType<typeof setInterval>;
  private countdownGeneration=0;
  constructor(private video: HTMLVideoElement, session: Session, private changed: (state: CaptureState) => void, camera?: CameraSource) {
    this.camera = camera ?? new BrowserCamera(video);
    this.state = { scan:null,stall:'none',session: { ...session, progress: session.progress ? upgradeProgress(session.progress) : freshProgress(Date.now()) }, running: false, loading: false, paused: false, busy: false, modelFailed: false, message: s.scanIntro, seconds: 5, result: null, quality: null, pending: null, camera: session.camera ?? 'user', retakeFinished: false, coveredBins: [],autoReady:false,holdProgress:0,poseCue:null,countdown:null,handsFreeReturning:false };
    if(!session.progress&&!session.details?.active&&!session.retakePhotoId)this.state.session.progress=beginGuidedScan(this.state.session.progress!);
    void this.refreshCoverage().catch(() => { this.state.message = s.saveError; this.emit(); });
  }
  private emit() {
    if(!this.state.running||this.state.paused||this.state.busy||this.state.pending||this.state.modelFailed||this.state.countdown!==null||this.progress.guidedScan?.group==='summary'){
      this.state.autoReady=false;this.state.holdProgress=0;this.state.poseCue=null;
    }
    const guided=!this.state.retakeFinished&&!this.state.session.details?.active&&!this.state.session.retakePhotoId&&guidedActive(this.progress);
    this.state.scan=guided?scanFeedback(this.progress,this.state.result?.pose??null,this.state.autoReady,this.state.busy):null;
    if(!this.disposed)this.changed({...this.state});
  }
  private get plan() { return capturePlan(this.state.session); }
  private get continuous() {return guidedActive(this.progress)&&this.progress.guidedScan?.group!=='summary'&&!this.state.session.details?.active&&!this.state.session.retakePhotoId;}
  private clearFrames(){if(this.frames)this.frames.best.canvas.width=0;this.frames=null;this.queued.clear();this.lostSince=null;this.lastSweepYaw=0;}
  private get progress() { return captureProgress(this.state.session); }
  private set progress(value) { if (this.state.session.details?.active) this.state.session.details.progress = value; else this.state.session.progress = value; }
  private get baseline() { return this.state.session.details?.active ? this.state.session.details.baseline : this.state.session.baseline; }
  private set baseline(value) { if (this.state.session.details?.active) this.state.session.details.baseline = value; else this.state.session.baseline = value; }
  private metrics(result: AnalysisResult) { return this.shot?.detail ? detailMeasurements(result) : result.measurements; }
  private measure(source: CanvasImageSource, still = false) { return this.analysis!.measure(source, performance.now(), still, this.shot?.detail ? detailGuide(this.shot.detail) : undefined); }
  private async refreshCoverage() {
    const photos = await db.photos.where('sessionId').equals(this.state.session.id).toArray();
    if (this.disposed) return;
    this.state.coveredBins = poseCoverage(photos).filled; this.emit();
  }
  get shot(): Shot | undefined { return (this.state.retakeFinished || (!this.state.session.retakePhotoId&&!this.state.session.details?.active&&this.progress.guidedScan?.group==='summary'&&!this.progress.revisiting)) ? undefined : this.state.session.retakeShotId ? this.plan.find(shot => shot.id === this.state.session.retakeShotId) : this.plan[this.progress.index]; }
  private async persist() {
    this.state.session = syncDetailBudget(this.state.session);
    this.state.session.updatedAt = Date.now();
    try { await putSession(this.state.session); this.emit(); }
    catch (error) { if (error instanceof SessionConflict) { this.stop(); this.state.message = s.sessionChanged; this.emit(); } throw error; }
  }
  async start(facing: 'user' | 'environment') {
    if (this.state.loading || this.state.busy) return;
    this.stop(); this.disposed = false;
    const generation = this.generation;
    this.state.loading = true; this.state.camera = facing; this.state.message = s.cameraLoading; this.emit();
    try {
      const track = await this.camera.open(facing);
      if (generation !== this.generation) { this.camera.stop(); return; }
      const settings = track.getSettings();
      this.state.session.stream = settings.width && settings.height ? { width: settings.width, height: settings.height } : undefined;
      this.state.camera = settings.facingMode === 'environment' ? 'environment' : settings.facingMode === 'user' ? 'user' : facing;
      track.onended = () => this.interrupt();
      this.state.running = true; this.state.paused = false; this.state.modelFailed = false;
      this.state.session.camera = this.state.camera; this.state.session.status = 'scanning';
      this.baseline = undefined; this.calibration = { began: null, values: [] }; this.state.seconds = 5;
      try { this.analysis = new AnalysisClient(); await this.analysis.load(); }
      catch { this.analysis?.close(); this.analysis = undefined; this.state.modelFailed = true; }
      if (generation !== this.generation) return;
      this.state.message = this.state.modelFailed ? s.manualOnly : s.calibrating;
      await this.persist(); this.schedule(generation);
    } catch (error) { if (error instanceof SessionConflict) this.state.message = s.sessionChanged; else if (generation === this.generation) { this.camera.stop(); this.state.running = false; this.state.message = s.cameraError; } }
    finally { this.state.loading = false; this.emit(); }
  }
  private schedule(generation: number) { if (!this.disposed && generation === this.generation && this.state.running) this.timer = setTimeout(() => void this.tick(generation), 1000 / 15); }
  private async tick(generation: number) {
    if (generation !== this.generation || this.disposed) return;
    const tickNow=performance.now();
    const active=this.state.running&&!this.state.paused&&!this.state.busy&&!this.state.pending&&this.state.countdown===null&&!!this.baseline&&!!this.shot;
    if(active&&this.lastActiveTick!==null)this.activeWithoutSave+=Math.min(1000,tickNow-this.lastActiveTick);
    this.lastActiveTick=active?tickNow:null;this.state.stall=stallLevel(this.activeWithoutSave);
    const attempts = this.progress.attempts, elapsed = elapsedAttempts(attempts, Date.now());
    if (!this.state.busy&&attempts !== elapsed) { this.progress.attempts = elapsed; try { await this.persist(); } catch (error) { this.state.message = error instanceof SessionConflict ? s.sessionChanged : s.saveError; this.emit(); } }
    if (generation !== this.generation) return;
    if (this.state.paused || (this.state.busy&&!this.processing) || this.state.pending || this.state.countdown!==null || !this.analysis || !this.shot) { this.schedule(generation); return; }
    let sampled:HTMLCanvasElement|undefined;
    try {
      this.state.autoReady=false;this.state.holdProgress=0;this.state.poseCue=null;
      // Keep the exact analyzed pixels; a later exposure may be another pose.
      if(this.continuous&&this.baseline)sampled=this.camera.frame();
      const result = await this.measure(sampled??this.video);
      if (generation !== this.generation) return;
      if(this.state.countdown!==null||this.state.paused||this.state.pending||(this.state.busy&&!this.processing)){this.schedule(generation);return;}
      this.state.result = result;
      const now = performance.now();
      if(sampled&&this.baseline){await this.collectFrame(sampled,result,generation);sampled=undefined;this.emit();this.schedule(generation);return;}
      const m = this.metrics(result);
      if (!m) { this.hold=null;this.previousPose=null;this.state.quality = { score: 0, tier: 'D', hardFailure: true, reason: 'invalid' }; this.state.message = s.fix.invalid; this.emit(); this.schedule(generation); return; }
      if (!this.baseline) {
        this.calibration = calibrationSample(this.calibration, now, m.faceCount === 1 && m.clipped <= .1 && (this.shot.detail || Math.abs(result.pose?.yaw ?? 90) <= 10) ? m : null);
        this.state.seconds = Math.max(0, Math.ceil((5000 - (now - (this.calibration.began ?? now))) / 1000));
        this.state.message = m.faceCount === 1 ? this.shot.detail ? s.detailReference : s.calibrating : s.fix.face;
        if (this.calibration.began !== null && now - this.calibration.began >= 5000) {
          this.baseline = calibrate(this.calibration.values.map(value => ({ ...m, ...value }))) ?? undefined;
          await this.persist();
        }
      } else {
        if(!this.state.session.retakePhotoId&&!this.state.session.details?.active){
          const before=this.progress;this.progress=updateGuide(this.progress,result.pose);
          if(before.guidedScan?.phase!==this.progress.guidedScan?.phase||before.guidedScan?.group!==this.progress.guidedScan?.group)await this.persist();
          if(!this.shot){this.emit();this.schedule(generation);return;}
          const selected=selectSweepShot(this.progress,result.pose);
          if(selected!==null&&selected!==this.progress.index){this.progress={...this.progress,index:selected};this.hold=null;this.previousPose=null;}
        }
        const quality = this.grade(result, this.shot); this.state.quality = quality;
        const pose = result.pose;
        const velocity = pose && this.previousPose ? Math.hypot(pose.yaw - this.previousPose.yaw, pose.pitch - this.previousPose.pitch) * 1000 / Math.max(1, now - this.previousPose.time) : Infinity;
        this.previousPose = pose ? { ...pose, time: now } : null;
        const ready = autoCaptureReady({shot:this.shot,pose,quality,velocity,faceRatio:m.faceRatio,expression:expressionMatch(result.blendshapes,this.shot.expression),blendshapes:result.blendshapes});
        this.state.poseCue=poseGuidance({shot:this.shot,pose,quality,faceRatio:m.faceRatio,expression:expressionMatch(result.blendshapes,this.shot.expression),velocity,ready});
        this.hold = startHold(this.hold, ready, now);
        this.state.autoReady=ready;this.state.holdProgress=this.hold===null?0:Math.min(1,(now-this.hold)/500);
        this.state.message = quality.reason ? s.fix[quality.reason] : ready ? s.holdStill : s.shotInstruction(this.shot);
        if (readyToCapture(this.hold, now, this.lastCapture)) { await this.capture(false); }
      }
      this.emit();
    } catch { if (generation === this.generation) { this.clearFrames();this.analysis?.close(); this.analysis = undefined; this.state.modelFailed = true; this.state.message = s.manualOnly; this.emit(); } }
    finally {if(sampled)sampled.width=0;}
    this.schedule(generation);
  }
  private async collectFrame(canvas:HTMLCanvasElement,result:AnalysisResult,generation:number){
    const previousGuide=this.progress.guidedScan;
    // A save owns persisted progress. Live tracking may collect pixels, but must
    // not race its revision or move its target slot while that transaction runs.
    if(!this.processing){
    if(result.pose){this.lastSweepYaw=result.pose.yaw;this.lostSince=null;}
    else {
      this.lostSince??=performance.now();
      // An interaction grace period, not a relaxed photo gate.
      if(performance.now()-this.lostSince>=1000)this.progress=deferUntrackedSide(this.progress,this.lastSweepYaw);
    }
    this.progress=updateGuide(this.progress,result.pose);
    if(previousGuide!==this.progress.guidedScan)await this.persist();
    }
    if(generation!==this.generation||this.state.paused||(this.state.busy&&!this.processing)||this.state.countdown!==null){canvas.width=0;return;}
    const reserved=[...this.queued.indices(),...(this.savingIndex===null?[]:[this.savingIndex])];
    const selection={...this.progress,completed:[...this.progress.completed,...reserved.map(index=>this.plan[index].id)]};
    const index=selectSweepShot(selection,result.pose);
    const target=index===null?this.shot:this.plan[index];
    const quality=target?this.grade(result,target):{score:0,tier:'D' as const,hardFailure:true,reason:'invalid' as const};
    this.state.quality=quality;
    const eligible=index!==null&&!!target&&measuredTarget(target,result.pose)&&!quality.hardFailure&&quality.tier!=='D';
    const frame=eligible?{index,score:quality.score,sharpness:result.measurements?.sharpness??0,canvas,result,quality}:null;
    const batch=offerFrame(this.frames,frame);this.frames=batch.window;
    if(!frame)canvas.width=0;
    for(const discarded of batch.discard)discarded.canvas.width=0;
    this.state.autoReady=eligible;
    if(batch.ready){
      const ready=batch.ready;
      if(generation!==this.generation||this.state.paused){ready.canvas.width=0;this.clearFrames();return;}
      this.queued.offer(ready);
      void this.drainFrames(generation);
    }
  }
  private async drainFrames(generation:number){
    if(this.processing||this.state.busy)return;
    this.processing=true;
    try{
      while(generation===this.generation&&!this.state.paused&&this.state.running&&!this.state.pending){
        const frame=this.queued.take();if(!frame)break;
        const id=this.plan[frame.index].id;
        if(this.progress.completed.includes(id)||this.progress.missed.includes(id)){frame.canvas.width=0;continue;}
        this.savingIndex=frame.index;this.progress={...this.progress,index:frame.index};
        await this.capture(false,frame);
        this.savingIndex=null;
      }
    }finally{
      this.processing=false;this.savingIndex=null;
      if(generation!==this.generation||this.state.paused||!this.state.running)this.clearFrames();
    }
  }
  private grade(result: AnalysisResult, shot: Shot): QualityResult {
    if (!this.baseline) return { score: 0, tier: 'D', hardFailure: true, reason: 'invalid' };
    const measurements = this.metrics(result);
    if (!measurements) return { score: 0, tier: 'D', hardFailure: true, reason: 'invalid' };
    return evaluateQuality({ ...measurements, angleError: result.pose ? Math.hypot(result.pose.yaw - shot.yaw, result.pose.pitch - shot.pitch) : 90, expressionMatch: expressionMatch(result.blendshapes, shot.expression) }, this.baseline, this.progress.attempts.relaxed, shot.detail ? .7 : undefined);
  }
  async capture(manual = true, collected?:SweepFrame) {
    const shot = this.shot;
    if (!shot || !this.state.running || this.state.busy || this.state.loading || this.state.pending) {if(collected)collected.canvas.width=0;return;}
    if(!collected)this.clearFrames();
    const generation = this.generation;
    const interrupted = () => { if (generation !== this.generation) throw new DOMException('Capture interrupted', 'AbortError'); };
    this.state.busy = true;this.lastActiveTick=null; this.hold = null; this.emit();
    let best: { canvas: HTMLCanvasElement; result: AnalysisResult | null; quality: QualityResult } | null = collected??null;
    try {
      const began = performance.now();
      for (let i = 0; !collected && i < 5; i++) {
        interrupted();
        const canvas = this.camera.frame();
        let result: AnalysisResult | null = null;
        if (this.analysis) { try { result = await this.measure(canvas, true); } catch { this.state.modelFailed = true; } }
        const quality = result ? this.grade(result, shot) : { score: 0, tier: 'D' as const, hardFailure: true, reason: 'invalid' as const };
        if (!best || quality.score > best.quality.score || (quality.score === best.quality.score && (result ? this.metrics(result)?.sharpness ?? 0 : 0) > (best.result ? this.metrics(best.result)?.sharpness ?? 0 : 0))) {
          if (best) best.canvas.width = 0; best = { canvas, result, quality };
        } else canvas.width = 0;
        if (i < 4) await wait(Math.max(0, began + (i + 1) * 125 - performance.now()));
      }
      interrupted();
      if (!best) throw new Error('No capture');
      let full = await jpeg(best.canvas), method: 'canvas' | 'takePhoto' = 'canvas';
      const measureEncoded = async (candidate: NonNullable<typeof best>, encoded: Blob) => {
        const decoded = await createImageBitmap(encoded);
        try { candidate.canvas.getContext('2d')!.drawImage(decoded, 0, 0); } finally { decoded.close(); }
        if (this.analysis) { try { candidate.result = await this.measure(candidate.canvas, true); candidate.quality = this.grade(candidate.result, shot); } catch { candidate.result = null; candidate.quality = { score:0, tier:'D', hardFailure:true, reason:'invalid' }; } }
      };
      await measureEncoded(best, full);
      // JPEG reanalysis must support the actual angle, not stale live tracking.
      if(collected&&(!measuredTarget(shot,best.result?.pose??null)||best.quality.hardFailure||best.quality.tier==='D')){
        best.quality={score:0,tier:'D',hardFailure:true,reason:best.quality.reason??'invalid'};
      }
      interrupted();
      if (!collected && this.analysis && this.baseline && this.camera.still) {
        const canvas = await this.camera.still();
        if (canvas) {
          try {
            interrupted();
            const candidate = { canvas, result: null as AnalysisResult | null, quality: { score:0, tier:'D' as const, hardFailure:true, reason:'invalid' as const } as QualityResult };
            const encoded = await jpeg(canvas); await measureEncoded(candidate, encoded); interrupted();
            const describe = (value: typeof candidate) => ({ width:value.canvas.width, height:value.canvas.height, sharpness:value.result ? this.metrics(value.result)?.sharpness ?? NaN : NaN, quality:value.quality });
            if (preferStill(describe(best), describe(candidate))) { best.canvas.width = 0; best = candidate; full = encoded; method = 'takePhoto'; }
          } catch { interrupted(); /* Optional still failure keeps the measured burst. */ }
          finally { if (best.canvas !== canvas) canvas.width = 0; }
        }
      }
      interrupted();
      const thumb = await jpeg(thumbnail(best.canvas));
      interrupted();
      // Check the final selected JPEG, including a sensor still if one replaced it.
      if(!manual&&shot.direction&&(!measuredTarget(shot,best.result?.pose??null)||measuredGaze(best.result?.blendshapes??{})!==shot.direction)){
        this.state.message=s.shotInstruction(shot);return;
      }
      const id = crypto.randomUUID();
      const photo: Photo = { id, sessionId: this.state.session.id, opfsPath: `sessions/${this.state.session.id}/${id}.jpg`, thumbPath: `thumbs/${id}.jpg`, width: best.canvas.width, height: best.canvas.height, createdAt: Date.now(), source: 'captured', shotId: shot.id,
        binId: !shot.detail && best.result?.pose ? poseBin(best.result.pose.yaw, best.result.pose.pitch) : undefined, pose: best.result?.pose ?? null, poseConvention: best.result?.pose ? 'subject-left-negative-v2' : undefined, captureTrigger:this.state.countdown!==null?'countdown':manual?'manual':'automatic', quality: best.quality, measurements: best.result ? this.metrics(best.result) ?? undefined : undefined, hash: shot.detail ? null : best.result?.hash ?? null, camera: this.state.camera, method, override: false,
        ...(shot.direction?{gaze:{direction:measuredGaze(best.result?.blendshapes??{}),method:'blendshapes-v1' as const,coefficients:Object.fromEntries(Object.entries(best.result?.blendshapes??{}).filter(([key])=>key.startsWith('eyeLook')||key.startsWith('eyeBlink')))}}:{}),
        streamDimensions: this.state.session.stream ? { ...this.state.session.stream } : undefined, requestedYaw: shot.detail ? undefined : shot.yaw, requestedPitch: shot.detail ? undefined : shot.pitch, expression: shot.expression, direction: shot.direction, context: shot.context, relaxed: this.progress.attempts.relaxed,
        bestAttempt: this.progress.attempts.slotAttempts >= 2 && best.quality.tier === 'C', baseline: this.baseline ? { ...this.baseline } : undefined, ratios: shot.detail ? null : best.result?.ratios ?? null,
        ...(shot.detail ? { detail: { instruction: shot.detail, target: best.result?.target ?? null, faceMeasurements: best.result?.measurements ?? null, reviewed: false } } : {}) };
      if (photo.measurements && best.result) photo.measurements = { ...photo.measurements, angleError: best.result.pose ? Math.hypot(best.result.pose.yaw - shot.yaw, best.result.pose.pitch - shot.pitch) : 90, expressionMatch: expressionMatch(best.result.blendshapes, shot.expression) };
      best.canvas.width = 0;
      this.lastCapture = performance.now();
      if (photo.quality!.hardFailure || photo.quality!.tier === 'D') {
        this.state.pending = manual ? { photo, full, thumb, url: URL.createObjectURL(full) } : null;
        await this.failed(photo.quality!.reason ?? 'focus');
      } else await this.commit(photo, full, thumb);
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) { this.state.message = error instanceof SessionConflict ? s.sessionChanged : s.saveError; this.state.paused = true; if (error instanceof SessionConflict) this.stop(); } }
    finally { if (best) best.canvas.width = 0; this.state.busy = false; this.emit(); }
  }
  private async failed(reason: string) {
    const cause: Cause = reason === 'light' ? 'light' : reason === 'occlusion' ? 'occlusion' : reason === 'resolution' || reason === 'framing' ? 'distance' : 'focus';
    const p = failSlot(this.progress, cause, Date.now()); this.progress = p;
    const stats = this.state.session.stats ?? { captures: 0, failures: 0, sessionFixes: 0, causes: {} };
    stats.failures++; stats.causes[cause] = (stats.causes[cause] ?? 0) + 1;
    if (p.attempts.sessionFix) { stats.sessionFixes++; this.state.paused = true; }
    this.state.session.stats = stats;
    this.state.message = p.attempts.promptRetake === false ? s.retryBudget : s.fix[reason as keyof typeof s.fix] ?? s.fix.focus;
    if ((p.attempts.moveOn || p.attempts.promptRetake === false) && !this.state.pending && !p.attempts.sessionFix) await this.skip('failed');
    await this.persist();
  }
  private async commit(photo: Photo, full: Blob, thumb: Blob) {
    const stats = this.state.session.stats ?? { captures: 0, failures: 0, sessionFixes: 0, causes: {} };
    const wasRetake = !!this.state.session.retakePhotoId;
    const result = photo.detail ? await saveDetailCapture(this.state.session, photo, full, thumb) : await saveCapture(this.state.session, photo, full, thumb);
    this.state.session = result.session;
    await this.refreshCoverage();
    if (result.saved) { this.activeWithoutSave=0;this.state.stall='none';this.state.session.stats = { ...stats, captures: stats.captures + 1 }; await this.persist(); }
    this.state.message = result.saved ? s.photoSaved : result.outcome === 'kept-retake' ? s.earlierKept : '';
    this.state.retakeFinished = wasRetake;
    this.clearPending(); this.previousPose = null;this.state.autoReady=false;this.state.holdProgress=0;this.state.poseCue=null;
    if (photo.detail) { this.baseline = undefined; this.calibration = { began: null, values: [] }; this.state.seconds = 5; this.state.quality = null; }
    if (!this.shot && (wasRetake||this.progress.guidedScan?.group!=='summary')) { this.stop(this.state.countdown!==null); this.state.session.status = 'review'; await this.persist(); }
    this.emit();
  }
  async keepAnyway() {
    this.state.handsFreeReturning=false;
    const pending = this.state.pending; if (!pending || this.state.busy) return;
    this.state.busy = true; this.emit();
    try { await this.commit({ ...pending.photo, override: true }, pending.full, pending.thumb); this.state.paused = false; }
    catch (error) { this.state.message = error instanceof SessionConflict ? s.sessionChanged : s.saveError; if (error instanceof SessionConflict) this.stop(); }
    finally { this.state.busy = false; this.emit(); }
  }
  clearPending() { if (this.state.pending) URL.revokeObjectURL(this.state.pending.url); this.state.pending = null; }
  async skip(reason: string) {
    this.cancelCountdown();this.clearPending(); this.hold = null;
    if (this.state.session.retakePhotoId) {
      this.state.session.retakePhotoId = undefined; this.state.session.retakeShotId = undefined; this.state.retakeFinished = true;
      this.stop(); this.state.session.status = 'review'; await this.persist(); return;
    }
    this.progress = advanceSlot(this.progress, reason, this.plan); this.state.paused = false;
    if (this.state.session.details?.active) { this.baseline = undefined; this.calibration = { began: null, values: [] }; this.state.seconds = 5; this.state.quality = null; }
    this.progress.attempts = resetCause(this.progress.attempts);
    if (!this.shot && this.progress.guidedScan?.group!=='summary') { this.stop(); this.state.session.status = 'review'; }
    await this.persist();
  }
  async checkAgain() {
    this.clearPending();
    if (this.progress.attempts.moveOn || this.progress.attempts.promptRetake === false) { await this.skip('failed'); return; }
    this.progress.attempts = resetCause(this.progress.attempts); this.state.paused = false; await this.persist();
  }
  async retryCapture() {
    this.state.handsFreeReturning=false;
    this.clearPending();
    if (this.progress.attempts.moveOn || this.progress.attempts.promptRetake === false) { await this.skip('failed'); return; }
    this.state.paused = false; this.emit();
  }
  cancelCountdown() {
    this.clearFrames();
    this.countdownGeneration++;clearInterval(this.countdownTimer);this.countdownTimer=undefined;
    this.state.countdown=null;this.state.handsFreeReturning=false;
  }
  async startHandsFree(yaw?:-90|90) {
    if(!this.state.running||this.state.loading||this.state.busy||this.state.pending||!this.shot||(!this.baseline&&!this.state.modelFailed)||this.progress.attempts.moveOn||this.progress.attempts.sessionFix)return;
    if(yaw!==undefined&&(this.state.session.retakePhotoId||this.state.session.details?.active||!sweepActive(this.progress)))return;
    this.cancelCountdown();const token=this.countdownGeneration;
    if(yaw!==undefined){const selected=chooseTimedProfile(this.progress,yaw);if(!selected)return;this.progress=selected;}
    this.state.paused=false;this.hold=null;this.state.countdown=7;this.emit();
    try{await this.persist();}catch{this.cancelCountdown();this.state.paused=true;this.state.message=s.saveError;this.emit();return;}
    if(token!==this.countdownGeneration||!this.state.running)return;
    const began=performance.now();
    this.countdownTimer=setInterval(()=>{
      if(token!==this.countdownGeneration||!this.state.running||this.state.paused){this.cancelCountdown();this.emit();return;}
      const step=handsFreeStep(began,performance.now());
      if(this.state.countdown!==step.remaining){this.state.countdown=step.remaining;this.emit();}
      if(step.capture){
        clearInterval(this.countdownTimer);this.countdownTimer=undefined;
        void this.capture(true).then(()=>{
          if(token!==this.countdownGeneration)return;
          this.state.countdown=null;this.state.handsFreeReturning=true;this.state.paused=true;this.emit();
        });
      }
    },100);
  }
  async chooseGroup(group:'extra'|'expressions'|'summary'){
    if(this.state.busy||this.state.pending||this.state.session.details?.active||this.state.session.retakePhotoId)return;
    this.cancelCountdown();this.hold=null;this.previousPose=null;this.progress=chooseScanGroup(this.progress,group);
    this.state.paused=false;this.activeWithoutSave=0;this.lastActiveTick=null;this.state.stall='none';await this.persist();
  }
  async enableFreeSweep(){if(this.state.busy||this.state.pending||this.state.session.retakePhotoId||this.state.session.details?.active)return;this.progress=beginGuidedScan({...this.progress,freeSweep:true});await this.persist();}
  async finishFreeSweep(){if(this.state.busy||this.state.pending||this.state.session.retakePhotoId||this.state.session.details?.active)return;this.cancelCountdown();this.hold=null;this.progress=guidedActive(this.progress)?chooseScanGroup(this.progress,'summary'):finishSweep(this.progress);await this.persist();}
  async revisit() { this.progress = revisit(this.progress, this.plan); await this.persist(); }
  pause() { this.cancelCountdown(); this.state.paused = !this.state.paused; this.lastActiveTick=null;this.activeWithoutSave=0;this.state.stall='none';this.hold = null; this.emit(); }
  interrupt() { if (!this.state.running && !this.state.loading) return; this.stop(); this.state.message = s.cameraInterrupted; this.emit(); }
  stop(preserveCountdown=false) { this.clearFrames();if(!preserveCountdown)this.cancelCountdown(); this.generation++;this.lastActiveTick=null; clearTimeout(this.timer); this.camera.stop(); this.analysis?.close(); this.analysis = undefined; this.state.running = false; this.hold = null; this.previousPose = null; }
  dispose() { this.disposed = true; this.stop(); this.clearPending(); }
}
