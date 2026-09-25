// Birthday Card Modal Overlay with Confetti Animation
export class BirthdayModal {
  constructor(soundEngine, spriteGenerator, particleSystem) {
    this.soundEngine = soundEngine;
    this.spriteGenerator = spriteGenerator;
    this.particles = particleSystem;

    this.modalEl = document.getElementById('birthday-modal');
    this.avatarCanvas = document.getElementById('modal-avatar');
    this.confettiCanvas = document.getElementById('confetti-canvas');
    this.replayBtn = document.getElementById('modal-replay-btn');

    this.confettiCtx = null;
    this.animFrameId = null;
    this.isOpen = false;

    this.initConfetti();
    this.renderAvatar();
    this.initEvents();
  }

  initConfetti() {
    if (!this.confettiCanvas) return;
    this.confettiCtx = this.confettiCanvas.getContext('2d');
    this.resizeConfetti();
    window.addEventListener('resize', () => this.resizeConfetti());
  }

  resizeConfetti() {
    if (!this.confettiCanvas) return;
    this.confettiCanvas.width = window.innerWidth;
    this.confettiCanvas.height = window.innerHeight;
  }

  renderAvatar() {
    if (!this.avatarCanvas) return;
    const ctx = this.avatarCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const portrait = this.spriteGenerator.get('nyomin_portrait');
    if (portrait) {
      ctx.drawImage(portrait, 0, 0, 72, 72);
    }
  }

  initEvents() {
    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }

  show() {
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');

    // Trigger celebration fanfare
    if (this.soundEngine) {
      this.soundEngine.playChestFanfare();
    }

    // Trigger confetti burst
    this.resizeConfetti();
    this.particles.spawnConfetti(140, window.innerWidth, window.innerHeight);

    // Second wave burst
    setTimeout(() => {
      this.particles.spawnConfetti(90, window.innerWidth, window.innerHeight);
    }, 600);

    this.startConfettiLoop();
  }

  startConfettiLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    let lastTime = performance.now();
    const loop = (time) => {
      if (!this.isOpen) return;

      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
      this.particles.updateConfetti(dt, this.confettiCanvas.height);
      this.particles.drawConfetti(this.confettiCtx);

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
