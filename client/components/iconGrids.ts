/**
 * Pixel-art source for the currency and popularity icons.
 *
 * Data only, no rendering — Icons.tsx turns these into SVG rects. Kept apart
 * from the drawing code so the artwork can be read and edited as artwork.
 */

export type Grid = string[];
export type Palette = Record<string, string>;

export interface IconSpec {
  grid: Grid;
  palette: Palette;
  label: string;
}

/** Width in cells — grids are ragged, so callers must not assume row length. */
export function gridCols(grid: Grid): number {
  return Math.max(...grid.map((row) => row.length));
}

// ── Coin ──────────────────────────────────────────────────────────────
// A round gold coin with a top-left highlight and bottom-right shadow.

const COIN_GRID: Grid = [
  '...OOOO...',
  '..OggggO..',
  '.OgHHgggO.',
  'OgHHgggggO',
  'OgHggggggO',
  'OgggggggSO',
  'OggggggSSO',
  '.OggggSSO.',
  '..OggggO..',
  '...OOOO...',
];

const COIN_PALETTE: Palette = {
  O: '#B8882D',   // dark gold outline
  g: '#F5D273',   // gold fill
  H: '#FFF5D6',   // highlight
  S: '#C49A3A',   // shadow
};

// ── Pearl ─────────────────────────────────────────────────────────────
// A lustrous purple pearl with a white sparkle.

const PEARL_GRID: Grid = [
  '...OOOO...',
  '..OppppO..',
  '.OpHHpppO.',
  'OpHWHppppO',
  'OpHHpppppO',
  'OpppppppsO',
  'OppppppssO',
  '.OppppssO.',
  '..OppppO..',
  '...OOOO...',
];

const PEARL_PALETTE: Palette = {
  O: '#9B6BAD',   // dark purple outline
  p: '#E0B8E8',   // lavender fill
  H: '#F0E0F6',   // light highlight
  W: '#FFFFFF',   // sparkle
  s: '#C89DD0',   // shadow
};

// ── Popularity star ───────────────────────────────────────────────────
// A five-pointed star in warm coral. Highlight at the tip for shine.

const STAR_GRID: Grid = [
  '....O....',
  '...OHO...',
  '..OOHOO..',
  'OFFFFFFFO',
  '.OFFFFFO.',
  '..OFFFO..',
  '..OF.FO..',
  '.OF...FO.',
  'OO.....OO',
];

const STAR_PALETTE: Palette = {
  O: '#C45E5E',   // dark coral outline
  F: '#E88973',   // coral fill
  H: '#FFB5A0',   // highlight
};

export const COIN: IconSpec = {
  grid: COIN_GRID,
  palette: COIN_PALETTE,
  label: 'coin',
};
export const PEARL: IconSpec = {
  grid: PEARL_GRID,
  palette: PEARL_PALETTE,
  label: 'pearl',
};
export const STAR: IconSpec = {
  grid: STAR_GRID,
  palette: STAR_PALETTE,
  label: 'popularity',
};
