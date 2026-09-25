import { SpriteGenerator } from './graphics/SpriteGenerator.js';
import { SoundEngine } from './audio/SoundEngine.js';
import { TileMap } from './engine/TileMap.js';
import { Player } from './engine/Player.js';
import { ParticleSystem } from './engine/Particles.js';
import { CanvasRenderer } from './engine/CanvasRenderer.js';
import { Input } from './core/Input.js';
import { Countdown } from './core/Countdown.js';
import { DialogueBox } from './ui/DialogueBox.js';
import { BirthdayModal } from './ui/BirthdayModal.js';

class GameApp {
  constructor() {
    this.gameState = 'COUNTDOWN'; // COUNTDOWN, ACTIVE
    this.sprites = new SpriteGenerator();
    this.soundEngine = new SoundEngine();
    this.particles = new ParticleSystem();
    this.tileMap = new TileMap();
    this.player = new Player(7, 24); // Start at bottom near cozy bench, facing north
    this.input = new Input();

    this.canvas = document.getElementById('game-canvas');
    this.renderer = new CanvasRenderer(this.canvas, this.sprites);

    this.dialogueBox = new DialogueBox(this.soundEngine, this.sprites);
    this.birthdayModal = new BirthdayModal(this.soundEngine, this.sprites, this.particles);

    this.interactBubble = document.getElementById('interact-bubble');
    this.interactBubbleText = document.getElementById('interact-bubble-text');
    this.soundToggleBtn = document.getElementById('sound-toggle');
    this.soundIcon = document.getElementById('sound-icon');

    this.lastTime = performance.now();
    this.audioStarted = false;

    this.initSoundToggle();
    this.initCountdown();
    this.initAudioUnlock();

    // Start game loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  initAudioUnlock() {
    const unlockAudio = () => {
      if (!this.audioStarted) {
        this.audioStarted = true;
        this.soundEngine.ensureContext();
        if (this.gameState !== 'COUNTDOWN') {
          this.soundEngine.startBgm();
        }
      }
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
  }

  initSoundToggle() {
    if (this.soundToggleBtn) {
      this.soundToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audioStarted = true;
        const isMuted = !this.soundEngine.toggleMute();
        this.soundIcon.textContent = isMuted ? '🔇' : '🎵';

        if (!isMuted && !this.soundEngine.isPlayingBgm) {
          this.soundEngine.startBgm();
        }
      });
    }
  }

  initCountdown() {
    this.countdown = new Countdown((isBypass) => {
      this.startIntro();
    });
  }

  startIntro() {
    this.gameState = 'ACTIVE';
    if (this.audioStarted) {
      this.soundEngine.startBgm();
    }

    // Opening dialogues in first-person Nyomin
    const introLines = [
      "Hello! My name is nyoooooomiiiiiiiiiiin!",
      "Haiiiii! Today feels so bright and magical... ✨",
      "I think there is a little special gift waiting for me somewhere in this nature meadow!",
      "Let's go explore and look around! (Use the D-pad or Arrow keys to walk)"
    ];

    setTimeout(() => {
      this.dialogueBox.startDialogue(introLines);
    }, 400);
  }

  triggerInteraction(target) {
    if (!target) return;

    if (target.isChest) {
      if (target.isOpened) {
        // Already opened: directly reopen celebration modal!
        this.birthdayModal.show();
        return;
      }

      this.soundEngine.playInteractChime();
      this.dialogueBox.startDialogue(target.dialogue, () => {
        target.isOpened = true;
        setTimeout(() => {
          this.birthdayModal.show();
        }, 300);
      });
    } else {
      this.soundEngine.playInteractChime();
      this.dialogueBox.startDialogue(target.dialogue);
    }
  }

  update(dt) {
    // Action button handling
    const actionPressed = this.input.consumeAction();

    // 1. If Dialogue Box is currently active
    if (this.dialogueBox.isActive()) {
      if (actionPressed) {
        this.dialogueBox.advance();
      }
      return;
    }

    // 2. If Birthday Celebration Modal is open
    if (this.birthdayModal.isOpen) {
      if (actionPressed) {
        this.birthdayModal.close();
      }
      return;
    }

    // 3. Normal Free Roam Gameplay
    if (this.gameState === 'ACTIVE') {
      const dir = this.input.getDirection();
      this.player.update(dt, dir, this.tileMap, this.soundEngine);

      // Check for interactive targets in facing or adjacent tile
      const target = this.tileMap.getInteractiveTarget(
        this.player.gridX,
        this.player.gridY,
        this.player.dirVector.dx,
        this.player.dirVector.dy
      );

      if (target) {
        this.interactBubble.classList.remove('hidden');
        if (target.isChest && target.isOpened) {
          this.interactBubbleText.textContent = 'View Birthday Card 💌';
        } else {
          this.interactBubbleText.textContent = target.prompt;
        }

        if (actionPressed) {
          this.triggerInteraction(target);
        }
      } else {
        this.interactBubble.classList.add('hidden');
      }
    }
  }

  render(dt) {
    this.renderer.render(this.tileMap, this.player, this.particles, dt);
  }

  gameLoop(time) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.update(dt);
    this.render(dt);

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
