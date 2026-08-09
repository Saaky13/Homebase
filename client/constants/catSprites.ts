/**
 * Procedural cat sprites.
 *
 * Every cat in the game is one 28-wide pixel grid built from shared parts:
 * a head, a body, a tail, a pair of eyes, and a coat pattern. Swapping the
 * palette and the pattern is what produces the whole roster, which is why
 * adding a cat costs one entry in CAT_ROSTER rather than a new art asset.
 *
 * This module is deliberately render-agnostic: it produces a grid of colour
 * keys and nothing else. Web draws it to a canvas; a build script can turn
 * the same grid into a PNG for native. Nothing here may import react-native
 * or touch the DOM.
 */

export const SPRITE_WIDTH = 28;
/** Head and body are authored 24 wide and padded out to SPRITE_WIDTH. */
export const ART_WIDTH = 24;

/**
 * Single-character colour keys used inside the grids.
 *   B body   S shade   C second coat   W chest/white   O outline
 *   E eye    H highlight   P nose pink   K sparkle/metal accent
 *   '.' is transparent.
 */
export type ColorKey = 'B' | 'S' | 'C' | 'W' | 'O' | 'E' | 'H' | 'P' | 'K';

export type Palette = Record<ColorKey, string>;

export type PatternName =
  | 'solid'
  | 'tabby'
  | 'point'
  | 'spots'
  | 'socks'
  | 'patch'
  | 'patchBR'
  | 'patch2'
  | 'bicolor';

export type EyeName = 'big' | 'tall' | 'sparkle' | 'bigspark' | 'happy';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'ultra';

export interface CatSpec {
  id: string;
  name: string;
  rarity: Rarity;
  palette: PaletteName;
  pattern: PatternName;
  eye: EyeName;
  /** Tail curls up beside the body instead of sweeping down. */
  tailUp?: boolean;
  /** Use white as the second coat colour instead of the palette's C. */
  whiteSecond?: boolean;
  /** Ultra only. */
  crown?: boolean;
  /** Sparkle particles around the sprite: 0 none, 5 legendary, 9 ultra. */
  sparkles?: 0 | 5 | 9;
}

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

function pal(B: string, S: string, C: string, W: string, O: string, K?: string): Palette {
  return { B, S, C, W, O, E: O, P: '#E8798F', H: '#FFFFFF', K: K ?? S };
}

/**
 * Body colour is deliberately kept a good deal darker than the chest white.
 * When those two sit close together the belly, shading and socks all vanish
 * into one flat wash — see PALETTE_MIN_CONTRAST below.
 */
export const PALETTES = {
  ginger: pal('#EE9C56', '#C4742E', '#F7E6CE', '#FFF6EA', '#4E3226'),
  gray: pal('#A6B4BE', '#7B8B99', '#5D6E7C', '#FBFDFE', '#3A4650'),
  cream: pal('#EBCF9E', '#C2A06A', '#B07A4C', '#FFFBF2', '#6B5340'),
  brown: pal('#A87551', '#82573A', '#EADCC8', '#FBF5ED', '#3E2A1C'),
  charcoal: pal('#6B6B73', '#4E4E56', '#E4E4EA', '#FAFAFC', '#2A2A30'),
  snow: pal('#E4DCD1', '#C3B8A9', '#C08A5E', '#FFFFFF', '#5A5048'),
  sand: pal('#DCC49A', '#B79E74', '#96754C', '#FFFAF0', '#6B5A40'),
  smoke: pal('#9AA3A8', '#737C82', '#5A666C', '#FAFCFD', '#333A3E'),
  tabbyb: pal('#B98A5E', '#8F6641', '#F0DCC4', '#FDF6EC', '#40291A'),
  calico: pal('#F0C88E', '#C9925A', '#7A4A32', '#FFFBF2', '#4E3226'),
  soot: pal('#7A7280', '#5A5361', '#D8CFE0', '#F7F4FA', '#2E2833'),
  taupe: pal('#B9A793', '#957F68', '#6E5B49', '#FAF6F0', '#463A2E'),

  mint: pal('#96D3AE', '#5FA97F', '#3E7D5E', '#F8FEFA', '#33564A'),
  sky: pal('#84C4EC', '#4E9AC9', '#2F6E96', '#F8FCFF', '#2F4E63'),
  rose: pal('#E28B9F', '#BE6379', '#FBE0E7', '#FFF7F9', '#5E2E3A'),
  lilac: pal('#C3AEE0', '#9B84C0', '#EFE7F9', '#FCFAFF', '#4B3A63'),
  slate: pal('#7E93A8', '#5C7086', '#DFE9F1', '#F8FBFD', '#2C3A47'),
  peach: pal('#F2B08A', '#CB855F', '#FCE4D2', '#FFF9F4', '#5C3524'),
  sage: pal('#A9C49A', '#7F9C70', '#E6F0E0', '#FAFDF8', '#3C4E33'),
  clay: pal('#C98A72', '#A3654F', '#F2DACE', '#FEF7F3', '#4A2B1F'),
  honey: pal('#E5B96A', '#BC9040', '#FAE7C0', '#FFFAEE', '#57401A'),
  pearl: pal('#DCD3E0', '#B9AEC0', '#8E7FA0', '#FEFDFF', '#4E4356'),

  lavender: pal('#B49FEB', '#8A6ED6', '#EBE3FC', '#FCFAFF', '#453268'),
  plum: pal('#9A6E9E', '#734D7A', '#E8CFE4', '#FCF6FB', '#3B2440'),
  teal: pal('#5FBFB4', '#3B968C', '#D8F1ED', '#F5FCFB', '#1F4A46'),
  coral: pal('#F09277', '#C96A50', '#FBDDD1', '#FFF7F3', '#5A2A1C'),
  emerald: pal('#5FB57E', '#3A8A57', '#D6EFDE', '#F4FCF6', '#1E4A2E'),
  indigo: pal('#7C86D6', '#5A63B0', '#DDE2FA', '#F7F8FE', '#2E3466'),
  magenta: pal('#D97BB8', '#B15490', '#F7DCEE', '#FEF7FB', '#5A2247'),
  amber: pal('#E8A23F', '#B87A18', '#FBE3BC', '#FFF9EC', '#523208'),

  gold: pal('#F0C24E', '#C4922A', '#FFF0C4', '#FFFCF0', '#5A4318', '#FFE9A8'),
  silver: pal('#D2D8DE', '#A6AEB6', '#7E8891', '#FDFEFF', '#454E56', '#FFFFFF'),
  rosegold: pal('#EFA98F', '#C87F65', '#FBDECF', '#FFF8F4', '#5C3225', '#FFD9C6'),
  obsidian: pal('#4A4458', '#332E40', '#8E82C0', '#EDEAF4', '#191521', '#9B8FD0'),
  celest: pal('#6F8FD8', '#4A66AE', '#C3D5F5', '#F4F8FF', '#232F5E', '#BFD4FF'),

  prism: pal('#F2A7C4', '#C97BA0', '#8FB8E8', '#FFFFFF', '#3A2A52', '#F0C24E'),
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

/** Minimum brightness gap between body (B) and chest (W). See assertPalettes. */
export const PALETTE_MIN_CONTRAST = 0.18;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Guards the mistake that flattened the first pale cats: a body colour too
 * close in brightness to the chest leaves the shading with nothing to push
 * against. Call from a test rather than at import time.
 */
export function findLowContrastPalettes(): string[] {
  return (Object.keys(PALETTES) as PaletteName[]).filter(
    (name) =>
      Math.abs(luminance(PALETTES[name].W) - luminance(PALETTES[name].B)) <
      PALETTE_MIN_CONTRAST
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

/** Big ears, chubby cheeks, no neck. Face is blank; features stamp on top. */
const HEAD: string[] = [
  '....OO............OO....',
  '...OBBO..........OBBO...',
  '...OBBO..........OBBO...',
  '..OBBPBO........OBPBBO..',
  '..OBBPBO........OBPBBO..',
  '..OBBPBBO......OBBPBBO..',
  '.OBBBPBBOOOOOOOOBBPBBBO.',
  '.OBBBBBBBBBBBBBBBBBBBBO.',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  'OBBBBBBBBBBBBBBBBBBBBBBO',
  '.OBBBBBBBBBBBBBBBBBBBBO.',
  '..OBBBBBBBBBBBBBBBBBBO..',
  '...OBBBBBBBBBBBBBBBBO...',
  '....OOOOOOOOOOOOOOOO....',
];

/**
 * Floats free of the head with a one-row gap, as do the paws and feet. The
 * torso is plain body colour on purpose — the chest marking belongs to the
 * pattern, so striped cats aren't forced around a white oval.
 */
const BODY: string[] = [
  '.......OOOOOOOOOO.......',
  '.......OBBBBBBBBO.......',
  '..OOOO.OBBBBBBBBO.OOOO..',
  '..OBBO.OBBBBBBBBO.OBBO..',
  '..OBBO.OBBBBBBBBO.OBBO..',
  '..OOOO.OBBBBBBBBO.OOOO..',
  '.......OBBBBBBBBO.......',
  '.......OBBBBBBBBO.......',
  '.......OBBBBBBBBO.......',
  '.......OBBBBBBBBO.......',
  '.......OOOOOOOOOO.......',
  '........................',
  '........OOOO.OOOO.......',
  '........OBBO.OBBO.......',
  '........OOOO.OOOO.......',
];

const HEAD_ROWS = HEAD.length;
/** Grid row where the body block starts (head + one floating gap row). */
const BODY_START = HEAD_ROWS + 1;

type Cell = [number, number, ColorKey];

interface TailShape {
  rows: string[];
  tx: number;
  dy: number;
}

const TAIL_DOWN: TailShape = {
  rows: ['OOO...', 'OBBO..', 'OBBO..', '.OBBO.', '.OBBO.', '.OBBO.', '..OBBO', '..OBBO', '...OOO'],
  tx: 17,
  dy: 6,
};

const TAIL_UP: TailShape = {
  rows: [
    '......OOO',
    '.....OBBO',
    '.....OBBO',
    '.....OBBO',
    '....OBBO.',
    '..OBBO...',
    '.OBBO....',
    'OBBBO....',
    'OOOO.....',
  ],
  tx: 17,
  dy: 2,
};

/** Mirrors left-side cells across the face so features stay symmetric. */
function mirrorCells(cells: Cell[]): Cell[] {
  return cells.concat(cells.map(([y, x, c]) => [y, ART_WIDTH - 1 - x, c] as Cell));
}

function rect(r0: number, r1: number, c0: number, c1: number, ch: ColorKey): Cell[] {
  const out: Cell[] = [];
  for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) out.push([y, x, ch]);
  return out;
}

export const EYES: Record<EyeName, Cell[]> = {
  big: mirrorCells(
    rect(9, 12, 4, 7, 'E').concat([
      [9, 4, 'H'],
      [9, 5, 'H'],
      [10, 4, 'H'],
    ])
  ),
  tall: mirrorCells(
    rect(9, 13, 5, 7, 'E').concat([
      [9, 5, 'H'],
      [10, 5, 'H'],
    ])
  ),
  sparkle: mirrorCells(
    rect(9, 12, 4, 7, 'E').concat([
      [9, 4, 'H'],
      [9, 5, 'H'],
      [10, 4, 'H'],
      [12, 7, 'H'],
    ])
  ),
  bigspark: mirrorCells(
    rect(9, 13, 3, 7, 'E').concat([
      [9, 3, 'H'],
      [9, 4, 'H'],
      [10, 3, 'H'],
      [10, 4, 'H'],
      [12, 6, 'H'],
      [12, 7, 'H'],
      [11, 7, 'H'],
      [13, 4, 'H'],
    ])
  ),
  happy: mirrorCells([
    [11, 4, 'O'],
    [10, 5, 'O'],
    [10, 6, 'O'],
    [11, 7, 'O'],
  ]),
};

/** Small downward triangle. No mouth — the eyes carry the face. */
const NOSE: Cell[] = [
  [14, 10, 'P'],
  [14, 11, 'P'],
  [14, 12, 'P'],
  [14, 13, 'P'],
  [15, 11, 'P'],
  [15, 12, 'P'],
];

/** Forehead dashes and cheek stripes. Patch coats only. */
const FOREHEAD: Array<[number, number]> = [
  [7, 9],
  [7, 11],
  [7, 13],
  [8, 9],
  [8, 11],
  [8, 13],
];

const CHEEK: Cell[] = mirrorCells([
  [14, 2, 'S'],
  [14, 3, 'S'],
  [14, 4, 'S'],
  [16, 2, 'S'],
  [16, 3, 'S'],
  [16, 4, 'S'],
]);

const CROWN: Cell[] = [
  [3, 9, 'K'],
  [3, 11, 'K'],
  [3, 13, 'K'],
  [4, 9, 'K'],
  [4, 10, 'K'],
  [4, 11, 'K'],
  [4, 12, 'K'],
  [4, 13, 'K'],
  [5, 9, 'K'],
  [5, 10, 'K'],
  [5, 11, 'K'],
  [5, 12, 'K'],
  [5, 13, 'K'],
];

const SPARKLE_5: Array<[number, number]> = [
  [2, 2],
  [6, 24],
  [20, 1],
  [27, 25],
  [33, 3],
];

const SPARKLE_9: Array<[number, number]> = [
  [1, 3],
  [4, 24],
  [9, 1],
  [14, 26],
  [19, 2],
  [24, 25],
  [29, 1],
  [34, 24],
  [36, 12],
];

/* ------------------------------------------------------------------ */
/* Grid assembly                                                       */
/* ------------------------------------------------------------------ */

export type Grid = string[][];

function blankGrid(): Grid {
  return HEAD.concat([''])
    .concat(BODY)
    .map((row) => {
      const cells = row.split('');
      while (cells.length < SPRITE_WIDTH) cells.push('.');
      return cells;
    });
}

/** Writes only over existing pixels, so features never spill off the body. */
function stamp(g: Grid, cells: Cell[]): void {
  for (const [y, x, ch] of cells) {
    if (g[y]?.[x] !== undefined && g[y][x] !== '.') g[y][x] = ch;
  }
}

/** Writes anywhere, including empty space. Used for the crown. */
function stampFree(g: Grid, cells: Cell[]): void {
  for (const [y, x, ch] of cells) {
    if (g[y]?.[x] !== undefined) g[y][x] = ch;
  }
}

/**
 * Every soft edge in the design comes from here. Rectangular cuts read as
 * masks; ellipses read as markings.
 */
function ellipse(
  g: Grid,
  cy: number,
  cx: number,
  ry: number,
  rx: number,
  from: string,
  to: ColorKey
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    if (!g[y]) continue;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || x >= g[y].length) continue;
      const dy = (y - cy) / ry;
      const dx = (x - cx) / rx;
      if (dy * dy + dx * dx <= 1 && g[y][x] === from) g[y][x] = to;
    }
  }
}

/** Paws, feet and anything else outside the torso columns. */
function limbs(g: Grid, to: ColorKey): void {
  for (let y = BODY_START; y < g.length; y++) {
    for (let x = 0; x < g[y].length; x++) {
      if (g[y][x] === 'B' && (x < 7 || x > 16)) g[y][x] = to;
    }
  }
}

function faceMarks(g: Grid): void {
  for (const [y, x] of FOREHEAD) if (g[y][x] === 'B') g[y][x] = 'S';
  stamp(g, CHEEK);
}

function applyPattern(g: Grid, kind: PatternName, secondL: ColorKey, secondR: ColorKey): void {
  const bs = BODY_START;

  switch (kind) {
    case 'solid':
      ellipse(g, bs + 3.5, 11.5, 3.6, 3.6, 'B', 'W');
      break;

    case 'spots':
      ellipse(g, bs + 3.5, 11.5, 3.6, 3.6, 'B', 'W');
      // Sparse enough to read as freckling rather than a rash.
      for (let y = 0; y < g.length; y++)
        for (let x = 0; x < g[y].length; x++)
          if (g[y][x] === 'B' && (x * 11 + y * 7) % 29 < 1) g[y][x] = 'S';
      break;

    case 'tabby':
      // No chest patch: the bands run clean across the whole torso.
      for (let y = bs + 2; y <= bs + 9; y += 2)
        for (let x = 8; x <= 15; x++) if (g[y]?.[x] === 'B') g[y][x] = 'S';
      break;

    case 'patch':
      ellipse(g, 8, 3, 9.5, 6.5, 'B', secondL);
      ellipse(g, bs + 4, 8, 5.5, 6.5, 'B', secondL);
      faceMarks(g);
      break;

    case 'patchBR':
      ellipse(g, 17, 19, 6.5, 5.5, 'B', secondL);
      ellipse(g, bs + 7, 15, 5.5, 6.5, 'B', secondL);
      faceMarks(g);
      break;

    case 'patch2':
      ellipse(g, 8, 2, 8.5, 5.5, 'B', secondL);
      ellipse(g, 8, 21, 8.5, 5.5, 'B', secondR);
      ellipse(g, bs + 4, 6, 5, 5.5, 'B', secondL);
      ellipse(g, bs + 4, 17, 5, 5.5, 'B', secondR);
      faceMarks(g);
      break;

    case 'bicolor':
      // Narrow on the face, and a vertical front down the torso. A wide
      // horizontal band across the chest reads as underwear, not a coat.
      ellipse(g, 18, 11.5, 6.5, 6, 'B', secondL);
      ellipse(g, bs + 5, 11.5, 6.5, 2.9, 'B', secondL);
      limbs(g, secondL);
      break;

    case 'point':
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < g[y].length; x++) if (g[y][x] === 'B') g[y][x] = 'S';
      limbs(g, 'S');
      ellipse(g, bs + 3.5, 11.5, 3.2, 3.2, 'B', 'W');
      break;

    case 'socks':
      limbs(g, 'W');
      ellipse(g, bs + 3.5, 11.5, 3.6, 3.6, 'B', 'W');
      break;
  }
}

function stampTail(g: Grid, tail: TailShape, kind: PatternName, secondL: ColorKey): void {
  const ty = BODY_START + tail.dy;
  for (let y = 0; y < tail.rows.length; y++) {
    for (let x = 0; x < tail.rows[y].length; x++) {
      let ch = tail.rows[y][x];
      if (ch === '.') continue;
      const gy = ty + y;
      const gx = tail.tx + x;
      if (!g[gy] || gx >= g[gy].length || g[gy][gx] !== '.') continue;
      if (ch === 'B') {
        if (kind === 'point') ch = 'S';
        else if (kind === 'tabby' && y % 2 === 1) ch = 'S';
        else if (kind === 'patchBR' || kind === 'patch2') ch = secondL;
      }
      g[gy][gx] = ch as ColorKey;
    }
  }
}

function addSparkles(g: Grid, points: Array<[number, number]>): void {
  for (const [y, x] of points) {
    for (const [dy, dx] of [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const gy = y + dy;
      const gx = x + dx;
      if (g[gy]?.[gx] === '.') g[gy][gx] = 'K';
    }
  }
}

/**
 * Builds the full pixel grid for one cat. Returns colour keys, not colours —
 * callers pair it with PALETTES[spec.palette] to resolve actual hex values.
 */
export function buildCatGrid(spec: CatSpec): Grid {
  const g = blankGrid();
  const secondL: ColorKey = spec.whiteSecond ? 'W' : 'C';
  const secondR: ColorKey = 'W';

  applyPattern(g, spec.pattern, secondL, secondR);
  stampTail(g, spec.tailUp ? TAIL_UP : TAIL_DOWN, spec.pattern, secondL);
  stamp(g, EYES[spec.eye]);
  stamp(g, NOSE);
  if (spec.crown) stampFree(g, CROWN);
  if (spec.sparkles === 5) addSparkles(g, SPARKLE_5);
  if (spec.sparkles === 9) addSparkles(g, SPARKLE_9);

  return g;
}

/** Resolves a grid to hex colours, with null for transparent pixels. */
export function resolveGrid(g: Grid, palette: Palette): Array<Array<string | null>> {
  return g.map((row) =>
    row.map((ch) => (ch === '.' || !ch ? null : palette[ch as ColorKey] ?? palette.B))
  );
}

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'ultra'];

export const RARITY_STYLE: Record<Rarity, { label: string; ring: string; tint: string }> = {
  common: { label: 'Common', ring: '#B4B2A9', tint: '#F1EFE8' },
  rare: { label: 'Rare', ring: '#378ADD', tint: '#E6F1FB' },
  epic: { label: 'Epic', ring: '#7F77DD', tint: '#EEEDFE' },
  legendary: { label: 'Legendary', ring: '#EF9F27', tint: '#FAEEDA' },
  ultra: { label: 'Ultra Legendary', ring: '#D4537E', tint: '#FBEAF0' },
};

export const CAT_ROSTER: CatSpec[] = [
  // Common — muted natural coats, plain eyes, no particles.
  { id: 'mochi', name: 'Mochi', rarity: 'common', palette: 'ginger', pattern: 'tabby', eye: 'big' },
  { id: 'nutmeg', name: 'Nutmeg', rarity: 'common', palette: 'brown', pattern: 'tabby', eye: 'big' },
  { id: 'dusty', name: 'Dusty', rarity: 'common', palette: 'smoke', pattern: 'tabby', eye: 'big' },
  { id: 'butter', name: 'Butter', rarity: 'common', palette: 'sand', pattern: 'solid', eye: 'happy' },
  { id: 'marshmallow', name: 'Marshmallow', rarity: 'common', palette: 'snow', pattern: 'solid', eye: 'happy' },
  { id: 'pepper', name: 'Pepper', rarity: 'common', palette: 'charcoal', pattern: 'point', eye: 'big' },
  { id: 'smoke', name: 'Smoke', rarity: 'common', palette: 'gray', pattern: 'point', eye: 'big' },
  { id: 'biscuit', name: 'Biscuit', rarity: 'common', palette: 'cream', pattern: 'spots', eye: 'big' },
  { id: 'toast', name: 'Toast', rarity: 'common', palette: 'tabbyb', pattern: 'socks', eye: 'big' },
  { id: 'pebble', name: 'Pebble', rarity: 'common', palette: 'taupe', pattern: 'patch', eye: 'big', whiteSecond: true },
  { id: 'clover', name: 'Clover', rarity: 'common', palette: 'calico', pattern: 'patch2', eye: 'big' },
  { id: 'cinder', name: 'Cinder', rarity: 'common', palette: 'soot', pattern: 'bicolor', eye: 'big', whiteSecond: true },

  // Rare — saturated pastels, taller eyes.
  { id: 'peony', name: 'Peony', rarity: 'rare', palette: 'rose', pattern: 'tabby', eye: 'tall' },
  { id: 'slate', name: 'Slate', rarity: 'rare', palette: 'slate', pattern: 'tabby', eye: 'tall', tailUp: true },
  { id: 'terra', name: 'Terra', rarity: 'rare', palette: 'clay', pattern: 'tabby', eye: 'big' },
  { id: 'sage', name: 'Sage', rarity: 'rare', palette: 'sage', pattern: 'solid', eye: 'tall' },
  { id: 'apricot', name: 'Apricot', rarity: 'rare', palette: 'peach', pattern: 'point', eye: 'big' },
  { id: 'pistachio', name: 'Pistachio', rarity: 'rare', palette: 'mint', pattern: 'point', eye: 'tall' },
  { id: 'honey', name: 'Honey', rarity: 'rare', palette: 'honey', pattern: 'spots', eye: 'tall', tailUp: true },
  { id: 'koi', name: 'Koi', rarity: 'rare', palette: 'sky', pattern: 'bicolor', eye: 'big', tailUp: true },
  { id: 'wisteria', name: 'Wisteria', rarity: 'rare', palette: 'lilac', pattern: 'patchBR', eye: 'big', whiteSecond: true },
  { id: 'pearl', name: 'Pearl', rarity: 'rare', palette: 'pearl', pattern: 'patch2', eye: 'happy', whiteSecond: true },

  // Epic — vivid coats, sparkle eyes.
  { id: 'lagoon', name: 'Lagoon', rarity: 'epic', palette: 'teal', pattern: 'tabby', eye: 'sparkle' },
  { id: 'amber', name: 'Amber', rarity: 'epic', palette: 'amber', pattern: 'tabby', eye: 'sparkle' },
  { id: 'jade', name: 'Jade', rarity: 'epic', palette: 'emerald', pattern: 'point', eye: 'tall' },
  { id: 'ember', name: 'Ember', rarity: 'epic', palette: 'coral', pattern: 'solid', eye: 'sparkle', tailUp: true },
  { id: 'fig', name: 'Fig', rarity: 'epic', palette: 'plum', pattern: 'spots', eye: 'tall', tailUp: true },
  { id: 'indigo', name: 'Indigo', rarity: 'epic', palette: 'indigo', pattern: 'patch', eye: 'sparkle' },
  { id: 'iris', name: 'Iris', rarity: 'epic', palette: 'lavender', pattern: 'bicolor', eye: 'sparkle', whiteSecond: true },
  { id: 'orchid', name: 'Orchid', rarity: 'epic', palette: 'magenta', pattern: 'patchBR', eye: 'sparkle', tailUp: true },

  // Legendary — metallic coats, big sparkly eyes, particles.
  { id: 'sunbeam', name: 'Sunbeam', rarity: 'legendary', palette: 'gold', pattern: 'tabby', eye: 'bigspark', sparkles: 5 },
  { id: 'sterling', name: 'Sterling', rarity: 'legendary', palette: 'silver', pattern: 'point', eye: 'bigspark', sparkles: 5, tailUp: true },
  { id: 'aurora', name: 'Aurora', rarity: 'legendary', palette: 'rosegold', pattern: 'solid', eye: 'bigspark', sparkles: 5 },
  { id: 'obsidian', name: 'Obsidian', rarity: 'legendary', palette: 'obsidian', pattern: 'patch', eye: 'bigspark', sparkles: 5, tailUp: true, whiteSecond: true },
  { id: 'nebula', name: 'Nebula', rarity: 'legendary', palette: 'celest', pattern: 'bicolor', eye: 'bigspark', sparkles: 5, whiteSecond: true },

  // Ultra Legendary — exactly one, and the only cat with a crown.
  { id: 'prism', name: 'Prism', rarity: 'ultra', palette: 'prism', pattern: 'patch2', eye: 'bigspark', sparkles: 9, crown: true, tailUp: true },
];

export function catsByRarity(rarity: Rarity): CatSpec[] {
  return CAT_ROSTER.filter((cat) => cat.rarity === rarity);
}

export function getCat(id: string): CatSpec | undefined {
  return CAT_ROSTER.find((cat) => cat.id === id);
}
