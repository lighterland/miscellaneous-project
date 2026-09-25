import { PALETTE } from './Palette.js';

// Helper to create an offscreen canvas
function createOffscreenCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export class SpriteGenerator {
  constructor() {
    this.sprites = {};
    this.generateAll();
  }

  generateAll() {
    this.generateTiles();
    this.generateNyominSprites();
    this.generateChestSprites();
    this.generateDecorations();
    this.generatePortrait();
  }

  // Generate 32x32 environment tiles
  generateTiles() {
    // 1. Grass Base
    const grass = createOffscreenCanvas(32, 32);
    const gctx = grass.ctx;
    gctx.fillStyle = PALETTE.GRASS_BASE;
    gctx.fillRect(0, 0, 32, 32);
    // Subtle grass texture
    gctx.fillStyle = PALETTE.GRASS_LIGHT;
    gctx.fillRect(4, 6, 2, 4);
    gctx.fillRect(6, 8, 2, 2);
    gctx.fillRect(18, 14, 2, 4);
    gctx.fillRect(20, 16, 2, 2);
    gctx.fillRect(10, 24, 2, 3);
    gctx.fillRect(26, 6, 2, 4);
    gctx.fillStyle = PALETTE.GRASS_DARK;
    gctx.fillRect(8, 12, 2, 2);
    gctx.fillRect(22, 26, 2, 2);
    this.sprites['tile_grass'] = grass.canvas;

    // 2. Grass with tiny wildflowers
    const grassFlowers = createOffscreenCanvas(32, 32);
    const gfctx = grassFlowers.ctx;
    gfctx.drawImage(grass.canvas, 0, 0);
    // Yellow buttercup
    gfctx.fillStyle = PALETTE.FLOWER_YELLOW;
    gfctx.fillRect(6, 10, 3, 3);
    gfctx.fillRect(7, 9, 1, 5);
    gfctx.fillRect(5, 11, 5, 1);
    gfctx.fillStyle = PALETTE.FLOWER_CENTER;
    gfctx.fillRect(7, 11, 1, 1);
    // Pink petal flower
    gfctx.fillStyle = PALETTE.FLOWER_PINK;
    gfctx.fillRect(20, 18, 3, 3);
    gfctx.fillRect(21, 17, 1, 5);
    gfctx.fillRect(19, 19, 5, 1);
    gfctx.fillStyle = PALETTE.FLOWER_CENTER;
    gfctx.fillRect(21, 19, 1, 1);
    this.sprites['tile_grass_flowers'] = grassFlowers.canvas;

    // 3. Lavender Flower Patch (Interactive spot)
    const lavender = createOffscreenCanvas(32, 32);
    const lctx = lavender.ctx;
    lctx.drawImage(grass.canvas, 0, 0);
    // Stems & lavender spikes
    const drawLavenderSpike = (x, y) => {
      lctx.fillStyle = PALETTE.LEAVES_DARK;
      lctx.fillRect(x + 1, y + 4, 1, 10);
      lctx.fillStyle = PALETTE.LAVENDER_BASE;
      lctx.fillRect(x, y + 1, 3, 8);
      lctx.fillStyle = PALETTE.LAVENDER_LIGHT;
      lctx.fillRect(x + 1, y, 1, 7);
      lctx.fillRect(x, y + 3, 1, 2);
      lctx.fillRect(x + 2, y + 5, 1, 2);
    };
    drawLavenderSpike(6, 8);
    drawLavenderSpike(12, 5);
    drawLavenderSpike(16, 10);
    drawLavenderSpike(22, 7);
    drawLavenderSpike(10, 14);
    drawLavenderSpike(18, 16);
    this.sprites['tile_lavender'] = lavender.canvas;

    // 4. Cobblestone / Meadow Path
    const path = createOffscreenCanvas(32, 32);
    const pctx = path.ctx;
    pctx.fillStyle = PALETTE.DIRT_BASE;
    pctx.fillRect(0, 0, 32, 32);
    pctx.fillStyle = PALETTE.DIRT_LIGHT;
    // Stepping stones
    const drawStone = (x, y, w, h) => {
      pctx.fillStyle = PALETTE.DIRT_LIGHT;
      pctx.fillRect(x, y, w, h);
      pctx.fillStyle = PALETTE.DIRT_DARK;
      pctx.fillRect(x, y + h - 1, w, 1);
      pctx.fillRect(x + w - 1, y, 1, h);
    };
    drawStone(3, 4, 11, 9);
    drawStone(17, 3, 12, 10);
    drawStone(7, 16, 13, 11);
    drawStone(22, 15, 8, 12);
    // Tiny grass tufts on path edge
    pctx.fillStyle = PALETTE.GRASS_BASE;
    pctx.fillRect(0, 8, 2, 2);
    pctx.fillRect(30, 20, 2, 2);
    this.sprites['tile_path'] = path.canvas;

    // 5. Water / Pond Tile
    const water = createOffscreenCanvas(32, 32);
    const wctx = water.ctx;
    wctx.fillStyle = PALETTE.WATER_BASE;
    wctx.fillRect(0, 0, 32, 32);
    wctx.fillStyle = PALETTE.WATER_LIGHT;
    wctx.fillRect(4, 6, 8, 2);
    wctx.fillRect(16, 18, 10, 2);
    wctx.fillRect(20, 8, 6, 1);
    this.sprites['tile_water'] = water.canvas;
  }

  // Generate 64x64 Tree and other nature decor
  generateDecorations() {
    // 1. Lush Whimsical Tree (64x64)
    const tree = createOffscreenCanvas(64, 64);
    const tctx = tree.ctx;
    // Shadow
    tctx.fillStyle = 'rgba(40, 70, 50, 0.25)';
    tctx.beginPath();
    tctx.ellipse(32, 58, 24, 6, 0, 0, Math.PI * 2);
    tctx.fill();
    // Trunk
    tctx.fillStyle = PALETTE.WOOD_BASE;
    tctx.fillRect(26, 40, 12, 18);
    tctx.fillStyle = PALETTE.WOOD_DARK;
    tctx.fillRect(35, 40, 3, 18);
    tctx.fillStyle = PALETTE.WOOD_LIGHT;
    tctx.fillRect(26, 40, 2, 18);
    // Canopy (Pastel layered puffs)
    const drawCanopyCircle = (cx, cy, r, color) => {
      tctx.fillStyle = color;
      tctx.beginPath();
      tctx.arc(cx, cy, r, 0, Math.PI * 2);
      tctx.fill();
    };
    // Darker base canopy
    drawCanopyCircle(32, 28, 26, PALETTE.LEAVES_DARK);
    drawCanopyCircle(20, 28, 18, PALETTE.LEAVES_DARK);
    drawCanopyCircle(44, 28, 18, PALETTE.LEAVES_DARK);
    // Mid lush canopy
    drawCanopyCircle(32, 25, 23, PALETTE.LEAVES_BASE);
    drawCanopyCircle(21, 26, 16, PALETTE.LEAVES_BASE);
    drawCanopyCircle(43, 26, 16, PALETTE.LEAVES_BASE);
    drawCanopyCircle(32, 15, 17, PALETTE.LEAVES_BASE);
    // Highlights
    drawCanopyCircle(28, 20, 14, PALETTE.LEAVES_LIGHT);
    drawCanopyCircle(36, 16, 11, PALETTE.LEAVES_LIGHT);
    drawCanopyCircle(18, 23, 8, PALETTE.LEAVES_LIGHT);
    this.sprites['tree'] = tree.canvas;

    // 2. Wooden Fence (32x32)
    const fence = createOffscreenCanvas(32, 32);
    const fctx = fence.ctx;
    // Rails
    fctx.fillStyle = PALETTE.WOOD_BASE;
    fctx.fillRect(0, 10, 32, 4);
    fctx.fillRect(0, 20, 32, 4);
    // Posts
    fctx.fillStyle = PALETTE.WOOD_LIGHT;
    fctx.fillRect(4, 6, 6, 22);
    fctx.fillRect(22, 6, 6, 22);
    fctx.fillStyle = PALETTE.WOOD_DARK;
    fctx.fillRect(9, 6, 1, 22);
    fctx.fillRect(27, 6, 1, 22);
    // Pointy top
    fctx.fillRect(6, 4, 2, 2);
    fctx.fillRect(24, 4, 2, 2);
    this.sprites['fence'] = fence.canvas;

    // 3. Wooden Signpost (32x32)
    const signpost = createOffscreenCanvas(32, 32);
    const sctx = signpost.ctx;
    // Post
    sctx.fillStyle = PALETTE.WOOD_DARK;
    sctx.fillRect(14, 14, 4, 16);
    // Board
    sctx.fillStyle = PALETTE.WOOD_LIGHT;
    sctx.fillRect(4, 6, 24, 12);
    sctx.fillStyle = PALETTE.WOOD_DARK;
    sctx.strokeRect(4, 6, 24, 12);
    // Arrows / text lines
    sctx.fillStyle = PALETTE.WOOD_DARK;
    sctx.fillRect(8, 10, 14, 2);
    sctx.fillRect(8, 13, 8, 2);
    sctx.fillRect(23, 11, 2, 2);
    this.sprites['signpost'] = signpost.canvas;

    // 4. Park Bench (32x32)
    const bench = createOffscreenCanvas(32, 32);
    const bctx = bench.ctx;
    // Backrest
    bctx.fillStyle = PALETTE.WOOD_BASE;
    bctx.fillRect(4, 8, 24, 5);
    // Seat
    bctx.fillStyle = PALETTE.WOOD_LIGHT;
    bctx.fillRect(4, 16, 24, 6);
    // Legs
    bctx.fillStyle = PALETTE.WOOD_DARK;
    bctx.fillRect(6, 22, 3, 8);
    bctx.fillRect(23, 22, 3, 8);
    this.sprites['bench'] = bench.canvas;
  }

  // Generate Birthday Chest Sprites (Closed and Opened)
  generateChestSprites() {
    // Closed Chest
    const closed = createOffscreenCanvas(32, 32);
    const cctx = closed.ctx;
    // Shadow
    cctx.fillStyle = 'rgba(0,0,0,0.2)';
    cctx.beginPath();
    cctx.ellipse(16, 28, 11, 3, 0, 0, Math.PI * 2);
    cctx.fill();
    // Chest base wood
    cctx.fillStyle = PALETTE.CHEST_WOOD;
    cctx.fillRect(6, 12, 20, 14);
    cctx.fillStyle = PALETTE.CHEST_WOOD_DARK;
    cctx.fillRect(6, 12, 20, 2);
    cctx.fillRect(6, 24, 20, 2);
    cctx.fillRect(6, 12, 2, 14);
    cctx.fillRect(24, 12, 2, 14);
    // Pink Ribbon & Bow
    cctx.fillStyle = PALETTE.CHEST_RIBBON;
    cctx.fillRect(15, 12, 2, 14);
    cctx.fillRect(6, 18, 20, 2);
    // Ribbon Bow on top
    cctx.fillRect(13, 9, 6, 3);
    cctx.fillRect(11, 8, 3, 3);
    cctx.fillRect(18, 8, 3, 3);
    // Golden lock/buckle
    cctx.fillStyle = PALETTE.CHEST_GOLD;
    cctx.fillRect(14, 17, 4, 4);
    this.sprites['chest_closed'] = closed.canvas;

    // Opened Chest with Sparkle & Gift
    const opened = createOffscreenCanvas(32, 32);
    const octx = opened.ctx;
    // Shadow
    octx.fillStyle = 'rgba(0,0,0,0.2)';
    octx.beginPath();
    octx.ellipse(16, 28, 11, 3, 0, 0, Math.PI * 2);
    octx.fill();
    // Lid open upwards
    octx.fillStyle = PALETTE.CHEST_WOOD_DARK;
    octx.fillRect(6, 4, 20, 6);
    octx.fillStyle = PALETTE.CHEST_RIBBON;
    octx.fillRect(15, 4, 2, 6);
    // Chest Body
    octx.fillStyle = PALETTE.CHEST_WOOD;
    octx.fillRect(6, 14, 20, 12);
    octx.fillStyle = PALETTE.CHEST_WOOD_DARK;
    octx.fillRect(6, 14, 2, 12);
    octx.fillRect(24, 14, 2, 12);
    octx.fillRect(6, 24, 20, 2);
    // Golden Glow from inside
    octx.fillStyle = PALETTE.CHEST_INSIDE_GLOW;
    octx.fillRect(8, 10, 16, 6);
    // Heart / Star popping up
    octx.fillStyle = PALETTE.CHEST_GOLD;
    octx.fillRect(14, 7, 4, 4);
    octx.fillStyle = PALETTE.FLOWER_PINK;
    octx.fillRect(15, 8, 2, 2);
    this.sprites['chest_opened'] = opened.canvas;
  }

  // Generate Nyomin Character Sprites (4 directions, 3 walk frames each)
  // Matching the photo:
  // - Dark hair with bangs framing the forehead
  // - Charcoal/dark grey hoodie with drawstring details
  // - Warm smiling face, blush cheeks
  generateNyominSprites() {
    const directions = ['down', 'up', 'left', 'right'];
    const frames = [0, 1, 2]; // 0: Idle, 1: Step Left, 2: Step Right

    directions.forEach(dir => {
      frames.forEach(frame => {
        const { canvas, ctx } = createOffscreenCanvas(32, 32);
        this.drawNyominFrame(ctx, dir, frame);
        this.sprites[`nyomin_${dir}_${frame}`] = canvas;
      });
    });
  }

  drawNyominFrame(ctx, dir, frame) {
    // Subtle drop shadow under character
    ctx.fillStyle = 'rgba(30, 45, 30, 0.28)';
    ctx.beginPath();
    ctx.ellipse(16, 30, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const legOffset = (frame === 1) ? -1 : (frame === 2) ? 1 : 0;
    const bodyBob = (frame !== 0) ? -1 : 0;

    // --- LEGS & SHOES ---
    ctx.fillStyle = PALETTE.PANTS;
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(13, 24 + bodyBob, 2, 4);
      ctx.fillRect(17, 24 + bodyBob, 2, 4);
      // White sneakers
      ctx.fillStyle = PALETTE.SHOES;
      ctx.fillRect(12, 28 + (frame === 1 ? -1 : 0), 3, 2);
      ctx.fillRect(17, 28 + (frame === 2 ? -1 : 0), 3, 2);
    } else { // left or right
      ctx.fillRect(15 + legOffset, 24 + bodyBob, 3, 4);
      ctx.fillStyle = PALETTE.SHOES;
      const shoeX = (dir === 'right') ? 15 + legOffset : 14 + legOffset;
      ctx.fillRect(shoeX, 28, 4, 2);
    }

    // --- HOODIE BODY ---
    // Dark grey oversized hoodie (charcoal)
    ctx.fillStyle = PALETTE.HOODIE_DARK;
    ctx.fillRect(11, 16 + bodyBob, 10, 8);
    ctx.fillStyle = PALETTE.HOODIE_BASE;
    ctx.fillRect(12, 16 + bodyBob, 8, 7);

    // Front details (Drawstrings & kangaroo pocket) for down/front view
    if (dir === 'down') {
      // Drawstrings (white strings visible in photo)
      ctx.fillStyle = PALETTE.HOODIE_STRING;
      ctx.fillRect(14, 16 + bodyBob, 1, 4);
      ctx.fillRect(17, 16 + bodyBob, 1, 4);
      // Pocket fold
      ctx.fillStyle = PALETTE.HOODIE_DARK;
      ctx.fillRect(13, 21 + bodyBob, 6, 2);
      // Arms / sleeves
      ctx.fillStyle = PALETTE.HOODIE_BASE;
      ctx.fillRect(9, 17 + bodyBob, 2, 5);
      ctx.fillRect(21, 17 + bodyBob, 2, 5);
      // Hands
      ctx.fillStyle = PALETTE.SKIN_BASE;
      ctx.fillRect(9, 22 + bodyBob, 2, 2);
      ctx.fillRect(21, 22 + bodyBob, 2, 2);
    } else if (dir === 'up') {
      // Back of hoodie (hood flap hanging down)
      ctx.fillStyle = PALETTE.HOODIE_DARK;
      ctx.fillRect(13, 16 + bodyBob, 6, 5);
      ctx.fillStyle = PALETTE.HOODIE_BASE;
      ctx.fillRect(9, 17 + bodyBob, 2, 5);
      ctx.fillRect(21, 17 + bodyBob, 2, 5);
    } else if (dir === 'left') {
      // Side view left
      ctx.fillStyle = PALETTE.HOODIE_BASE;
      ctx.fillRect(13, 17 + bodyBob, 3, 5);
      ctx.fillStyle = PALETTE.SKIN_BASE;
      ctx.fillRect(12, 22 + bodyBob, 2, 2);
    } else if (dir === 'right') {
      // Side view right
      ctx.fillStyle = PALETTE.HOODIE_BASE;
      ctx.fillRect(16, 17 + bodyBob, 3, 5);
      ctx.fillStyle = PALETTE.SKIN_BASE;
      ctx.fillRect(18, 22 + bodyBob, 2, 2);
    }

    // --- HEAD & FACE ---
    if (dir === 'down') {
      // Face skin
      ctx.fillStyle = PALETTE.SKIN_BASE;
      ctx.fillRect(11, 9 + bodyBob, 10, 8);
      ctx.fillStyle = PALETTE.SKIN_LIGHT;
      ctx.fillRect(12, 10 + bodyBob, 8, 6);

      // Cute Eyes (calm, kind eyes from photo)
      ctx.fillStyle = PALETTE.HAIR_DARK;
      ctx.fillRect(13, 13 + bodyBob, 2, 2);
      ctx.fillRect(17, 13 + bodyBob, 2, 2);

      // Sweet subtle smile
      ctx.fillStyle = '#b05d5d';
      ctx.fillRect(15, 16 + bodyBob, 2, 1);

      // Rosy Cheek Blush
      ctx.fillStyle = PALETTE.BLUSH;
      ctx.fillRect(11, 14 + bodyBob, 2, 1);
      ctx.fillRect(19, 14 + bodyBob, 2, 1);

      // Dark Hair & Bangs (distinct bangs framing forehead like in photo)
      ctx.fillStyle = PALETTE.HAIR_BASE;
      // Top hair
      ctx.fillRect(10, 6 + bodyBob, 12, 4);
      ctx.fillRect(9, 8 + bodyBob, 2, 6);
      ctx.fillRect(21, 8 + bodyBob, 2, 6);
      // Bangs
      ctx.fillStyle = PALETTE.HAIR_DARK;
      ctx.fillRect(11, 8 + bodyBob, 10, 3);
      ctx.fillRect(12, 11 + bodyBob, 3, 1); // Center bang drop
      ctx.fillRect(16, 11 + bodyBob, 3, 1);
      ctx.fillRect(10, 10 + bodyBob, 2, 4); // Side strands
      ctx.fillRect(20, 10 + bodyBob, 2, 4);
      // Hair highlight
      ctx.fillStyle = PALETTE.HAIR_HIGHLIGHT;
      ctx.fillRect(12, 7 + bodyBob, 7, 1);
    } else if (dir === 'up') {
      // Back of head (full dark hair)
      ctx.fillStyle = PALETTE.HAIR_DARK;
      ctx.fillRect(10, 6 + bodyBob, 12, 11);
      ctx.fillRect(9, 8 + bodyBob, 14, 8);
      ctx.fillStyle = PALETTE.HAIR_BASE;
      ctx.fillRect(11, 7 + bodyBob, 10, 8);
      ctx.fillStyle = PALETTE.HAIR_HIGHLIGHT;
      ctx.fillRect(13, 7 + bodyBob, 6, 1);
    } else if (dir === 'left') {
      // Side Face
      ctx.fillStyle = PALETTE.SKIN_BASE;
      ctx.fillRect(11, 9 + bodyBob, 8, 8);
      // Eye & Blush
      ctx.fillStyle = PALETTE.HAIR_DARK;
      ctx.fillRect(12, 13 + bodyBob, 2, 2);
      ctx.fillStyle = PALETTE.BLUSH;
      ctx.fillRect(11, 14 + bodyBob, 2, 1);
      // Hair & Bangs
      ctx.fillStyle = PALETTE.HAIR_DARK;
      ctx.fillRect(12, 6 + bodyBob, 9, 10);
      ctx.fillRect(11, 7 + bodyBob, 4, 5); // Bangs front
      ctx.fillRect(11, 11 + bodyBob, 2, 2);
      ctx.fillStyle = PALETTE.HAIR_HIGHLIGHT;
      ctx.fillRect(14, 7 + bodyBob, 4, 1);
    } else if (dir === 'right') {
      // Side Face
      ctx.fillStyle = PALETTE.SKIN_BASE;
      ctx.fillRect(13, 9 + bodyBob, 8, 8);
      // Eye & Blush
      ctx.fillStyle = PALETTE.HAIR_DARK;
      ctx.fillRect(18, 13 + bodyBob, 2, 2);
      ctx.fillStyle = PALETTE.BLUSH;
      ctx.fillRect(19, 14 + bodyBob, 2, 1);
      // Hair & Bangs
      ctx.fillStyle = PALETTE.HAIR_DARK;
      ctx.fillRect(11, 6 + bodyBob, 9, 10);
      ctx.fillRect(17, 7 + bodyBob, 4, 5); // Bangs front
      ctx.fillRect(19, 11 + bodyBob, 2, 2);
      ctx.fillStyle = PALETTE.HAIR_HIGHLIGHT;
      ctx.fillRect(14, 7 + bodyBob, 4, 1);
    }
  }

  // Generate High-Res 48x48 Portrait of Nyomin for Dialogue Box & Card
  generatePortrait() {
    const { canvas, ctx } = createOffscreenCanvas(48, 48);
    // Soft pastel garden background
    ctx.fillStyle = '#d8f3dc';
    ctx.fillRect(0, 0, 48, 48);
    // Subtle lavender flower dots in background
    ctx.fillStyle = PALETTE.LAVENDER_LIGHT;
    ctx.fillRect(4, 6, 3, 3);
    ctx.fillRect(40, 8, 3, 3);
    ctx.fillRect(8, 14, 2, 2);
    ctx.fillRect(38, 20, 2, 2);

    // Dark grey Hoodie shoulders
    ctx.fillStyle = PALETTE.HOODIE_DARK;
    ctx.fillRect(10, 34, 28, 14);
    ctx.fillStyle = PALETTE.HOODIE_BASE;
    ctx.fillRect(12, 35, 24, 13);
    // Hoodie collar & white drawstrings
    ctx.fillStyle = PALETTE.HOODIE_DARK;
    ctx.fillRect(18, 33, 12, 4);
    ctx.fillStyle = PALETTE.HOODIE_STRING;
    ctx.fillRect(20, 36, 2, 8);
    ctx.fillRect(26, 36, 2, 8);

    // Face
    ctx.fillStyle = PALETTE.SKIN_BASE;
    ctx.fillRect(14, 16, 20, 18);
    ctx.fillStyle = PALETTE.SKIN_LIGHT;
    ctx.fillRect(16, 17, 16, 15);

    // Cheerful, gentle eyes
    ctx.fillStyle = PALETTE.HAIR_DARK;
    ctx.fillRect(18, 23, 3, 3);
    ctx.fillRect(27, 23, 3, 3);
    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(19, 23, 1, 1);
    ctx.fillRect(28, 23, 1, 1);

    // Warm friendly smile with dimple touch
    ctx.fillStyle = '#a65b5b';
    ctx.fillRect(21, 29, 6, 2);
    ctx.fillRect(22, 30, 4, 1);

    // Rosy Pink Blush
    ctx.fillStyle = PALETTE.BLUSH;
    ctx.fillRect(15, 25, 4, 2);
    ctx.fillRect(29, 25, 4, 2);

    // Bangs & Hair (Matching the photo)
    ctx.fillStyle = PALETTE.HAIR_DARK;
    // Hair base volume
    ctx.fillRect(12, 9, 24, 8);
    ctx.fillRect(10, 14, 5, 18);
    ctx.fillRect(33, 14, 5, 18);
    // Bangs framing forehead
    ctx.fillRect(15, 13, 18, 6);
    ctx.fillRect(17, 18, 5, 3); // Left bang strand
    ctx.fillRect(24, 18, 5, 3); // Right bang strand
    ctx.fillRect(22, 18, 2, 1); // Center notch

    // Hair subtle highlights
    ctx.fillStyle = PALETTE.HAIR_HIGHLIGHT;
    ctx.fillRect(16, 10, 16, 2);

    this.sprites['nyomin_portrait'] = canvas;
  }

  get(name) {
    return this.sprites[name] || null;
  }
}
