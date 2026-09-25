// Web Audio API Sound & Music Synthesizer
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isPlayingBgm = false;
    this.bgmTimer = null;
    this.currentNoteIndex = 0;
    this.masterGain = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.ensureContext();
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
    return !this.isMuted;
  }

  // Play a simple synthesized tone
  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio error fallback
    }
  }

  // SFX: Footstep
  playStep() {
    if (this.isMuted) return;
    this.playTone(140 + Math.random() * 20, 'triangle', 0.05, 0.06);
  }

  // SFX: Dialogue character blip
  playTextBlip() {
    if (this.isMuted) return;
    this.playTone(520 + Math.random() * 60, 'sine', 0.04, 0.04);
  }

  // SFX: Interactive spot chime
  playInteractChime() {
    if (this.isMuted) return;
    this.playTone(523.25, 'triangle', 0.1, 0.12); // C5
    setTimeout(() => {
      this.playTone(659.25, 'triangle', 0.18, 0.12); // E5
    }, 90);
  }

  // SFX: Chest Opening Fanfare
  playChestFanfare() {
    if (this.isMuted) return;
    this.ensureContext();
    const notes = [
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.15 }, // G5
      { f: 1046.50, d: 0.35 }, // C6
      { f: 1318.51, d: 0.6 }  // E6
    ];

    let delay = 0;
    notes.forEach((n, idx) => {
      setTimeout(() => {
        this.playTone(n.f, idx === notes.length - 1 ? 'sine' : 'triangle', n.d, 0.22);
      }, delay);
      delay += n.d * 900;
    });
  }

  // Cozy Birthday Lofi / Chiptune Melody Loop
  // Arrangement of Happy Birthday melody in C major / whimsical tempo
  startBgm() {
    if (this.isPlayingBgm) return;
    this.ensureContext();
    this.isPlayingBgm = true;

    // Melody: [frequency (Hz), duration (sec), pause (sec)]
    // Happy Birthday notes in C:
    // G4, G4, A4, G4, C5, B4
    // G4, G4, A4, G4, D5, C5
    // G4, G4, G5, E5, C5, B4, A4
    // F5, F5, E5, C5, D5, C5
    const melody = [
      // Phrase 1
      { f: 392.00, d: 0.26 }, // G4
      { f: 392.00, d: 0.26 }, // G4
      { f: 440.00, d: 0.52 }, // A4
      { f: 392.00, d: 0.52 }, // G4
      { f: 523.25, d: 0.52 }, // C5
      { f: 493.88, d: 1.00 }, // B4
      { f: 0, d: 0.2 },      // Rest

      // Phrase 2
      { f: 392.00, d: 0.26 }, // G4
      { f: 392.00, d: 0.26 }, // G4
      { f: 440.00, d: 0.52 }, // A4
      { f: 392.00, d: 0.52 }, // G4
      { f: 587.33, d: 0.52 }, // D5
      { f: 523.25, d: 1.00 }, // C5
      { f: 0, d: 0.2 },      // Rest

      // Phrase 3
      { f: 392.00, d: 0.26 }, // G4
      { f: 392.00, d: 0.26 }, // G4
      { f: 783.99, d: 0.52 }, // G5
      { f: 659.25, d: 0.52 }, // E5
      { f: 523.25, d: 0.52 }, // C5
      { f: 493.88, d: 0.52 }, // B4
      { f: 440.00, d: 0.80 }, // A4
      { f: 0, d: 0.2 },      // Rest

      // Phrase 4
      { f: 698.46, d: 0.26 }, // F5
      { f: 698.46, d: 0.26 }, // F5
      { f: 659.25, d: 0.52 }, // E5
      { f: 523.25, d: 0.52 }, // C5
      { f: 587.33, d: 0.52 }, // D5
      { f: 523.25, d: 1.20 }, // C5
      { f: 0, d: 0.6 }       // Interlude rest
    ];

    let noteIdx = 0;
    const playNextNote = () => {
      if (!this.isPlayingBgm) return;

      const note = melody[noteIdx];
      if (note.f > 0 && !this.isMuted) {
        // Soft warm triangle wave with slight chorus / bass harmony
        this.playTone(note.f, 'triangle', note.d * 0.9, 0.08);
        // Soft sub-bass an octave lower
        this.playTone(note.f / 2, 'sine', note.d * 0.8, 0.04);
      }

      noteIdx = (noteIdx + 1) % melody.length;
      this.bgmTimer = setTimeout(playNextNote, (note.d + 0.06) * 1000);
    };

    playNextNote();
  }

  stopBgm() {
    this.isPlayingBgm = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}
