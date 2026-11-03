import {speakGuidance} from '../audio/guidance';
import {loadPreferences} from '../settings/store';
export class SoloEffects {
    private voiceURI:string|null=null;
    private audio?: AudioContext;
    private wake?: WakeLockSentinel;
    audioReady = false;
    wakeReady = false;
    portraitLocked = false;
    async enable() { const preferences=loadPreferences().then(value=>{this.voiceURI=value.voiceURI;}).catch(()=>{}); try {
        this.audio ??= new AudioContext();
        await this.audio.resume();
        this.audioReady = this.audio.state === 'running';
    }
    catch {
        this.audioReady = false;
    } await preferences; }
    speak(text: string) {speakGuidance(text,this.voiceURI);}
    tone(kind: 'turn' | 'hold' | 'capture') { if (!this.audioReady || !this.audio)
        return; const node = this.audio.createOscillator(), gain = this.audio.createGain(); node.frequency.value = kind === 'turn' ? 440 : kind === 'hold' ? 660 : 880; gain.gain.setValueAtTime(.12, this.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, this.audio.currentTime + .15); node.connect(gain); gain.connect(this.audio.destination); node.start(); node.stop(this.audio.currentTime + .16); }
    async keepAwake() { try {
        this.wake = await navigator.wakeLock?.request('screen');
        this.wakeReady = !!this.wake;
        this.wake?.addEventListener('release', () => { this.wakeReady = false; });
    }
    catch {
        this.wakeReady = false;
    } try {
        await (screen.orientation as ScreenOrientation & {
            lock?: (mode: string) => Promise<void>;
        }).lock?.('portrait');
        this.portraitLocked = !!(screen.orientation as any).lock;
    }
    catch {
        this.portraitLocked = false;
    } }
    stop() { if ('speechSynthesis' in window)
        speechSynthesis.cancel(); void this.wake?.release().catch(() => undefined); this.wake = undefined; this.wakeReady = false; }
    close() { this.stop(); void this.audio?.close().catch(() => undefined); this.audio = undefined; this.audioReady = false; }
}
