// Typewriter Dialogue Box Component with Sound & Avatar Portrait
export class DialogueBox {
  constructor(soundEngine, spriteGenerator) {
    this.soundEngine = soundEngine;
    this.spriteGenerator = spriteGenerator;

    this.container = document.getElementById('dialogue-box');
    this.textEl = document.getElementById('dialogue-text');
    this.speakerEl = document.querySelector('.dialogue-speaker');
    this.avatarCanvas = document.getElementById('dialogue-avatar');

    this.lines = [];
    this.currentLineIndex = 0;
    this.currentText = '';
    this.targetText = '';
    this.charIndex = 0;
    this.typeInterval = null;
    this.isTyping = false;
    this.onComplete = null;

    this.renderAvatar();
    this.initEvents();
  }

  renderAvatar() {
    if (!this.avatarCanvas) return;
    const ctx = this.avatarCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const portrait = this.spriteGenerator.get('nyomin_portrait');
    if (portrait) {
      ctx.drawImage(portrait, 0, 0, 48, 48);
    }
  }

  initEvents() {
    if (!this.container) return;

    const advance = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.advance();
    };

    this.container.addEventListener('click', advance);
    this.container.addEventListener('touchstart', advance, { passive: false });
  }

  startDialogue(lines, onComplete) {
    this.lines = lines;
    this.currentLineIndex = 0;
    this.onComplete = onComplete;
    if (this.speakerEl) {
      this.speakerEl.textContent = 'Nyomin';
    }
    this.container.classList.remove('hidden');

    this.showCurrentLine();
  }

  showCurrentLine() {
    if (this.currentLineIndex >= this.lines.length) {
      this.close();
      return;
    }

    // Strip any accidental "Nyomin:" or "Nyomin reads ...:" prefix
    let rawText = this.lines[this.currentLineIndex] || '';
    this.targetText = rawText.replace(/^Nyomin:\s*/i, '').trim();
    this.currentText = '';
    this.charIndex = 0;
    this.isTyping = true;
    this.textEl.textContent = '';

    if (this.typeInterval) clearInterval(this.typeInterval);

    this.typeInterval = setInterval(() => {
      if (this.charIndex < this.targetText.length) {
        this.currentText += this.targetText[this.charIndex];
        this.textEl.textContent = this.currentText;
        this.charIndex++;

        // Play chirp sound every other character
        if (this.charIndex % 2 === 0 && this.soundEngine) {
          this.soundEngine.playTextBlip();
        }
      } else {
        this.finishTyping();
      }
    }, 28);
  }

  finishTyping() {
    this.isTyping = false;
    if (this.typeInterval) {
      clearInterval(this.typeInterval);
      this.typeInterval = null;
    }
    this.textEl.textContent = this.targetText;
  }

  advance() {
    if (this.isTyping) {
      // If still typing, immediately complete text
      this.finishTyping();
    } else {
      // Go to next line
      this.currentLineIndex++;
      this.showCurrentLine();
    }
  }

  close() {
    this.finishTyping();
    this.container.classList.add('hidden');
    if (typeof this.onComplete === 'function') {
      const cb = this.onComplete;
      this.onComplete = null;
      cb();
    }
  }

  isActive() {
    return !this.container.classList.contains('hidden');
  }
}
