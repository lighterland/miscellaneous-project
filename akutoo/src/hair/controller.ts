import { HairClient } from './client';
import { AnalysisClient } from '../analysis/client';
import { BrowserCamera, jpeg, thumbnail, type CameraSource } from '../capture/camera';
import { gradeHair, hairBaseline } from './quality';
import { freshHair } from './state';
import { hairShots, type HairShot } from './plan';
import { hairPattern } from './profile';
import { hairAttemptState, revisitHairShot } from './attempts';
import { beginRound, advanceRound, finishAngle, stopRound, redoRound, rotation, type Round } from '../solo/round';
import { SoloEffects } from '../solo/effects';
import { putSession } from '../storage/sessions';
import { saveHairPhoto } from '../storage/hair';
import type { Session, Photo } from '../storage/db';
import type { HairAnalysis } from './protocol';
import type { QualityResult } from '../gates/quality';
import { failSlot } from '../session/progress';
import { nextSlot, resetCause } from '../session/attempts';
import { s } from '../i18n/strings.en';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export interface HairState {
    session: Session;
    stage: 'choice' | 'mount' | 'scan' | 'summary';
    running: boolean;
    loading: boolean;
    busy: boolean;
    modelFailed: boolean;
    round: Round | null;
    observation: HairAnalysis | null;
    message: string;
    seconds: number;
    selected: string;
    pending: {
        photo: Photo;
        full: Blob;
        thumb: Blob;
        url: string;
    } | null;
}
export class HairController {
    state: HairState;
    effects = new SoloEffects();
    private camera: CameraSource;
    private hair?: HairClient;
    private face?: AnalysisClient;
    private timer?: ReturnType<typeof setTimeout>;
    private disposed = false;
    private generation = 0;
    private reference: {
        began: number;
        values: {
            sharpness: number;
            exposure: number;
        }[];
    } | null = null;
    private writes = Promise.resolve();
    private lastSecond: number | null = null;
    constructor(private video: HTMLVideoElement, session: Session, private changed: (value: HairState) => void, camera?: CameraSource) { this.camera = camera ?? new BrowserCamera(video); this.state = { session: { ...session, hair: session.hair ?? freshHair() }, stage: session.retakePhotoId ? 'mount' : 'choice', running: false, loading: false, busy: false, modelFailed: false, round: null, observation: null, message: '', seconds: 5, selected: session.retakeShotId ?? 'angle-front', pending: null }; this.schedule(); }
    get set() { const h = this.state.session.hair!; return h.sets[h.style] ??= { results: {}, colors: {} }; }
    private emit() { if (!this.disposed)
        this.changed({ ...this.state }); }
    private persist() { this.state.session.updatedAt = Date.now(); const snapshot = structuredClone(this.state.session); this.writes = this.writes.then(async () => { snapshot.revision = this.state.session.revision; await putSession(snapshot); this.state.session.revision = snapshot.revision; }); return this.writes; }
    async configure(patch: Partial<NonNullable<Session['hair']>>) { if (this.state.busy || this.state.loading)
        return; this.stopCamera(); Object.assign(this.state.session.hair!, patch); this.state.round = null; this.state.stage = 'mount'; await this.persist(); this.emit(); }
    mount() { this.state.stage = 'mount'; this.emit(); }
    async start(facing: 'user' | 'environment') {
        if (this.state.loading || this.state.busy)
            return;
        this.stopCamera();
        const generation = this.generation;
        this.state.loading = true;
        this.state.message = s.cameraLoading;
        this.emit();
        try {
            const track = await this.camera.open(facing);
            if (generation !== this.generation)
                return;
            const settings = track.getSettings();
            this.state.session.camera = settings.facingMode === 'environment' ? 'environment' : settings.facingMode === 'user' ? 'user' : facing;
            this.state.session.stream = settings.width && settings.height ? { width: settings.width, height: settings.height } : undefined;
            track.onended = () => this.interrupt();
            this.state.running = true;
            this.state.modelFailed = false;
            this.set.baseline = undefined;
            this.reference = null;
            this.state.seconds = 5;
            try {
                this.hair = new HairClient();
                await this.hair.load();
            }
            catch {
                this.hair?.close();
                this.hair = undefined;
                this.state.modelFailed = true;
            }
            try {
                this.face = new AnalysisClient();
                await this.face.load();
            }
            catch {
                this.face?.close();
                this.face = undefined;
            }
            if (generation !== this.generation)
                return;
            this.state.message = this.hair ? s.hairCalibrating : s.hairManualOnly;
            await this.persist();
        }
        catch {
            this.stopCamera();
            this.state.message = s.cameraError;
        }
        finally {
            this.state.loading = false;
            this.emit();
        }
    }
    private schedule() { if (!this.disposed)
        this.timer = setTimeout(() => void this.tick(), 100); }
    private async tick() {
        try {
            const round = this.state.round;
            if (round && !['done', 'stopped'].includes(round.phase)) {
                const second = Number.isFinite(round.deadline) ? Math.ceil((round.deadline - performance.now()) / 1000) : 0;
                if (second !== this.lastSecond) {
                    this.lastSecond = second;
                    this.emit();
                }
                const next = advanceRound(round, performance.now());
                if (next !== round) {
                    this.state.round = next;
                    this.cue(next);
                    this.emit();
                }
                if (this.state.round?.phase === 'capture' && !this.state.round.rehearsal && !this.state.busy) {
                    const shot = hairShots(this.state.session.hair!.style).find(item => item.id === `angle-${this.state.round!.angle}`)!;
                    await this.capture(shot, false);
                }
                if (this.state.round?.phase === 'done') {
                    this.state.stage = 'summary';
                    this.state.message = this.state.round.rehearsal ? s.practiceDone : s.roundDone;
                    this.effects.stop();
                    this.emit();
                }
            }
            else if (this.state.running && this.hair && !this.state.loading && !this.state.busy && !this.state.pending && this.state.stage === 'mount') {
                const generation = this.generation, frame = this.camera.frame();
                try {
                    const result = await this.hair.measure(frame);
                    if (generation !== this.generation)
                        return;
                    this.state.observation = result;
                    if (!this.set.baseline) {
                        const now = performance.now();
                        if ((result.targetArea??0) > 0 && (result.sharpness ?? 0) > 0 && (result.exposure ?? 0) > 0 && (result.brightClipped ?? 1) <= .02) {
                            this.reference ??= { began: now, values: [] };
                            this.reference.values.push({ sharpness: result.sharpness!, exposure: result.exposure! });
                            this.state.seconds = Math.max(0, Math.ceil((5000 - (now - this.reference.began)) / 1000));
                            if (this.state.seconds === 0) {
                                this.set.baseline = hairBaseline(this.reference.values) ?? undefined;
                                await this.persist();
                                this.state.message = s.hairReferenceReady;
                            }
                        }
                        else {
                            this.reference = null;
                            this.state.seconds = 5;
                            this.state.message = s.hairReferenceMissing;
                        }
                    }
                    this.emit();
                }
                finally {
                    frame.width = 0;
                }
            }
        }
        catch {
            this.state.message = s.saveError;
            this.state.round = this.state.round ? stopRound(this.state.round) : null;
            this.emit();
        }
        finally {
            this.schedule();
        }
    }
    private cue(round: Round) { if (round.phase === 'turn') {
        this.effects.tone('turn');
        const move=rotation(round.cursor?round.queue[round.cursor-1]:null,round.angle!);
        this.effects.speak(move.degrees?s.soloRotate(move.degrees,move.direction):s.hairAngles.front);
    } if (round.phase === 'hold') {
        this.effects.tone('hold');
        this.effects.speak(s.soloHold);
    } if (round.phase === 'capture')
        this.effects.tone('capture'); }
    async begin(rehearsal: boolean, redo = false) { if (this.state.busy || this.state.loading || (!rehearsal && !this.state.running))
        return; await this.effects.enable(); await this.effects.keepAwake(); const h = this.state.session.hair!; let round = beginRound({ assistance: h.assistance, pace: h.pace, rehearsal }, performance.now()); if (!rehearsal) {
        this.state.session.progress!.attempts = resetCause(this.state.session.progress!.attempts);
        for (const [id, result] of Object.entries(this.set.results))
            if (id.startsWith('angle-'))
                round.results[id.slice(6) as NonNullable<Round['angle']>] = result;
        if (redo || Object.keys(round.results).length)
            round = redoRound(round, performance.now());
        round.queue = round.queue.filter(angle => (this.set.attempts?.[`angle-${angle}`] ?? 0) < 3);
        if (!round.queue.length) {
            round.phase = 'done';
            round.angle = null;
        }
        else
            round.angle = round.queue[0];
    } this.state.round = round; this.state.stage = round.phase === 'done' ? 'summary' : 'scan'; this.state.message = round.phase === 'done' ? s.roundDone : ''; this.effects.speak(s.soloPrepare); this.emit(); }
    async capture(shot: HairShot, manual = true) {
        if (!this.state.running || this.state.busy || this.state.loading || this.state.pending || hairAttemptState(this.set, shot.id).exhausted)
            return;
        const generation = this.generation;
        const guard = () => { if (generation !== this.generation)
            throw new DOMException('Interrupted', 'AbortError'); };
        this.state.busy = true;
        this.emit();
        let best: {
            canvas: HTMLCanvasElement;
            analysis: HairAnalysis;
            quality: QualityResult;
        } | null = null;
        try {
            if (manual && shot.kind === 'texture') {
                this.state.message = s.soloHold;
                this.effects.speak(s.soloHold);
                await wait(3000);
                guard();
            }
            const began = performance.now();
            for (let i = 0; i < 5; i++) {
                guard();
                const canvas = this.camera.frame();
                const missing: HairAnalysis = { targetArea: null, bounds: null, sharpness: null, exposure: null, brightClipped: null, clipped: null, swatch: null, personCount: null, occlusionVerified: false, sourceDimensions: { width: canvas.width, height: canvas.height }, durationMs: null };
                let analysis = missing;
                try {
                    if (this.hair)
                        analysis = await this.hair.measure(canvas);
                }
                catch { /* Unknown analysis remains unknown. */ }
                const quality = gradeHair(analysis, this.set.baseline ?? null, shot.kind,false,null,this.state.session.progress!.attempts.relaxed);
                if (!best || quality.score > best.quality.score || quality.score === best.quality.score && (analysis.sharpness ?? 0) > (best.analysis.sharpness ?? 0)) {
                    if (best)
                        best.canvas.width = 0;
                    best = { canvas, analysis, quality };
                }
                else
                    canvas.width = 0;
                if (i < 4)
                    await wait(Math.max(0, began + (i + 1) * 125 - performance.now()));
            }
            guard();
            if (!best)
                throw new Error('No frame');
            const full = await jpeg(best.canvas);
            const decoded = await createImageBitmap(full);
            try {
                best.canvas.getContext('2d')!.drawImage(decoded, 0, 0);
            }
            finally {
                decoded.close();
            }
            if (this.hair) {
                try {
                    best.analysis = await this.hair.measure(best.canvas);
                }
                catch {
                    best.analysis = { ...best.analysis, targetArea: null, bounds: null, sharpness: null, exposure: null, brightClipped: null, clipped: null, swatch: null, durationMs: null, colorClusters:undefined, colorCast:undefined };
                    this.hair.close();
                    this.hair = undefined;
                    this.state.modelFailed = true;
                }
            }
            let visibleFaces: number | null = null;
            try {
                if (this.face)
                    visibleFaces = (await this.face.measure(best.canvas, performance.now(), true)).measurements.faceCount;
            }
            catch { /* Person count is not inferred from a missing face. */ }
            best.quality = gradeHair(best.analysis, this.set.baseline ?? null, shot.kind, false, visibleFaces,this.state.session.progress!.attempts.relaxed);
            const thumb = await jpeg(thumbnail(best.canvas));
            guard();
            const id = crypto.randomUUID(), h = this.state.session.hair!;
            const photo: Photo = { id, sessionId: this.state.session.id, opfsPath: `sessions/${this.state.session.id}/${id}.jpg`, thumbPath: `thumbs/${id}.jpg`, width: best.canvas.width, height: best.canvas.height, createdAt: Date.now(), source: 'captured', shotId: `hair-${h.style}-${shot.id}`, method: 'canvas', camera: this.state.session.camera, streamDimensions: this.state.session.stream, quality: best.quality, override: false, relaxed:this.state.session.progress!.attempts.relaxed, hair: { style: h.style, shotId: shot.id, kind: shot.kind, region: shot.region, angle: shot.angle, labelSource: 'instruction', analysis: best.analysis, baseline: this.set.baseline ?? null, visibleFaces, reviewed: false } };
            photo.bestAttempt = (this.set.attempts?.[shot.id] ?? 0) >= 2 && best.quality.tier === 'C';
            if (best.quality.hardFailure || best.quality.tier === 'D') {
                if (manual)
                    this.state.pending = { photo, full, thumb, url: URL.createObjectURL(full) };
                await this.failure(shot, best.quality.reason ?? 'invalid');
            }
            else
                await this.commit(photo, full, thumb);
        }
        catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
                this.interrupt();
                this.state.message = s.saveError;
            }
        }
        finally {
            if (best)
                best.canvas.width = 0;
            this.state.busy = false;
            this.emit();
        }
    }
    private async failure(shot: HairShot, reason: string) { this.set.attempts ??= {}; this.set.attempts[shot.id] = (this.set.attempts[shot.id] ?? 0) + 1; if (this.set.results[shot.id]?.status !== 'saved') this.set.results[shot.id] = { status: 'failed', reason }; let p = failSlot(this.state.session.progress!, reason === 'light' ? 'light' : reason === 'face' ? 'occlusion' : 'focus', Date.now()); this.state.session.progress = { ...p, attempts: nextSlot(p.attempts) }; this.state.message = s.hairFailure[reason as keyof typeof s.hairFailure] ?? s.hairFailure.invalid; if (this.state.round?.phase === 'capture')
        this.state.round = finishAngle(this.state.round, { status: 'failed', reason }, performance.now());
        if (p.attempts.promptRetake === false) this.state.message = s.retryBudget;
        if (p.attempts.sessionFix) {
        this.state.round = this.state.round ? stopRound(this.state.round) : null;
        this.state.stage = 'summary';
        this.state.message = s.sessionFixTitle + ' ' + this.state.message;
        this.effects.stop();
    } await this.persist(); }
    private async commit(photo: Photo, full: Blob, thumb: Blob) { await this.writes; const result = await saveHairPhoto(this.state.session, photo, full, thumb); this.state.session = result.session; this.state.session.progress!.attempts = resetCause(this.state.session.progress!.attempts); if (this.state.round?.phase === 'capture')
        this.state.round = finishAngle(this.state.round, { status: 'saved', photoId: result.saved ? photo.id : (this.set.results[photo.hair!.shotId] as {
                photoId: string;
            }).photoId }, performance.now()); if (!this.state.round || ['done', 'stopped'].includes(this.state.round.phase)) this.state.stage = 'summary'; this.clearPending(); this.state.message = result.saved ? s.hairShotSaved : s.earlierKept; await this.persist(); }
    async keep() { if (!this.state.pending || this.state.busy)
        return; this.state.busy = true; const p = this.state.pending; try {
        await this.commit({ ...p.photo, override: true }, p.full, p.thumb);
    }
    catch {
        this.state.message = s.saveError;
    }
    finally {
        this.state.busy = false;
        this.emit();
    } }
    clearPending() { if (this.state.pending)
        URL.revokeObjectURL(this.state.pending.url); this.state.pending = null; this.emit(); }
    pause() { this.generation++; if (this.state.round)
        this.state.round = stopRound(this.state.round); this.state.stage = 'summary'; this.effects.stop(); this.emit(); }
    select(id: string) { this.state.selected = id; if (id.startsWith('texture-') && this.state.session.camera === 'environment')
        this.interrupt(); this.emit(); }
    async revisit(id: string) {
        if (this.state.busy || this.state.loading || this.state.pending || (this.state.round && !['done', 'stopped'].includes(this.state.round.phase))) return;
        const h = this.state.session.hair!;
        h.sets[h.style] = revisitHairShot(this.set, id);
        this.emit();
        await this.persist();
    }
    async pattern(family: string, subtype = '') { if (this.state.busy || this.state.loading || (this.state.round && !['done','stopped'].includes(this.state.round.phase))) return; this.set.pattern = hairPattern(family,subtype); this.emit(); await this.persist(); }
    async length(enabled: boolean) { if (this.state.busy || this.state.loading || (this.state.round && !['done','stopped'].includes(this.state.round.phase))) return; this.set.includeLength=enabled; if (!enabled&&this.state.selected==='length') this.state.selected='angle-front'; this.emit(); await this.persist(); }
    color(region: string, hex: string) { if (!/^#[0-9a-f]{6}$/i.test(hex))
        return; const value = this.set.colors[region]; if (value) {
        this.set.colors[region] = { ...value, hex, confirmed: false };
        this.emit();
    } }
    async confirmColor(region: string) { const value = this.set.colors[region]; if (!value || !/^#[0-9a-f]{6}$/i.test(value.hex))
        throw new Error('Invalid color'); value.confirmed = true; await this.persist(); this.emit(); }
    colorName(region: string, name: string) { const value=this.set.colors[region]; if (!value) return; this.set.colors[region]={...value,name:name.slice(0,80),nameSource:'user',confirmed:false}; this.emit(); }
    colorRole(region: string, role: string) {
        const value=this.set.colors[region];
        if (!value || !['','base','highlight','gray'].includes(role)) return;
        this.set.colors[region]={...value,role:role ? role as 'base'|'highlight'|'gray' : undefined,roleSource:role?'user':undefined,confirmed:false}; this.emit();
    }
    private stopCamera() { this.generation++; this.camera.stop(); this.hair?.close(); this.face?.close(); this.hair = undefined; this.face = undefined; this.state.running = false; this.effects.stop(); }
    interrupt() { this.stopCamera(); if (this.state.round)
        this.state.round = stopRound(this.state.round); this.state.stage = 'mount'; this.state.message = s.hairInterrupted; this.emit(); }
    async leave() { this.stopCamera(); await this.writes; this.state.session.status = 'review'; await this.persist(); }
    dispose() { this.disposed = true; clearTimeout(this.timer); this.stopCamera(); this.clearPending(); this.effects.close(); }
}
