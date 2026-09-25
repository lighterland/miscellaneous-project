// Player Entity with TibiaME-style Grid Movement & Overshoot Protection
export class Player {
  constructor(startX = 7, startY = 24) {
    this.gridX = startX;
    this.gridY = startY;
    this.targetX = startX;
    this.targetY = startY;

    // Visual pixel position
    this.pixelX = startX * 32;
    this.pixelY = startY * 32;

    this.direction = 'up'; // Facing upwards toward the adventure ahead!
    this.dirVector = { dx: 0, dy: -1 };

    this.isMoving = false;
    this.moveProgress = 0; // 0 to 1
    this.stepDuration = 0.16; // 160ms per grid tile step for snappy response

    this.animFrame = 0; // 0: Idle, 1: Step 1, 2: Step 2
    this.walkCycle = 1;
    this.animTimer = 0;

    // Overshoot prevention and pacing
    this.stepCooldown = 0;
    this.consecutiveSteps = 0;

    this.onStepComplete = null;
  }

  update(dt, inputDir, tileMap, soundEngine) {
    if (this.stepCooldown > 0) {
      this.stepCooldown -= dt;
    }

    if (this.isMoving) {
      this.moveProgress += dt / this.stepDuration;

      // Animate walk frames while stepping
      this.animTimer += dt;
      if (this.animTimer >= 0.08) {
        this.animTimer = 0;
        this.animFrame = (this.walkCycle % 2 === 0) ? 1 : 2;
      }

      if (this.moveProgress >= 1) {
        // Complete step to grid tile
        this.moveProgress = 0;
        this.gridX = this.targetX;
        this.gridY = this.targetY;
        this.pixelX = this.gridX * 32;
        this.pixelY = this.gridY * 32;
        this.isMoving = false;
        this.walkCycle++;
        this.animFrame = 0; // Back to idle

        // Prevent accidental overshooting on single taps:
        // A single finger tap typically lasts 150-250ms.
        // One step takes 160ms. Adding 120ms pause after the first step guarantees
        // any tap under 280ms takes EXACTLY 1 tile without accidental skipping!
        if (this.consecutiveSteps === 1) {
          this.stepCooldown = 0.12; // 120ms pause after first step
        } else {
          this.stepCooldown = 0.04; // 40ms snap between continuous steps
        }

        if (typeof this.onStepComplete === 'function') {
          this.onStepComplete(this.gridX, this.gridY);
        }
      } else {
        // Linear interpolation between current and target grid tile
        this.pixelX = (this.gridX + (this.targetX - this.gridX) * this.moveProgress) * 32;
        this.pixelY = (this.gridY + (this.targetY - this.gridY) * this.moveProgress) * 32;
      }
    }

    // When not currently stepping
    if (!this.isMoving) {
      if (!inputDir) {
        // Finger or key released: reset step counter & cooldown
        this.consecutiveSteps = 0;
        this.stepCooldown = 0;
      } else if (this.stepCooldown <= 0) {
        this.direction = inputDir.name;
        this.dirVector = { dx: inputDir.dx, dy: inputDir.dy };

        const nextX = this.gridX + inputDir.dx;
        const nextY = this.gridY + inputDir.dy;

        // Check collision
        if (!tileMap.isSolid(nextX, nextY)) {
          this.targetX = nextX;
          this.targetY = nextY;
          this.isMoving = true;
          this.moveProgress = 0;
          this.consecutiveSteps++;
          this.animFrame = (this.walkCycle % 2 === 0) ? 1 : 2;

          if (soundEngine) {
            soundEngine.playStep();
          }
        }
      } else {
        // If button is held during cooldown, immediately update facing direction
        this.direction = inputDir.name;
        this.dirVector = { dx: inputDir.dx, dy: inputDir.dy };
      }
    }
  }

  getSpriteKey() {
    return `nyomin_${this.direction}_${this.animFrame}`;
  }
}
