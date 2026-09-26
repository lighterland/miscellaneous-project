// Web Audio API Synthesizer Engine
// Provides zero-latency, zero-dependency sound effects & 8-bit music

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.bgmPlaying = false;
        this.bgmTimeout = null;
        this.activeOscillators = [];
    }

    async init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            try {
                await this.ctx.resume();
            } catch (e) {
                console.warn('Audio resume error:', e);
            }
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted && this.bgmPlaying) {
            this.stopBGM();
        }
        return this.muted;
    }

    // Comedic Wooden Knock on Yurt Door
    playKnock() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        [0, 0.12, 0.28].forEach((delay) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, now + delay);
            osc.frequency.exponentialRampToValueAtTime(40, now + delay + 0.08);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(300, now + delay);

            gain.gain.setValueAtTime(0.7, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + delay);
            osc.stop(now + delay + 0.09);
        });
    }

    // Intercom static & activation chirp
    playIntercomBeep() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1200, now + 0.05);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // Flying Slipper Whoosh + Whack!
    playSlipperWhack() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;

        // 1. Whoosh (Noise filter sweep)
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
        filter.Q.value = 3;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        whiteNoise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        whiteNoise.start(now);

        // 2. Heavy Comedic THWACK! (Impact at 0.22s)
        const hitTime = now + 0.22;
        const hitOsc = this.ctx.createOscillator();
        const hitGain = this.ctx.createGain();

        hitOsc.type = 'sine';
        hitOsc.frequency.setValueAtTime(180, hitTime);
        hitOsc.frequency.exponentialRampToValueAtTime(30, hitTime + 0.15);

        hitGain.gain.setValueAtTime(1.0, hitTime);
        hitGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.2);

        hitOsc.connect(hitGain);
        hitGain.connect(this.ctx.destination);

        hitOsc.start(hitTime);
        hitOsc.stop(hitTime + 0.22);

        // Slap snap
        const slapOsc = this.ctx.createOscillator();
        const slapGain = this.ctx.createGain();
        slapOsc.type = 'sawtooth';
        slapOsc.frequency.setValueAtTime(500, hitTime);
        slapOsc.frequency.exponentialRampToValueAtTime(80, hitTime + 0.08);

        slapGain.gain.setValueAtTime(0.4, hitTime);
        slapGain.gain.exponentialRampToValueAtTime(0.01, hitTime + 0.09);

        slapOsc.connect(slapGain);
        slapGain.connect(this.ctx.destination);

        slapOsc.start(hitTime);
        slapOsc.stop(hitTime + 0.1);
    }

    // Wrong Answer / Buzzer
    playBuzzer() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';

        osc1.frequency.setValueAtTime(130, now);
        osc2.frequency.setValueAtTime(138, now); // dissonant beat

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.36);
        osc2.stop(now + 0.36);
    }

    // Success / Lock Opened Ding
    playSuccessDing() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.07);

            gain.gain.setValueAtTime(0.2, now + idx * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.07);
            osc.stop(now + idx * 0.07 + 0.42);
        });
    }

    // Heavy Metal Padlock Clank (when punished)
    playPadlockClank() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.26);
    }

    // Peace offering chime (tea / flowers / cake)
    playChime() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        [880, 1108.73, 1318.51].forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, now + i * 0.05);
            gain.gain.setValueAtTime(0.25, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.5);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.55);
        });
    }

    // 8-Bit Celebratory Birthday Fanfare
    async playBirthdayFanfare() {
        if (this.muted) return;
        await this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            try { await this.ctx.resume(); } catch (e) {}
        }
        this.stopBGM(); // Cleanly reset any ongoing loop and active oscillators
        this.bgmPlaying = true;

        // Notes in Hz
        const notes = {
            'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C5': 523.25,
            'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99
        };

        // Melodic sequence: [note, duration in seconds]
        const song = [
            ['G4', 0.25], ['G4', 0.15], ['A4', 0.4], ['G4', 0.4], ['C5', 0.4], ['B4', 0.8],
            ['G4', 0.25], ['G4', 0.15], ['A4', 0.4], ['G4', 0.4], ['D5', 0.4], ['C5', 0.8],
            ['G4', 0.25], ['G4', 0.15], ['G5', 0.4], ['E5', 0.4], ['C5', 0.4], ['B4', 0.4], ['A4', 0.6],
            ['F5', 0.25], ['F5', 0.15], ['E5', 0.4], ['C5', 0.4], ['D5', 0.4], ['C5', 1.0]
        ];

        let cursor = this.ctx.currentTime + 0.08;
        const now = cursor;

        song.forEach(([pitch, dur]) => {
            if (!this.bgmPlaying) return;
            const freq = notes[pitch];
            if (freq) {
                // Lead Melody (Square wave)
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                this.activeOscillators.push(osc);

                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, cursor);

                gain.gain.setValueAtTime(0.12, cursor);
                gain.gain.setValueAtTime(0.12, cursor + dur * 0.85);
                gain.gain.exponentialRampToValueAtTime(0.001, cursor + dur * 0.95);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(cursor);
                osc.stop(cursor + dur);

                // Bass arpeggio accompaniment (Triangle wave)
                const bassOsc = this.ctx.createOscillator();
                const bassGain = this.ctx.createGain();
                this.activeOscillators.push(bassOsc);

                bassOsc.type = 'triangle';
                bassOsc.frequency.setValueAtTime(freq / 2, cursor);

                bassGain.gain.setValueAtTime(0.08, cursor);
                bassGain.gain.exponentialRampToValueAtTime(0.001, cursor + dur * 0.9);

                bassOsc.connect(bassGain);
                bassGain.connect(this.ctx.destination);

                bassOsc.start(cursor);
                bassOsc.stop(cursor + dur);
            }
            cursor += dur;
        });

        // Loop after song ends if still playing
        const totalDuration = cursor - now;
        this.bgmTimeout = setTimeout(() => {
            if (this.bgmPlaying && !this.muted) {
                this.playBirthdayFanfare();
            }
        }, totalDuration * 1000 + 400);
    }

    stopBGM() {
        this.bgmPlaying = false;
        if (this.bgmTimeout) {
            clearTimeout(this.bgmTimeout);
            this.bgmTimeout = null;
        }
        if (this.activeOscillators && this.activeOscillators.length > 0) {
            this.activeOscillators.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {}
            });
            this.activeOscillators = [];
        }
    }
}

// Global Sound Instance
window.soundEngine = new SoundEngine();

// Mobile browser audio gesture unlock on first touch/interaction
const unlockAudioOnTouch = () => {
    if (window.soundEngine) {
        window.soundEngine.init();
    }
};
['click', 'touchstart', 'touchend', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, unlockAudioOnTouch, { passive: true, once: false });
});
