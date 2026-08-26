/**
 * The town, as data.
 *
 * Nothing here draws. The tile grid is generated from primitives — blobs,
 * streets, groves — so the layout is editable by changing numbers rather than
 * by retyping a character map. `draw.ts` turns the result into pixels.
 */

export const TILE = 8;
export const MAP_W = 48;
export const MAP_H = 92;

/** Pixel size of the whole map. Fits a 390x844 phone with room for the bar. */
export const MAP_PX_W = MAP_W * TILE;
export const MAP_PX_H = MAP_H * TILE;

/**
 * G grass · W water · C rock · S paving · R street · o empty plot
 * T round · B blossom · N pine · R2 fruit · L willow · U bushy · H shrub
 */
export type Tile = string;

export type TreeKind = 'round' | 'blossom' | 'pine' | 'fruit' | 'willow' | 'bushy' | 'shrub' | 'autumn';

export const TREE_KEY: Record<Exclude<TreeKind, 'autumn'>, string> = {
  round: 'T', blossom: 'B', pine: 'N', fruit: 'F', willow: 'L', bushy: 'U', shrub: 'H',
};
export const KEY_TREE: Record<string, TreeKind> = Object.entries(TREE_KEY)
  .reduce((acc, [k, v]) => { acc[v] = k as TreeKind; return acc; }, {} as Record<string, TreeKind>);

export type RoofStyle = 'gable' | 'peak' | 'hip' | 'flat' | 'mansard';
export type WindowKind = 'big' | 'lg' | 'arch' | 'round';
export type DoorKind = 'mid' | 'std' | 'wide' | 'arch';

export interface BuildingSpec {
  id: string;
  /** Tile coordinates and footprint. */
  tx: number; ty: number; tw: number; th: number;
  color: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
  roof: RoofStyle;
  win: WindowKind;
  door: DoorKind;
  awning?: boolean;
  sign?: boolean;
  chimney?: boolean;
  /** Shown under the building on the map. Unlabelled buildings are scenery. */
  label?: string;
  /** Tapping navigates here. Buildings without one are not yet interactive. */
  route?: string;
}

/**
 * Where the fountain sits, in tiles. The Growth Hub entry point, and the
 * single most-opened door in the app — which is why it sits in the bottom-left
 * corner. A phone is held low and gripped at the bottom; the top of a 92-tile
 * map is the hardest part of the screen to reach, and that is exactly where
 * the civic buildings used to be.
 */
export const FOUNTAIN = { tx: 16, ty: 68 } as const;

/**
 * The fountain's basin, in pixels either side of its centre. The plaza is the
 * single biggest thing in town by some margin — bigger than the café — because
 * it is the Growth Hub's front door and the Growth Hub is the app. A landmark
 * you steer by beats a building you have to find.
 *
 * Held in pixels rather than tiles because everything in `drawFountain` is
 * measured off the centre, and `FOUNTAIN_TILES` derives the footprint back out
 * for the walk graph.
 */
export const FOUNTAIN_R = { x: 48, up: 26, down: 30 } as const;

/** The basin's tile footprint — cats route around it rather than through it. */
export const FOUNTAIN_TILES = {
  tx: Math.floor((FOUNTAIN.tx * TILE - FOUNTAIN_R.x) / TILE),
  ty: Math.floor((FOUNTAIN.ty * TILE - FOUNTAIN_R.up) / TILE),
  tw: Math.ceil((FOUNTAIN_R.x * 2) / TILE),
  th: Math.ceil((FOUNTAIN_R.up + FOUNTAIN_R.down) / TILE),
} as const;


/**
 * The greenhouse. It wants a daily visit, so it stays in the same southern
 * band as the fountain — across the square from it, fronting the street that
 * runs down the east side.
 */
export const GREENHOUSE = { tx: 28, ty: 68, tw: 9, th: 6 } as const;

/**
 * The town, ordered north to south — which is also roughly cheapest to
 * dearest in attention. Everything with a `route` lives in the bottom third,
 * inside a thumb's sweep; the north is outskirts you look at rather than
 * places you go.
 */
export const BUILDINGS: BuildingSpec[] = [
  // Every building here has a route — the unnamed scenery buildings (inn,
  // shrine, grocer, workshop, bakery, observatory, nursery) are gone.
  // Removing them freed the full map height so the six destinations plus the
  // fountain and greenhouse can breathe, spread evenly from north to south.

  // Library — northernmost, largest Growth Hub entry. Planted far up so the
  // first thing you see scrolling in is somewhere to go.
  { id: 'library', tx: 4, ty: 10, tw: 10, th: 8, color: 'b', roof: 'peak', win: 'arch', door: 'arch', sign: true, chimney: true, label: 'Library', route: '/habits' },

  // Cat Shelter — upper right. Wide enough to feel like it houses thirty-six
  // cats rather than two.
  { id: 'shelter', tx: 28, ty: 20, tw: 11, th: 8, color: 'd', roof: 'gable', win: 'arch', door: 'arch', sign: true, awning: true, label: 'Cat Shelter', route: '/cats' },

  // Market — mid left.
  { id: 'market', tx: 4, ty: 34, tw: 9, th: 7, color: 'b', roof: 'flat', win: 'lg', door: 'std', awning: true, label: 'Market', route: '/shop' },

  // Mission Hall — mid right.
  { id: 'mission', tx: 28, ty: 43, tw: 9, th: 7, color: 'e', roof: 'mansard', win: 'big', door: 'mid', sign: true, label: 'Mission Hall', route: '/habits' },

  // Archive — lower left, above the fountain square.
  { id: 'archive', tx: 4, ty: 54, tw: 9, th: 7, color: 'h', roof: 'gable', win: 'big', door: 'mid', label: 'Archive', route: '/habits' },

  // Café — the biggest building in town, and the only one that earns it.
  // 12×10 so it reads as the centrepiece it is: the whole economy cashes
  // out here, the cats come here, this is where you spend your focus.
  { id: 'cafe', tx: 25, ty: 52, tw: 13, th: 11, color: 'a', roof: 'gable', win: 'lg', door: 'std', sign: true, awning: true, label: 'Café', route: '/cafe' },
];

/**
 * Land you own but haven't built on. Rendered as a dirt ring with a signpost.
 * One, not four. A plot is a promise, and the compacted town has no room left
 * where a ring of bare dirt reads as land rather than as a stain on the paving
 * — this one sits on the northern approach, clear of every footprint by a tile.
 */
export const EMPTY_PLOTS: Array<{ ty: number; tx: number }> = [
  { ty: 16, tx: 19 },
  { ty: 30, tx: 18 },
];

interface Grove { cy: number; cx: number; r: number; kind: TreeKind }

/** Trees cluster by species instead of scattering evenly. */
const GROVES: Grove[] = [
  { cy: 14, cx: 42, r: 11, kind: 'pine' },
  { cy: 30, cx: 44, r: 9, kind: 'pine' },
  { cy: 10, cx: 5, r: 8, kind: 'blossom' },
  { cy: 40, cx: 3, r: 9, kind: 'fruit' },
  { cy: 56, cx: 45, r: 10, kind: 'willow' },
  { cy: 68, cx: 4, r: 10, kind: 'blossom' },
  { cy: 80, cx: 38, r: 11, kind: 'fruit' },
  { cy: 88, cx: 14, r: 10, kind: 'pine' },
  { cy: 50, cx: 24, r: 7, kind: 'fruit' },
  { cy: 24, cx: 8, r: 7, kind: 'bushy' },
];

/** Stable per-tile noise, so the town looks identical on every render. */
export function noise(a: number, b: number, salt: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function buildTownGrid(): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < MAP_H; y++) {
    grid[y] = [];
    for (let x = 0; x < MAP_W; x++) grid[y][x] = 'G';
  }

  const set = (x: number, y: number, c: Tile) => {
    if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) grid[y][x] = c;
  };
  const rect = (x: number, y: number, w: number, h: number, c: Tile) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c);
  };
  const ellipse = (cy: number, cx: number, ry: number, rx: number, c: Tile) => {
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const dy = (j - cy) / ry, dx = (i - cx) / rx;
        if (dy * dy + dx * dx <= 1) set(i, j, c);
      }
  };

  // Paving blobs — centred on each building cluster, covering the footprint
  // plus a plaza apron. Set BEFORE streets so road tiles always win.
  // (Green pockets were formerly applied after streets, overwriting road tiles
  // back to grass and letting trees grow on roads — removed.)
  ([[14, 9,  6, 12],   // Library     (tx=4,  ty=10, tw=10, th=8)
    [24, 34, 7, 12],   // Cat Shelter (tx=28, ty=20, tw=11, th=8)
    [37, 8,  6, 12],   // Market      (tx=4,  ty=34, tw=9,  th=7)
    [46, 32, 6, 11],   // Mission Hall(tx=28, ty=43, tw=9,  th=7)
    [57, 8,  6, 11],   // Archive     (tx=4,  ty=54, tw=9,  th=7)
    [57, 31, 8, 13],   // Café        (tx=25, ty=52, tw=13, th=11)
    [68, 18, 8, 13],   // Fountain square
    [71, 33, 6, 10],   // Greenhouse yard
  ] as const).forEach(([cy, cx, ry, rx]) => ellipse(cy, cx, ry, rx, 'S'));

  // Rock shelf with a modest fall into a pool.
  rect(30, 0, 14, 5, 'C');
  rect(34, 3, 3, 5, 'W');
  ellipse(10, 36, 3, 5, 'W');

  // Streets. Each point is [tx, ty]. The helper draws an L-shape between each
  // adjacent pair — horizontal leg first, then vertical corner.
  //
  // Layout guarantees (no segment runs through a building):
  //   Library ends ty=17; Shelter starts ty=20 → y=18 corridor is clear.
  //   All left buildings end tx≤13 → left spine at tx=14 is always clear.
  //   All right buildings end tx≤38 → right spine at tx=39 is always clear.
  //   Market ends ty=40; Mission starts ty=43 → y=41 cross is clear.
  const street = (pts: Array<[number, number]>, w: number) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      rect(Math.min(ax, bx), ay, Math.abs(bx - ax) + w, w, 'R');
      rect(bx, Math.min(ay, by), w, Math.abs(by - ay) + w, 'R');
    }
  };
  // Left spine: below Library (y=18) straight down to Fountain (y=65).
  street([[14, 18], [14, 65]], 2);
  // Top cross: clear corridor at y=18 between Library and Shelter.
  street([[14, 18], [39, 18]], 2);
  // Right spine: y=18 down to y=63, right of Shelter, Mission, and Café.
  street([[39, 18], [39, 63]], 2);
  // Mid cross: below Market (ty+th=41), above Mission (ty=43).
  street([[14, 41], [28, 41]], 2);
  // Lower cross: left spine to Café's west face.
  street([[14, 52], [25, 52]], 2);
  // Fountain stub.
  street([[14, 65], [16, 65]], 2);

  EMPTY_PLOTS.forEach((p) => ellipse(p.ty, p.tx, 2, 3, 'o'));

  const groveAt = (tx: number, ty: number): TreeKind | null => {
    for (let i = 0; i < GROVES.length; i++) {
      const g = GROVES[i];
      const d = Math.hypot(tx - g.cx, ty - g.cy);
      // Perturbing the radius per tile keeps grove edges ragged, not circular.
      if (d < g.r * (0.7 + noise(tx, ty, 60 + i) * 0.5)) return g.kind;
    }
    return null;
  };

  for (let ty = 1; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (grid[ty][tx] !== 'G') continue;
      const g = groveAt(tx, ty);
      if (noise(tx, ty, 1) <= (g ? 0.72 : 0.9)) continue;
      let kind: TreeKind = g ?? 'round';
      if (!g && noise(tx, ty, 71) > 0.85) kind = 'shrub';
      if (kind === 'bushy' && noise(tx, ty, 72) > 0.4) kind = 'round';
      if (kind === 'autumn') kind = 'fruit';
      grid[ty][tx] = TREE_KEY[kind as Exclude<TreeKind, 'autumn'>];
    }
  }

  return grid;
}

// Who wanders the town is no longer a fixed list — it's whatever you've
// adopted from the shelter. The starting three live in constants/gacha.ts
// alongside the rest of the collection rules.
