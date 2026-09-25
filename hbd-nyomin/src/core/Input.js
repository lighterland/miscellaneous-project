// Unified Input Handler for Keyboard, Touch Virtual D-pad, and Gestures
export class Input {
  constructor() {
    this.keyOrder = []; // Stack of currently pressed directional keys
    this.activeTouchDir = null;
    this.swipeBuffer = null;
    this.actionTriggered = false;

    this.initKeyboard();
    this.initVirtualControls();
    this.initCanvasTouchGestures();
  }

  addDirKey(name) {
    if (!this.keyOrder.includes(name)) {
      this.keyOrder.push(name);
    }
  }

  removeDirKey(name) {
    const idx = this.keyOrder.indexOf(name);
    if (idx !== -1) {
      this.keyOrder.splice(idx, 1);
    }
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.addDirKey('up');
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.addDirKey('down');
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.addDirKey('left');
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.addDirKey('right');
          break;
        case 'Space':
        case 'Enter':
        case 'KeyE':
          this.actionTriggered = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.removeDirKey('up');
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.removeDirKey('down');
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.removeDirKey('left');
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.removeDirKey('right');
          break;
      }
    });

    // Reset keys on window blur so they never get stuck
    window.addEventListener('blur', () => {
      this.keyOrder = [];
      this.activeTouchDir = null;
    });
  }

  initVirtualControls() {
    let lastTouchTime = 0;
    const isSyntheticMouse = () => (Date.now() - lastTouchTime) < 600;

    const dpadBtns = document.querySelectorAll('.dpad-btn');
    dpadBtns.forEach(btn => {
      const dir = btn.dataset.dir;

      const handleTouchStart = (e) => {
        lastTouchTime = Date.now();
        e.preventDefault();
        e.stopPropagation();
        this.activeTouchDir = dir;
        btn.classList.add('active');
      };

      const handleTouchEnd = (e) => {
        lastTouchTime = Date.now();
        e.preventDefault();
        e.stopPropagation();
        if (this.activeTouchDir === dir) {
          this.activeTouchDir = null;
        }
        btn.classList.remove('active');
      };

      const handleMouseDown = (e) => {
        if (isSyntheticMouse()) return;
        this.activeTouchDir = dir;
        btn.classList.add('active');
      };

      const handleMouseUp = (e) => {
        if (isSyntheticMouse()) return;
        if (this.activeTouchDir === dir) {
          this.activeTouchDir = null;
        }
        btn.classList.remove('active');
      };

      btn.addEventListener('touchstart', handleTouchStart, { passive: false });
      btn.addEventListener('touchend', handleTouchEnd, { passive: false });
      btn.addEventListener('touchcancel', handleTouchEnd, { passive: false });
      btn.addEventListener('mousedown', handleMouseDown);
      btn.addEventListener('mouseup', handleMouseUp);
      btn.addEventListener('mouseleave', handleMouseUp);
    });

    const actionBtn = document.getElementById('action-btn');
    if (actionBtn) {
      const handleActionTouch = (e) => {
        lastTouchTime = Date.now();
        e.preventDefault();
        e.stopPropagation();
        this.actionTriggered = true;
      };

      const handleActionMouse = (e) => {
        if (isSyntheticMouse()) return;
        this.actionTriggered = true;
      };

      actionBtn.addEventListener('touchstart', handleActionTouch, { passive: false });
      actionBtn.addEventListener('mousedown', handleActionMouse);
    }
  }

  // Swipe gesture support on canvas for players who prefer swiping directly
  initCanvasTouchGestures() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    let startX = 0;
    let startY = 0;
    let isTouching = false;

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isTouching = true;
      }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (!isTouching || e.changedTouches.length === 0) return;
      isTouching = false;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;

      // Tap action if movement was very small
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        this.actionTriggered = true;
        return;
      }

      // Swipe direction
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 25) this.swipeBuffer = 'right';
        else if (dx < -25) this.swipeBuffer = 'left';
      } else {
        if (dy > 25) this.swipeBuffer = 'down';
        else if (dy < -25) this.swipeBuffer = 'up';
      }
    }, { passive: true });
  }

  // Returns current active direction vector { dx, dy, name } or null
  getDirection() {
    // 1. Check swipe buffer first
    if (this.swipeBuffer) {
      const dir = this.swipeBuffer;
      this.swipeBuffer = null;
      return this.mapDirNameToVector(dir);
    }

    // 2. Touch Virtual D-pad
    if (this.activeTouchDir) {
      return this.mapDirNameToVector(this.activeTouchDir);
    }

    // 3. Most recently pressed keyboard direction from stack
    if (this.keyOrder.length > 0) {
      const latestDir = this.keyOrder[this.keyOrder.length - 1];
      return this.mapDirNameToVector(latestDir);
    }

    return null;
  }

  mapDirNameToVector(name) {
    if (name === 'up') return { dx: 0, dy: -1, name: 'up' };
    if (name === 'down') return { dx: 0, dy: 1, name: 'down' };
    if (name === 'left') return { dx: -1, dy: 0, name: 'left' };
    if (name === 'right') return { dx: 1, dy: 0, name: 'right' };
    return null;
  }

  consumeAction() {
    if (this.actionTriggered) {
      this.actionTriggered = false;
      return true;
    }
    return false;
  }
}
