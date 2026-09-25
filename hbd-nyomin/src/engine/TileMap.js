// Meadow Map Layout, Collisions, and Interactive Entities - Optimized for Vertical Mobile Experience
export class TileMap {
  constructor() {
    this.tileSize = 32;
    this.width = 16;  // 16 columns (perfect portrait width)
    this.height = 28; // 28 rows (scenic vertical journey from bottom to top)

    // Tile Types:
    // 0: Grass Base
    // 1: Grass with Wildflowers
    // 2: Cobblestone Path
    // 3: Lavender Flower Bed
    // 4: Water
    // 5: Wooden Fence (Solid)
    this.tiles = [];
    this.solidMask = [];

    // Interactive Points of Interest (Arranged vertically from bottom to top)
    this.interactives = [
      {
        id: 'bench',
        x: 5,
        y: 24,
        prompt: 'Look at Bench 🪑',
        dialogue: [
          "A cozy wooden park bench! 🪑",
          "A lovely spot for me to sit and rest during the 1-hour commute trip back home 🚌💨"
        ]
      },
      {
        id: 'flower_spot',
        x: 5,
        y: 19,
        prompt: 'Smell Lavender 🌸',
        dialogue: [
          "*sniff sniff* 🌸",
          "Mmm, these lavender flowers smell so fresh and calming!",
          "Taking a deep breath here really refreshes my mind after all my university study sessions~ ✨"
        ]
      },
      {
        id: 'signpost',
        x: 8,
        y: 12,
        prompt: 'Read Signpost 📜',
        dialogue: [
          "Oh, a wooden signpost! It says: 📜",
          "\"Secret Meadow Path: Keep going straight up!\"",
          "\"Something sparkling and very special awaits ahead at the top!\" ✨"
        ]
      },
      {
        id: 'birthday_chest',
        x: 8,
        y: 4,
        prompt: 'Open Birthday Chest! 🎁',
        isChest: true,
        isOpened: false,
        dialogue: [
          "Whoa, look at this gorgeous treasure chest! 🎁",
          "It has a cute pink ribbon and my name written on it...",
          "Let's open it! ✨"
        ]
      }
    ];

    // Tree positions (top-left tile coordinate, footprint: 2x2 solid trunk)
    this.trees = [
      // Top boundary grove
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 11, y: 1 },
      { x: 13, y: 2 },
      // Upper sides
      { x: 1, y: 5 },
      { x: 13, y: 6 },
      { x: 2, y: 10 },
      { x: 12, y: 10 },
      // Mid sides near pond
      { x: 1, y: 15 },
      { x: 2, y: 20 },
      { x: 13, y: 21 },
      // Bottom sides
      { x: 1, y: 24 },
      { x: 12, y: 25 }
    ];

    this.initMap();
  }

  initMap() {
    // Generate base meadow grid
    for (let y = 0; y < this.height; y++) {
      this.tiles[y] = [];
      this.solidMask[y] = [];
      for (let x = 0; x < this.width; x++) {
        // Border fences
        if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
          this.tiles[y][x] = 5; // fence
          this.solidMask[y][x] = true;
        } else {
          // Default grass with subtle flower variations
          const rand = (x * 7 + y * 13) % 10;
          this.tiles[y][x] = (rand > 7) ? 1 : 0;
          this.solidMask[y][x] = false;
        }
      }
    }

    // Lay out vertical scenic cobblestone path winding upwards from (7, 24) to chest at (8, 4)
    const pathCoords = [
      // Starting area near bench (5, 24)
      [6, 24], [7, 24], [8, 24],
      // Going north
      [7, 23], [8, 23],
      [7, 22], [8, 22],
      [7, 21], [8, 21],
      // Curve slightly west past lavender patch at (5, 19)
      [6, 20], [7, 20],
      [6, 19], [7, 19],
      [6, 18], [7, 18],
      // Curve back towards center between pond and trees
      [7, 17], [8, 17],
      [7, 16], [8, 16],
      [7, 15], [8, 15],
      [7, 14], [8, 14],
      [7, 13], [8, 13],
      // Path by signpost at (8, 12)
      [7, 12], [8, 12],
      [7, 11], [8, 11],
      // Straight north to the birthday clearing
      [7, 10], [8, 10],
      [7, 9], [8, 9],
      [7, 8], [8, 8],
      [7, 7], [8, 7],
      [7, 6], [8, 6],
      [7, 5], [8, 5], [9, 5]
    ];

    pathCoords.forEach(([px, py]) => {
      if (this.tiles[py] && this.tiles[py][px] !== undefined) {
        this.tiles[py][px] = 2; // Path
      }
    });

    // Lavender patch around (5, 19)
    const lavenderCoords = [
      [4, 19], [5, 19], [4, 18], [5, 18]
    ];
    lavenderCoords.forEach(([lx, ly]) => {
      this.tiles[ly][lx] = 3;
    });

    // Small scenic duck pond on the right at (10, 15) to (12, 17)
    for (let wy = 15; wy <= 17; wy++) {
      for (let wx = 10; wx <= 12; wx++) {
        this.tiles[wy][wx] = 4; // Water
        this.solidMask[wy][wx] = true;
      }
    }

    // Mark trees as solid
    this.trees.forEach(t => {
      if (this.solidMask[t.y + 1]) {
        this.solidMask[t.y + 1][t.x] = true;
        this.solidMask[t.y + 1][t.x + 1] = true;
      }
    });

    // Mark solid objects
    this.solidMask[24][5] = true; // Bench
    this.solidMask[12][8] = true; // Signpost
    this.solidMask[4][8] = true;  // Birthday Chest
  }

  isSolid(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return true;
    }
    return !!this.solidMask[y][x];
  }

  // Check if player is adjacent to or on an interactive entity
  getInteractiveTarget(playerX, playerY, dirX, dirY) {
    // Check facing tile first
    const targetX = playerX + dirX;
    const targetY = playerY + dirY;

    let item = this.interactives.find(i => i.x === targetX && i.y === targetY);
    if (item) return item;

    // Check current tile (e.g. stepping inside flower bed)
    item = this.interactives.find(i => i.x === playerX && i.y === playerY);
    if (item) return item;

    // Check adjacent tiles (radius of 1)
    return this.interactives.find(i => {
      const dist = Math.abs(i.x - playerX) + Math.abs(i.y - playerY);
      return dist <= 1;
    }) || null;
  }
}
