/**
 * The greenhouse roster: what you can grow, how fast, and what it pays.
 *
 * Sprites are procedural, the same bet `catSprites.ts` makes. Nine species
 * across four growth stages plus a husk is fifty grids to author by hand and
 * keep in sync, which is how they drift apart. Instead each species is a short
 * draw function over shared primitives (pot, stem, leaf, bloom) that reads the
 * stage as a size, so a plant genuinely grows rather than cutting between
 * unrelated pictures.
 *
 * Nothing here touches React or state — the same rule `gacha.ts` follows, for
 * the same reason: it gets called from inside state updaters.
 */

export type PlantStage = 'seed' | 'sprout' | 'growing' | 'mature' | 'husk';

export type PlantPalette = Record<string, string>;

export interface PlantSpec {
  id: string;
  name: string;
  /** Account level the seed rack wants before it will sell you one. */
  level: number;
  cost: number;
  /** Waterings — days you showed up — before it's mature. */
  daysToMature: number;
  /** Coins paid into the pot each time you water it once mature. */
  coinsPerDay: number;
  /** Consecutive dry days that kill it. */
  dieAfter: number;
  blurb: string;
  /** Two swatches for the seed packet in the rack. */
  swatch: [string, string];
  leaves: { L: string; l: string; d: string };
  extra?: PlantPalette;
}

/* ------------------------------ the roster ----------------------------- */

/**
 * Two properties worth preserving if these get retuned:
 *
 * 1. Cost ÷ coinsPerDay lands near 11 for every species, so nothing is a trap.
 *    The expensive plants aren't better per coin, they're better *per socket* —
 *    which is what makes a bench upgrade worth buying.
 * 2. Expensive means richer *and* more fragile. A Moonflower dies if you miss a
 *    single day. A veteran's greenhouse is a claim about their consistency.
 */
export const PLANT_SPECIES: Record<string, PlantSpec> = {
  mung: {
    id: 'mung', name: 'Mung Sprout', level: 1, cost: 10,
    daysToMature: 3, coinsPerDay: 3, dieAfter: 4,
    blurb: 'Up in three days. Forgives a bad week.',
    swatch: ['#8FCB70', '#D6EFC0'],
    leaves: { L: '#7FC25F', l: '#B6E39A', d: '#4E8C3C' },
  },
  spider: {
    id: 'spider', name: 'Spider Plant', level: 1, cost: 60,
    daysToMature: 4, coinsPerDay: 5, dieAfter: 4,
    blurb: 'Throws out pups. Nearly impossible to kill.',
    swatch: ['#6FB868', '#EDF6D8'],
    leaves: { L: '#6FB868', l: '#E8F4CE', d: '#437F45' },
  },
  aloe: {
    id: 'aloe', name: 'Aloe', level: 2, cost: 90,
    daysToMature: 5, coinsPerDay: 8, dieAfter: 6,
    blurb: 'Stores its own water. The one that waits for you.',
    swatch: ['#7FB894', '#C4E2C6'],
    leaves: { L: '#7FB894', l: '#B8DDBE', d: '#4E8467' },
  },
  mint: {
    id: 'mint', name: 'Mint', level: 3, cost: 120,
    daysToMature: 4, coinsPerDay: 11, dieAfter: 3,
    blurb: 'Fast and greedy. Wants water on the day.',
    swatch: ['#6EC08A', '#B9E8C4'],
    leaves: { L: '#6EC08A', l: '#A9E0B8', d: '#3D8459' },
  },
  lavender: {
    id: 'lavender', name: 'Lavender', level: 4, cost: 180,
    daysToMature: 6, coinsPerDay: 16, dieAfter: 3,
    blurb: 'Silver leaves, purple spikes. Scents the whole room.',
    swatch: ['#A88ED8', '#9DAE90'],
    leaves: { L: '#8FA286', l: '#B7C6AE', d: '#66785F' },
    extra: { F: '#9B7BD4', f: '#C4AEEC' },
  },
  monstera: {
    id: 'monstera', name: 'Monstera', level: 5, cost: 260,
    daysToMature: 7, coinsPerDay: 24, dieAfter: 2,
    blurb: 'Enormous split leaves. Not a patient plant.',
    swatch: ['#3F8E52', '#6FBE76'],
    leaves: { L: '#3F8E52', l: '#6FBE76', d: '#2A6338' },
  },
  orchid: {
    id: 'orchid', name: 'Orchid', level: 6, cost: 340,
    daysToMature: 8, coinsPerDay: 32, dieAfter: 2,
    blurb: 'Difficult on purpose. Blooms for those who show up.',
    swatch: ['#E79ABF', '#5C9A6B'],
    leaves: { L: '#5C9A6B', l: '#83BC8A', d: '#3D6E4C' },
    extra: { F: '#E79ABF', f: '#FBD6E6', X: '#B8558C' },
  },
  tea: {
    id: 'tea', name: 'Tea Bush', level: 7, cost: 450,
    daysToMature: 10, coinsPerDay: 44, dieAfter: 3,
    blurb: 'Ten days to establish. Then it pays like a bush should.',
    swatch: ['#4C8F4E', '#FFF6E4'],
    leaves: { L: '#4C8F4E', l: '#77B471', d: '#33683A' },
    extra: { F: '#FFF6E4', f: '#F2E3B8' },
  },
  moonflower: {
    id: 'moonflower', name: 'Moonflower', level: 8, cost: 650,
    daysToMature: 12, coinsPerDay: 65, dieAfter: 1,
    blurb: 'Opens at night. Miss one day and it is gone.',
    swatch: ['#DCE4FF', '#4E7E93'],
    leaves: { L: '#4E8E7E', l: '#79B7A0', d: '#33685E' },
    extra: { F: '#EAF0FF', f: '#FFFFFF', X: '#B9CDF2' },
  },
};

/** Rack order — cheapest first, which is also unlock order. */
export const PLANT_ORDER = [
  'mung', 'spider', 'aloe', 'mint', 'lavender',
  'monstera', 'orchid', 'tea', 'moonflower',
];

export const getPlant = (id: string): PlantSpec | undefined => PLANT_SPECIES[id];

/* ------------------------------ growth math ---------------------------- */

/**
 * Growth is measured in waterings, never in elapsed time. A plant you ignored
 * for a week is exactly where you left it — older, thirstier, no further along.
 * That is the whole point of the room.
 */
export function growthStage(
  waterCount: number,
  daysToMature: number
): Exclude<PlantStage, 'husk'> {
  if (waterCount >= daysToMature) return 'mature';

  // "Three days and it sprouts" is the promise. Species that mature faster than
  // that sprout on their second-to-last watering instead of never sprouting.
  const sproutAt = Math.min(3, daysToMature - 1);
  if (waterCount < sproutAt) return 'seed';

  const growAt = sproutAt + Math.ceil((daysToMature - sproutAt) / 2);
  return waterCount < growAt ? 'sprout' : 'growing';
}

/** How far along, 0–1, for the progress ring under a pot. */
export function growthProgress(waterCount: number, daysToMature: number): number {
  return Math.max(0, Math.min(1, waterCount / Math.max(1, daysToMature)));
}

/** Watering on a day you did the real work pays half again as much. */
export const BLOOM_BONUS = 1.5;

/** Unharvested coins stop piling up after this many waterings' worth. */
export const PENDING_CAP_DAYS = 3;

export function yieldForWatering(spec: PlantSpec, bloom: boolean): number {
  return Math.round(spec.coinsPerDay * (bloom ? BLOOM_BONUS : 1));
}

/* ------------------------------ sprite grid ---------------------------- */

export const PLANT_W = 28;
export const PLANT_H = 36;
/** Rows below this are pot; stems emerge from here. */
const SOIL_Y = 26;
const CX = 14;

type Grid = string[][];

const POT: PlantPalette = {
  P: '#D08A6A', p: '#E8AF8E', q: '#A9694E',
  D: '#6B4B38', e: '#4F3728',
};

/** Wilting is a palette move, not a different plant — same shape, drier. */
const WILT: PlantPalette = {
  L: '#A8A567', l: '#C4BE8A', d: '#7E7A49',
  S: '#8E8B55', s: '#A9A570',
  F: '#C6B99C', f: '#DBD2BC', X: '#B0A488',
};

const HUSK: PlantPalette = {
  L: '#9A8461', l: '#B49C77', d: '#6F5C42',
  S: '#7E6A4C', s: '#96805F',
  ...POT,
  D: '#7D6551', e: '#5F4C3C',
};

function blank(): Grid {
  return Array.from({ length: PLANT_H }, () => Array(PLANT_W).fill('.'));
}

function fill(g: Grid, x: number, y: number, w: number, h: number, k: string) {
  for (let j = Math.max(0, y); j < Math.min(PLANT_H, y + h); j++) {
    for (let i = Math.max(0, x); i < Math.min(PLANT_W, x + w); i++) g[j][i] = k;
  }
}

const dot = (g: Grid, x: number, y: number, k: string) => fill(g, x, y, 1, 1, k);

/** A filled ellipse, rasterised a row at a time. The leaf workhorse. */
function blob(g: Grid, cx: number, cy: number, rx: number, ry: number, k: string) {
  for (let j = -ry; j <= ry; j++) {
    const t = j / (ry + 0.5);
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half < 1) continue;
    fill(g, cx - half, cy + j, half * 2 + 1, 1, k);
  }
}

/** A vertical stem with a lit left edge. */
function stem(g: Grid, x: number, topY: number, k = 'S', kl = 's') {
  fill(g, x, topY, 2, SOIL_Y - topY, k);
  fill(g, x, topY, 1, SOIL_Y - topY, kl);
}

/**
 * A strap leaf: steps outward and then falls, so it arcs instead of pointing.
 * `dir` is -1 left, 1 right; `lift` is how high it rises before it droops.
 */
function strap(
  g: Grid,
  cx: number,
  cy: number,
  dir: number,
  len: number,
  lift: number,
  k: string,
  kl?: string
) {
  let x = cx;
  let y = cy;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    x += dir;
    y += t < 0.45 ? -1 : t < 0.7 ? 0 : 1;
    const thick = i < len - 2 ? 2 : 1;
    fill(g, dir < 0 ? x : x - thick + 1, y, thick, 1, k);
    if (kl && i % 3 === 0) dot(g, x, y, kl);
    void lift;
  }
}

function drawPot(g: Grid, dry = false) {
  // Rim, then the body tapering in toward the base.
  fill(g, 4, 25, 20, 3, 'P');
  fill(g, 4, 25, 20, 1, 'p');
  for (let i = 0; i < 7; i++) {
    const inset = Math.floor((i * 2) / 6);
    fill(g, 5 + inset, 28 + i, 18 - inset * 2, 1, 'P');
    dot(g, 5 + inset, 28 + i, 'p');
    dot(g, 22 - inset, 28 + i, 'q');
  }
  fill(g, 7, 35, 14, 1, 'q');
  fill(g, 4, 27, 20, 1, 'q');

  // Soil sits in the rim's mouth. Dry soil is paler and cracked.
  fill(g, 6, 25, 16, 2, dry ? 'e' : 'D');
  dot(g, 9, 25, 'e');
  dot(g, 15, 25, 'e');
  dot(g, 19, 26, 'e');
}

/* ----------------------------- the species ----------------------------- */

/** `n` is 1 sprout, 2 growing, 3 mature — the same knob for every species. */
type DrawFn = (g: Grid, n: number) => void;

const sprig = (g: Grid, x: number, top: number, spread: number) => {
  stem(g, x, top);
  blob(g, x - spread, top + 1, 3, 2, 'L');
  blob(g, x + spread + 1, top + 1, 3, 2, 'L');
  dot(g, x - spread, top, 'l');
  dot(g, x + spread + 1, top, 'l');
};

const DRAW: Record<string, DrawFn> = {
  mung: (g, n) => {
    const stalks: [number, number, number][] = [
      [13, 18, 3], [8, 21, 3], [18, 20, 3],
    ];
    stalks.slice(0, n).forEach(([x, top, sp]) => sprig(g, x, top - (n - 1) * 2, sp));
  },

  spider: (g, n) => {
    const count = [3, 5, 8][n - 1];
    const len = [5, 7, 9][n - 1];
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      const spread = Math.floor(i / 2);
      strap(g, CX + dir, SOIL_Y - 1 - spread * 2, dir, len - spread, 3, 'L', 'l');
    }
    if (n === 3) {
      // Pups on runners — the plant's whole personality.
      [[2, 14], [25, 16]].forEach(([px, py]) => {
        fill(g, px, py - 3, 1, 3, 'd');
        blob(g, px, py, 2, 2, 'L');
        dot(g, px, py - 1, 'l');
      });
    }
  },

  aloe: (g, n) => {
    const count = [3, 5, 7][n - 1];
    const tall = [9, 13, 17][n - 1];
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      const rank = Math.floor(i / 2);
      const h = tall - rank * 3;
      const lean = rank * 2 * dir;
      for (let j = 0; j < h; j++) {
        const t = j / h;
        const w = Math.max(1, Math.round(3 - t * 2));
        const x = CX + Math.round(lean * t) + (dir < 0 ? -1 : 0);
        fill(g, x - Math.floor(w / 2), SOIL_Y - 1 - j, w, 1, 'L');
        // Pale teeth down the edges, the way an aloe actually reads.
        if (j % 3 === 1) dot(g, x - Math.floor(w / 2), SOIL_Y - 1 - j, 'l');
      }
    }
    fill(g, CX - 3, SOIL_Y - 2, 6, 2, 'd');
  },

  mint: (g, n) => {
    const top = [19, 15, 10][n - 1];
    stem(g, CX - 1, top, 'd', 'L');
    const tiers = [2, 3, 4][n - 1];
    for (let i = 0; i < tiers; i++) {
      const y = SOIL_Y - 3 - i * Math.floor((SOIL_Y - top) / tiers);
      const r = 4 - Math.floor(i / 2);
      blob(g, CX - 4, y, r, r - 1, 'L');
      blob(g, CX + 4, y, r, r - 1, 'L');
      dot(g, CX - 5, y - 1, 'l');
      dot(g, CX + 3, y - 1, 'l');
      dot(g, CX - 4, y + 1, 'd');
      dot(g, CX + 4, y + 1, 'd');
    }
    blob(g, CX, top + 1, 3, 2, 'L');
  },

  lavender: (g, n) => {
    const count = [2, 4, 6][n - 1];
    const tall = [8, 13, 20][n - 1];
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      const rank = Math.floor(i / 2);
      const x = CX + dir * (1 + rank * 3);
      const top = SOIL_Y - (tall - rank * 3);
      fill(g, x, top + 5, 1, SOIL_Y - top - 5, 'S');
      // The spike: offset buds up the stem rather than a solid bar.
      for (let j = 0; j < 6; j++) {
        const bx = x + (j % 2 ? 0 : -1);
        fill(g, bx, top + j, 2, 1, j < 3 ? 'f' : 'F');
      }
      dot(g, x, top - 1, 'f');
    }
    // Narrow silver foliage at the base.
    for (let i = -4; i <= 4; i += 2) {
      fill(g, CX + i, SOIL_Y - 4, 1, 4, 'L');
      dot(g, CX + i, SOIL_Y - 4, 'l');
    }
  },

  monstera: (g, n) => {
    const leaves: [number, number, number, number][] = [
      [CX - 6, 17, 5, -1], [CX + 6, 14, 6, 1], [CX - 1, 9, 7, 0], [CX + 8, 21, 4, 1],
    ];
    leaves.slice(0, [1, 2, 4][n - 1]).forEach(([lx, ly, r, dir]) => {
      // Petiole from the soil up to the leaf.
      for (let j = SOIL_Y - 1; j > ly; j--) {
        const t = (SOIL_Y - j) / (SOIL_Y - ly);
        fill(g, CX + Math.round((lx - CX) * t * t), j, 1, 1, 'd');
      }
      blob(g, lx, ly, r, r - 1, 'L');
      blob(g, lx - dir, ly - 1, r - 2, r - 3, 'l');
      // The splits. A monstera without fenestration is just a big leaf.
      for (let j = -r + 2; j <= r - 2; j += 3) {
        fill(g, lx + (dir >= 0 ? 1 : -r + 1), ly + j, r - 1, 1, '.');
      }
      fill(g, lx - r + 1, ly, r * 2 - 1, 1, 'd');
    });
  },

  orchid: (g, n) => {
    // Two broad leaves lying low, the way a phalaenopsis actually sits.
    blob(g, CX - 6, SOIL_Y - 3, 5, 2, 'L');
    blob(g, CX + 6, SOIL_Y - 3, 5, 2, 'L');
    dot(g, CX - 9, SOIL_Y - 4, 'l');
    dot(g, CX + 9, SOIL_Y - 4, 'l');
    if (n === 1) {
      fill(g, CX, SOIL_Y - 9, 1, 6, 'd');
      dot(g, CX, SOIL_Y - 10, 'L');
      return;
    }
    // A spike that arcs over rather than standing straight up.
    const h = n === 2 ? 11 : 16;
    for (let j = 0; j < h; j++) {
      const t = j / h;
      fill(g, CX + Math.round(t * t * 7), SOIL_Y - 4 - j, 1, 1, 'd');
    }
    const blooms = n === 2 ? 1 : 3;
    for (let i = 0; i < blooms; i++) {
      const by = SOIL_Y - 6 - i * 5 - (h - 11);
      const bx = CX + 7 - i * 2;
      blob(g, bx, by, 3, 3, 'F');
      blob(g, bx, by, 2, 1, 'f');
      dot(g, bx, by, 'X');
    }
  },

  tea: (g, n) => {
    const r = [5, 7, 9][n - 1];
    const cy = SOIL_Y - r + 1;
    fill(g, CX - 1, cy, 2, SOIL_Y - cy, 'd');
    blob(g, CX, cy, r, r - 1, 'L');
    // Broken into clumps so the mass doesn't read as one green egg.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const px = CX + Math.round(Math.cos(a) * (r - 2));
      const py = cy + Math.round(Math.sin(a) * (r - 3));
      blob(g, px, py, 2, 2, i % 3 ? 'L' : 'd');
      if (i % 2) dot(g, px, py - 1, 'l');
    }
    if (n === 3) {
      [[CX - 5, cy - 2], [CX + 4, cy + 2], [CX + 1, cy - 6], [CX - 2, cy + 4]].forEach(
        ([fx, fy]) => {
          blob(g, fx, fy, 2, 1, 'F');
          dot(g, fx, fy, 'f');
        }
      );
    }
  },

  moonflower: (g, n) => {
    const top = [18, 12, 4][n - 1];
    // A cane trellis it climbs, which is what gives it the height.
    fill(g, CX - 5, top + 2, 1, SOIL_Y - top - 2, 'd');
    fill(g, CX + 5, top + 2, 1, SOIL_Y - top - 2, 'd');
    fill(g, CX - 5, top + 2, 11, 1, 'd');

    // The vine spirals between the canes instead of running straight up.
    for (let j = SOIL_Y - 1; j > top; j--) {
      const x = CX + Math.round(Math.sin((SOIL_Y - j) / 3) * 4);
      dot(g, x, j, 'S');
      if ((SOIL_Y - j) % 4 === 0) {
        blob(g, x + (j % 2 ? 3 : -3), j, 2, 2, 'L');
        dot(g, x + (j % 2 ? 3 : -3), j - 1, 'l');
      }
    }

    if (n >= 2) {
      blob(g, CX + 4, top + 6, 4, 3, 'F');
      blob(g, CX + 4, top + 6, 2, 1, 'f');
    }
    if (n === 3) {
      // The bloom itself: five lobes around a pale throat.
      blob(g, CX, top + 3, 5, 4, 'F');
      blob(g, CX, top + 3, 3, 2, 'f');
      dot(g, CX, top + 3, 'X');
      [[CX - 7, top], [CX + 7, top + 1], [CX - 5, top + 9], [CX + 8, top + 7]].forEach(
        ([sx, sy]) => {
          dot(g, sx, sy, 'X');
          dot(g, sx, sy - 1, 'f');
          dot(g, sx - 1, sy, 'f');
        }
      );
    }
  },
};

/* -------------------------------- assembly ----------------------------- */

const STAGE_N: Record<string, number> = { sprout: 1, growing: 2, mature: 3 };

export interface PlantSprite {
  grid: Grid;
  palette: PlantPalette;
}

/**
 * Builds one plant sprite. Cheap enough to call directly, but callers on a
 * render path should go through `plantImageCache`, which rasterises the result
 * once — a 28x36 grid is a thousand cells and this runs per pot per frame
 * otherwise.
 */
export function buildPlantSprite(
  speciesId: string,
  stage: PlantStage,
  wilting = false
): PlantSprite {
  const spec = PLANT_SPECIES[speciesId];
  const g = blank();

  if (stage === 'husk') {
    drawPot(g, true);
    // A bent stalk and two curled leaves. Legible as "this was a plant" at a
    // glance, which is the point — the socket stays occupied and a bit sad.
    for (let j = 0; j < 9; j++) {
      dot(g, CX + Math.round(Math.sin(j / 3) * 3), SOIL_Y - 1 - j, 'S');
    }
    dot(g, CX + 4, SOIL_Y - 9, 's');
    blob(g, CX - 3, SOIL_Y - 6, 2, 1, 'L');
    blob(g, CX + 5, SOIL_Y - 11, 2, 1, 'd');
    dot(g, CX - 4, SOIL_Y - 5, 'l');
    return { grid: g, palette: HUSK };
  }

  drawPot(g);

  if (stage === 'seed') {
    // A nub above the soil, so a freshly planted pot still reads as planted
    // rather than as an empty socket. An unknown species draws no nub at all,
    // which is how the bare pot on the potting table is made.
    if (spec) {
      dot(g, CX, SOIL_Y - 1, 'L');
      dot(g, CX + 1, SOIL_Y - 1, 'd');
    }
  } else if (spec) {
    DRAW[speciesId]?.(g, STAGE_N[stage] ?? 1);
  }

  const base: PlantPalette = {
    ...POT,
    S: spec?.leaves.d ?? '#4E8C3C',
    s: spec?.leaves.L ?? '#7FC25F',
    ...(spec?.leaves ?? {}),
    ...(spec?.extra ?? {}),
  };

  return { grid: g, palette: wilting ? { ...base, ...WILT } : base };
}

/** Wilting droops as well as dulls — the plant sinks a row into its pot. */
export function droopGrid(grid: Grid): Grid {
  const out = blank();
  for (let y = 0; y < PLANT_H; y++) {
    for (let x = 0; x < PLANT_W; x++) {
      if (y >= SOIL_Y - 1) {
        out[y][x] = grid[y][x];
      } else if (y > 0) {
        out[y][x] = grid[y - 1][x];
      }
    }
  }
  return out;
}
