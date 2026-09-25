// Confetti and Ambient Nature Particle System
export class ParticleSystem {
  constructor() {
    this.ambientParticles = [];
    this.confettiParticles = [];
    this.initAmbient();
  }

  initAmbient() {
    // Generate gentle floating flower petals & sparkles in meadow
    for (let i = 0; i < 22; i++) {
      this.ambientParticles.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: 0.3 + Math.random() * 0.4,
        vy: 0.4 + Math.random() * 0.5,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? '#ffccd5' : '#fff3b0',
        alpha: 0.4 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  updateAmbient(dt, mapWidth, mapHeight) {
    this.ambientParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += dt * 2;
      p.x += Math.sin(p.phase) * 0.3;

      // Wrap around world
      if (p.x > mapWidth) p.x = 0;
      if (p.y > mapHeight) p.y = 0;
    });
  }

  // Spawn confetti burst (screen or world space)
  spawnConfetti(count = 120, canvasWidth = 400, canvasHeight = 600) {
    const colors = [
      '#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0',
      '#ffb703', '#fb8500', '#52b788', '#ff99c8', '#fcf6bd'
    ];

    for (let i = 0; i < count; i++) {
      this.confettiParticles.push({
        x: canvasWidth / 2 + (Math.random() - 0.5) * 80,
        y: canvasHeight * 0.45 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 420,
        vy: -200 - Math.random() * 380,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 600,
        gravity: 420 + Math.random() * 150,
        alpha: 1
      });
    }
  }

  updateConfetti(dt, canvasHeight) {
    for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
      const c = this.confettiParticles[i];
      c.vy += c.gravity * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rotation += c.rotSpeed * dt;

      if (c.y > canvasHeight + 20) {
        this.confettiParticles.splice(i, 1);
      }
    }
  }

  drawConfetti(ctx) {
    this.confettiParticles.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate((c.rotation * Math.PI) / 180);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
      ctx.restore();
    });
  }
}
