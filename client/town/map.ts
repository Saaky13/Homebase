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
  // Outskirts. None of these are interactive; they're the town's character.
  // The five anonymous cottages that used to fill this band are gone — they
  // were doors that don't open, and deleting them bought every building that
  // stayed a tile or two in each direction and let the whole town pull tighter.
  { id: 'inn', tx: 22, ty: 12, tw: 6, th: 6, color: 'h', roof: 'mansard', win: 'big', door: 'mid', chimney: true, label: 'Inn' },
  { id: 'shrine', tx: 13, ty: 19, tw: 6, th: 5, color: 'h', roof: 'gable', win: 'big', door: 'mid', sign: true, label: 'Shrine' },
  { id: 'grocer', tx: 24, ty: 21, tw: 6, th: 6, color: 'a', roof: 'gable', win: 'lg', door: 'std', sign: true, awning: true, label: 'Grocer' },

  // The middle stretch — still scenery, but close enough to the town proper
  // that it reads as approach rather than countryside.
  { id: 'workshop', tx: 21, ty: 31, tw: 6, th: 5, color: 'h', roof: 'flat', win: 'lg', door: 'wide', label: 'Workshop' },
  { id: 'bakery', tx: 12, ty: 33, tw: 6, th: 5, color: 'g', roof: 'hip', win: 'big', door: 'mid', sign: true, label: 'Bakery' },
  { id: 'observatory', tx: 31, ty: 33, tw: 5, th: 6, color: 'f', roof: 'peak', win: 'arch', door: 'mid', label: 'Observatory' },
  { id: 'nursery', tx: 19, ty: 39, tw: 6, th: 5, color: 'f', roof: 'gable', win: 'big', door: 'mid', sign: true, label: 'Nursery' },

  // The town proper. Every route in the app is below this line, and the two
  // you open most — the Growth Hub's fountain and the café — are the lowest.
  { id: 'market', tx: 30, ty: 45, tw: 6, th: 5, color: 'b', roof: 'flat', win: 'lg', door: 'std', awning: true, label: 'Market', route: '/shop' },
  // Second only to the café. Thirty-six cats live here; a four-tile cottage
  // read like somewhere you'd keep two.
  { id: 'shelter', tx: 16, ty: 45, tw: 8, th: 6, color: 'd', roof: 'gable', win: 'arch', door: 'arch', sign: true, awning: true, label: 'Cat Shelter', route: '/cats' },
  { id: 'library', tx: 4, ty: 52, tw: 7, th: 6, color: 'b', roof: 'peak', win: 'arch', door: 'arch', sign: true, chimney: true, label: 'Library', route: '/habits' },
  // The biggest building in town, and the only one that earns it — the café is
  // where the whole economy cashes out.
  { id: 'cafe', tx: 27, ty: 52, tw: 9, th: 8, color: 'a', roof: 'gable', win: 'lg', door: 'std', sign: true, awning: true, label: 'Café', route: '/cafe' },
  { id: 'mission', tx: 13, ty: 51, tw: 6, th: 6, color: 'e', roof: 'mansard', win: 'big', door: 'mid', sign: true, label: 'Mission Hall', route: '/habits' },
  { id: 'archive', tx: 25, ty: 61, tw: 6, th: 5, color: 'h', roof: 'gable', win: 'big', door: 'mid', label: 'Archive', route: '/habits' },
];

/**
 * Land you own but haven't built on. Rendered as a dirt ring with a signpost.
 * One, not four. A plot is a promise, and the compacted town has no room left
 * where a ring of bare dirt reads as land rather than as a stain on the paving
 * — this one sits on the northern approach, clear of every footprint by a tile.
 */
export const EMPTY_PLOTS: Array<{ ty: number; tx: number }> = [
  { ty: 15, tx: 16 },
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

  // The paved area is a union of blobs, so the town's outline stays ragged.
  // Weighted south: the biggest lobes are the lowest, so the town has real mass
  // under the thumb instead of a narrow tail of paving.
  ([[17, 22, 8, 11], [27, 22, 8, 13], [38, 22, 8, 14], [37, 31, 7, 8],
    [49, 24, 8, 16], [58, 22, 9, 16], [56, 10, 8, 9],
    // The fountain square and the greenhouse yard.
    [68, 16, 8, 12], [69, 31, 7, 10]] as const)
    .forEach(([cy, cx, ry, rx]) => ellipse(cy, cx, ry, rx, 'S'));

  // Rock shelf with a modest fall into a pool.
  rect(30, 0, 14, 5, 'C');
  rect(34, 3, 3, 5, 'W');
  ellipse(10, 36, 3, 5, 'W');

  // Streets wander through waypoints rather than running straight.
  const street = (pts: Array<[number, number]>, w: number) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      rect(Math.min(ax, bx), ay, Math.abs(bx - ax) + w, w, 'R');
      rect(bx, Math.min(ay, by), w, Math.abs(by - ay) + w, 'R');
    }
  };
  // The spine runs the length of the map and finishes at the fountain square.
  street([[20, 10], [20, 28], [10, 28], [10, 51], [22, 51], [22, 62], [16, 62]], 2);
  street([[20, 19], [37, 19], [37, 44]], 2);

  // Pockets left deliberately empty.
  ([[15, 7, 5, 5], [28, 38, 4, 5], [45, 8, 5, 5], [63, 41, 4, 5]] as const)
    .forEach(([cy, cx, ry, rx]) => ellipse(cy, cx, ry, rx, 'G'));

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
