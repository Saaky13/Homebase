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

/** Where the fountain sits, in tiles. The Growth Hub entry point. */
export const FOUNTAIN = { tx: 16, ty: 15 } as const;
export const GREENHOUSE = { tx: 5, ty: 50, tw: 9, th: 6 } as const;

export const BUILDINGS: BuildingSpec[] = [
  { id: 'library', tx: 6, ty: 9, tw: 6, th: 5, color: 'b', roof: 'peak', win: 'arch', door: 'arch', sign: true, chimney: true, label: 'Library', route: '/habits' },
  { id: 'mission', tx: 21, ty: 8, tw: 5, th: 5, color: 'e', roof: 'mansard', win: 'big', door: 'mid', sign: true, label: 'Mission Hall', route: '/habits' },
  { id: 'house-1', tx: 22, ty: 16, tw: 4, th: 4, color: 'c', roof: 'hip', win: 'big', door: 'mid' },
  { id: 'archive', tx: 6, ty: 17, tw: 5, th: 4, color: 'h', roof: 'gable', win: 'big', door: 'mid', label: 'Archive', route: '/habits' },
  { id: 'house-2', tx: 12, ty: 20, tw: 4, th: 4, color: 'f', roof: 'hip', win: 'round', door: 'mid' },
  { id: 'house-3', tx: 17, ty: 3, tw: 4, th: 4, color: 'a', roof: 'gable', win: 'big', door: 'mid', chimney: true },

  { id: 'cafe', tx: 4, ty: 27, tw: 5, th: 5, color: 'a', roof: 'gable', win: 'lg', door: 'std', sign: true, awning: true, label: 'Café', route: '/cafe' },
  { id: 'house-4', tx: 11, ty: 25, tw: 4, th: 4, color: 'c', roof: 'peak', win: 'big', door: 'mid' },
  { id: 'market', tx: 17, ty: 28, tw: 5, th: 4, color: 'b', roof: 'flat', win: 'lg', door: 'std', awning: true, label: 'Market', route: '/shop' },
  { id: 'inn', tx: 27, ty: 23, tw: 5, th: 5, color: 'h', roof: 'mansard', win: 'big', door: 'mid', chimney: true, label: 'Inn' },
  { id: 'house-5', tx: 33, ty: 20, tw: 4, th: 4, color: 'b', roof: 'hip', win: 'big', door: 'mid' },
  { id: 'observatory', tx: 39, ty: 25, tw: 4, th: 5, color: 'f', roof: 'peak', win: 'arch', door: 'mid', label: 'Observatory' },
  { id: 'house-6', tx: 28, ty: 32, tw: 4, th: 4, color: 'a', roof: 'gable', win: 'big', door: 'mid' },
  { id: 'bakery', tx: 34, ty: 31, tw: 5, th: 4, color: 'g', roof: 'hip', win: 'big', door: 'mid', sign: true, label: 'Bakery' },
  { id: 'house-7', tx: 5, ty: 35, tw: 5, th: 5, color: 'b', roof: 'mansard', win: 'big', door: 'mid', chimney: true },
  { id: 'house-8', tx: 12, ty: 37, tw: 4, th: 4, color: 'h', roof: 'gable', win: 'round', door: 'mid' },

  { id: 'grocer', tx: 16, ty: 52, tw: 5, th: 5, color: 'a', roof: 'gable', win: 'lg', door: 'std', sign: true, awning: true, label: 'Grocer' },
  { id: 'house-9', tx: 30, ty: 49, tw: 5, th: 5, color: 'c', roof: 'hip', win: 'big', door: 'mid', awning: true },
  { id: 'house-10', tx: 36, ty: 51, tw: 4, th: 4, color: 'b', roof: 'gable', win: 'big', door: 'mid' },
  { id: 'workshop', tx: 29, ty: 57, tw: 5, th: 4, color: 'h', roof: 'flat', win: 'lg', door: 'wide', label: 'Workshop' },
  { id: 'house-11', tx: 8, ty: 61, tw: 4, th: 4, color: 'e', roof: 'peak', win: 'big', door: 'mid' },
  { id: 'nursery', tx: 16, ty: 62, tw: 5, th: 4, color: 'f', roof: 'gable', win: 'big', door: 'mid', sign: true, label: 'Nursery' },
  { id: 'house-12', tx: 33, ty: 66, tw: 5, th: 5, color: 'a', roof: 'mansard', win: 'big', door: 'mid', chimney: true },
  { id: 'house-13', tx: 10, ty: 73, tw: 5, th: 5, color: 'b', roof: 'gable', win: 'big', door: 'std', awning: true },
  { id: 'house-14', tx: 18, ty: 76, tw: 4, th: 4, color: 'c', roof: 'hip', win: 'round', door: 'mid' },
  { id: 'shrine', tx: 30, ty: 73, tw: 5, th: 4, color: 'h', roof: 'gable', win: 'big', door: 'mid', sign: true, label: 'Shrine' },
  { id: 'house-15', tx: 24, ty: 80, tw: 4, th: 4, color: 'g', roof: 'peak', win: 'big', door: 'mid' },
];

/** Land you own but haven't built on. Rendered as a dirt ring with a signpost. */
export const EMPTY_PLOTS: Array<{ ty: number; tx: number }> = [
  { ty: 62, tx: 10 }, { ty: 70, tx: 42 }, { ty: 84, tx: 16 }, { ty: 54, tx: 44 },
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
  ([[16, 15, 13, 14], [30, 25, 11, 15], [44, 17, 11, 15], [52, 33, 10, 12],
    [64, 20, 11, 16], [38, 37, 9, 9], [72, 34, 9, 10], [78, 18, 9, 13]] as const)
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
  street([[15, 20], [15, 30], [25, 30], [25, 44], [13, 44], [13, 58], [27, 58], [27, 72], [20, 72], [20, 84]], 2);
  street([[15, 24], [6, 24], [6, 36]], 2);
  street([[25, 34], [36, 34], [36, 48]], 2);
  street([[13, 50], [6, 50], [6, 62]], 2);
  street([[27, 64], [38, 64], [38, 76]], 2);

  // Pockets left deliberately empty.
  ([[26, 34, 4, 5], [46, 7, 4, 4], [58, 9, 3, 4], [48, 40, 4, 4], [80, 11, 4, 5],
    [76, 38, 4, 5], [34, 44, 3, 4], [68, 10, 3, 4], [22, 40, 3, 4], [86, 26, 4, 7]] as const)
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

/**
 * The cats that wander town before anything has been unlocked. Fixed
 * positions and facings used to live here; a roaming behaviour picks both at
 * runtime now, so all this needs to carry is who shows up. Unlocking cats
 * appends to this list rather than replacing it — see TownMap.
 */
export const STARTER_TOWN_CATS: string[] = [
  'mochi',
  'pistachio',
  'indigo',
  'clover',
  'sunbeam',
  'koi',
];
