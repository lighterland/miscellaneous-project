// Canvas 2D Pixel-Art Renderer with Camera Tracking and Y-Sorting - Mobile Vertical Optimized
export class CanvasRenderer {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;

    // Viewport & Camera
    this.viewWidth = 320;
    this.viewHeight = 240;
    this.cameraX = 0;
    this.cameraY = 0;
    this.waterTime = 0;
    this.isPortrait = false;

    this.setupResolution();
    window.addEventListener('resize', () => this.setupResolution());
  }

  setupResolution() {
    const dpr = window.devicePixelRatio || 1;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    this.isPortrait = screenHeight > screenWidth;

    let scale;
    if (this.isPortrait) {
      // Mobile vertical portrait: ensure crisp 2x or 3x scale so sprites are large and readable
      scale = screenWidth <= 520 ? 2 : Math.floor(screenWidth / 220);
      if (scale < 2) scale = 2;
      if (scale > 3) scale = 3;
    } else {
      // Landscape or Desktop
      scale = Math.floor(Math.min(screenWidth / 280, screenHeight / 210));
      if (scale < 1) scale = 1;
      if (scale > 3) scale = 3;
    }

    this.viewWidth = Math.ceil(screenWidth / scale);
    this.viewHeight = Math.ceil(screenHeight / scale);

    this.canvas.width = this.viewWidth * dpr;
    this.canvas.height = this.viewHeight * dpr;
    this.canvas.style.width = `${screenWidth}px`;
    this.canvas.style.height = `${screenHeight}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  updateCamera(targetX, targetY, mapWidthPx, mapHeightPx) {
    // Center camera on target (Nyomin)
    const desiredX = targetX + 16 - this.viewWidth / 2;

    // In portrait mobile mode, offset camera down so Nyomin sits in the upper half,
    // keeping her path clearly visible above the bottom on-screen thumb controls
    const verticalOffset = this.isPortrait ? Math.round(this.viewHeight * 0.08) : 0;
    const desiredY = targetY + 16 - this.viewHeight / 2 - verticalOffset;

    // Smooth camera lag / lerp
    this.cameraX += (desiredX - this.cameraX) * 0.14;
    this.cameraY += (desiredY - this.cameraY) * 0.14;

    // Clamp to map boundaries if map is larger than view
    if (mapWidthPx > this.viewWidth) {
      this.cameraX = Math.max(0, Math.min(mapWidthPx - this.viewWidth, this.cameraX));
    } else {
      this.cameraX = (mapWidthPx - this.viewWidth) / 2;
    }

    if (mapHeightPx > this.viewHeight) {
      this.cameraY = Math.max(0, Math.min(mapHeightPx - this.viewHeight, this.cameraY));
    } else {
      this.cameraY = (mapHeightPx - this.viewHeight) / 2;
    }
  }

  render(tileMap, player, particles, dt) {
    this.waterTime += dt;
    const mapWidthPx = tileMap.width * tileMap.tileSize;
    const mapHeightPx = tileMap.height * tileMap.tileSize;

    this.updateCamera(player.pixelX, player.pixelY, mapWidthPx, mapHeightPx);

    // Clear background
    this.ctx.fillStyle = '#649b57';
    this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    const camX = Math.round(this.cameraX);
    const camY = Math.round(this.cameraY);

    // --- 1. RENDER GROUND TILES ---
    const startCol = Math.max(0, Math.floor(camX / 32));
    const endCol = Math.min(tileMap.width - 1, Math.ceil((camX + this.viewWidth) / 32));
    const startRow = Math.max(0, Math.floor(camY / 32));
    const endRow = Math.min(tileMap.height - 1, Math.ceil((camY + this.viewHeight) / 32));

    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const tileType = tileMap.tiles[y][x];
        const screenX = x * 32 - camX;
        const screenY = y * 32 - camY;

        let sprite = null;
        if (tileType === 0) sprite = this.sprites.get('tile_grass');
        else if (tileType === 1) sprite = this.sprites.get('tile_grass_flowers');
        else if (tileType === 2) sprite = this.sprites.get('tile_path');
        else if (tileType === 3) sprite = this.sprites.get('tile_lavender');
        else if (tileType === 4) sprite = this.sprites.get('tile_water');
        else if (tileType === 5) sprite = this.sprites.get('fence');

        if (sprite) {
          this.ctx.drawImage(sprite, screenX, screenY);
        }

        // Water subtle animated glint
        if (tileType === 4) {
          const wavePhase = (this.waterTime * 3 + x + y) % Math.PI;
          if (wavePhase < 0.8) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            this.ctx.fillRect(screenX + 8, screenY + 12, 6, 2);
          }
        }
      }
    }

    // --- 2. Y-SORTED OBJECTS & ENTITIES ---
    const renderList = [];

    // Player
    renderList.push({
      y: player.pixelY + 30, // Sorting depth at player feet
      draw: () => {
        const pSprite = this.sprites.get(player.getSpriteKey());
        if (pSprite) {
          this.ctx.drawImage(pSprite, Math.round(player.pixelX - camX), Math.round(player.pixelY - camY));
        }
      }
    });

    // Trees
    tileMap.trees.forEach(t => {
      const treeSprite = this.sprites.get('tree');
      renderList.push({
        y: (t.y + 1) * 32 + 28, // Sort by base of trunk
        draw: () => {
          if (treeSprite) {
            this.ctx.drawImage(treeSprite, t.x * 32 - camX, (t.y - 1) * 32 - camY);
          }
        }
      });
    });

    // Signpost at (8, 12)
    const signSprite = this.sprites.get('signpost');
    renderList.push({
      y: 12 * 32 + 28,
      draw: () => {
        if (signSprite) {
          this.ctx.drawImage(signSprite, 8 * 32 - camX, 12 * 32 - camY);
        }
      }
    });

    // Bench at (5, 24)
    const benchSprite = this.sprites.get('bench');
    renderList.push({
      y: 24 * 32 + 28,
      draw: () => {
        if (benchSprite) {
          this.ctx.drawImage(benchSprite, 5 * 32 - camX, 24 * 32 - camY);
        }
      }
    });

    // Birthday Chest at (8, 4)
    const chestItem = tileMap.interactives.find(i => i.isChest);
    if (chestItem) {
      renderList.push({
        y: chestItem.y * 32 + 26,
        draw: () => {
          const spriteKey = chestItem.isOpened ? 'chest_opened' : 'chest_closed';
          const chestSprite = this.sprites.get(spriteKey);
          const cx = chestItem.x * 32 - camX;
          const cy = chestItem.y * 32 - camY;

          // Glowing aura around chest
          const pulse = Math.sin(this.waterTime * 4) * 3;
          this.ctx.fillStyle = 'rgba(255, 235, 150, 0.32)';
          this.ctx.beginPath();
          this.ctx.arc(cx + 16, cy + 20, 18 + pulse, 0, Math.PI * 2);
          this.ctx.fill();

          if (chestSprite) {
            this.ctx.drawImage(chestSprite, cx, cy);
          }
        }
      });
    }

    // Sort and draw in order of Y coordinate
    renderList.sort((a, b) => a.y - b.y);
    renderList.forEach(item => item.draw());

    // --- 3. AMBIENT NATURE PARTICLES ---
    if (particles) {
      particles.updateAmbient(dt, mapWidthPx, mapHeightPx);
      particles.ambientParticles.forEach(p => {
        const px = Math.round(p.x - camX);
        const py = Math.round(p.y - camY);
        if (px >= 0 && px <= this.viewWidth && py >= 0 && py <= this.viewHeight) {
          this.ctx.fillStyle = p.color;
          this.ctx.globalAlpha = p.alpha;
          this.ctx.fillRect(px, py, p.size, p.size);
        }
      });
      this.ctx.globalAlpha = 1.0;
    }
  }
}
