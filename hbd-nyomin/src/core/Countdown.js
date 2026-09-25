// Countdown module locked to Moscow Time (UTC+3) with dev bypass
export class Countdown {
  constructor(onUnlockCallback) {
    this.onUnlock = onUnlockCallback;
    this.tapCount = 0;
    this.tapTimer = null;
    this.timerInterval = null;
    this.isUnlocked = false;

    this.screenEl = document.getElementById('countdown-screen');
    this.titleEl = document.getElementById('countdown-title');
    this.daysEl = document.getElementById('days');
    this.hoursEl = document.getElementById('hours');
    this.minutesEl = document.getElementById('minutes');
    this.secondsEl = document.getElementById('seconds');
    this.hintEl = document.getElementById('countdown-hint');

    this.init();
  }

  // Calculate target unlock timestamp in Moscow Time (UTC+3)
  // Target: Sept 26, 00:00:00 MSK -> Sept 25, 21:00:00 UTC
  getTargetTime() {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    // Month is 0-indexed: 8 is September
    // 25th Sept 21:00:00 UTC = 26th Sept 00:00:00 MSK (UTC+3)
    let target = Date.UTC(currentYear, 8, 25, 21, 0, 0);

    // If Sept 26 MSK has already passed by more than 40 days, roll to next year
    if (now.getTime() - target > 40 * 24 * 60 * 60 * 1000) {
      target = Date.UTC(currentYear + 1, 8, 25, 21, 0, 0);
    }

    return target;
  }

  init() {
    // 1. Check URL parameters for bypass (?dev=true or ?bypass=true)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('dev') === 'true' || urlParams.get('bypass') === 'true') {
      this.unlock(true);
      return;
    }

    // 2. Secret tap trigger on Title (3 taps within 1.5 seconds)
    if (this.titleEl) {
      this.titleEl.addEventListener('click', () => {
        this.tapCount++;
        if (this.hintEl) {
          this.hintEl.textContent = `Taps: ${this.tapCount}/3 to unlock preview`;
          this.hintEl.style.color = '#e76f51';
        }

        clearTimeout(this.tapTimer);
        this.tapTimer = setTimeout(() => {
          this.tapCount = 0;
          if (this.hintEl) {
            this.hintEl.textContent = '(Pst! Secret tap title 3x or add ?dev=true to preview)';
            this.hintEl.style.color = '#8d99ae';
          }
        }, 1500);

        if (this.tapCount >= 3) {
          this.unlock(true);
        }
      });
    }

    // Also allow clicking the hint directly for easy preview testing
    if (this.hintEl) {
      this.hintEl.addEventListener('click', () => {
        this.unlock(true);
      });
    }

    // 3. Start countdown tick
    this.update();
    this.timerInterval = setInterval(() => this.update(), 1000);
  }

  update() {
    if (this.isUnlocked) return;

    const now = Date.now();
    const target = this.getTargetTime();
    const diff = target - now;

    if (diff <= 0) {
      // Reached Moscow time!
      this.unlock(false);
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (this.daysEl) this.daysEl.textContent = String(days).padStart(2, '0');
    if (this.hoursEl) this.hoursEl.textContent = String(hours).padStart(2, '0');
    if (this.minutesEl) this.minutesEl.textContent = String(minutes).padStart(2, '0');
    if (this.secondsEl) this.secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  unlock(isBypass = false) {
    if (this.isUnlocked) return;
    this.isUnlocked = true;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.screenEl) {
      this.screenEl.classList.add('hidden');
    }

    if (typeof this.onUnlock === 'function') {
      this.onUnlock(isBypass);
    }
  }
}
