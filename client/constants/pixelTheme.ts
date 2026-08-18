/**
 * The Growth Hub's pixel UI theme.
 *
 * The hub used to be soft pastel cards with 24px radii and a white gloss bar —
 * a visual language the café and town don't speak. This is the replacement:
 * one material, hard bevels, and section identity carried by a small accent
 * rather than by tinting the whole surface eight different colours.
 *
 * Scope is deliberately the hub only. The shop, shelter and habit form still
 * run the old soft-card styles; converting them is a later pass, and having
 * both languages in the tree at once is expected in the meantime.
 */

import { isNightAt } from '../town/palette';

/**
 * Art-pixel size, matching `cafePixel.PX`. Bevels and gaps are multiples of
 * this so the kit lands on the same grid as the rooms it sits beside.
 */
export const PX = 2;

/** Bevel thickness. 3 art pixels reads as chunky without eating the face. */
export const BEVEL = 3;
/** Chips and other small parts take a thinner bevel or they look swollen. */
export const BEVEL_THIN = 2;

export interface PixelMaterial {
  /** Screen behind everything. */
  bg: string;
  /** Panel face. */
  face: string;
  /** Top and left bevel — the lit edges. */
  faceLt: string;
  /** Bottom and right bevel — the shadowed edges. */
  faceDk: string;
  /** A face one step down, for wells and inset rows. */
  sunk: string;
  ink: string;
  inkDim: string;
  /** Progress track and its edge. */
  track: string;
  trackEdge: string;
}

/**
 * Rosy paper. The hub is the self-improvement side of the app and gets its own
 * material rather than borrowing the café's wood — the same reasoning that
 * gives the greenhouse magenta grow-lamps, so no two rooms read alike.
 *
 * Unlike the old palette, this one spans a real value range: the bevels are far
 * enough from the face to model light, which is what the flat pastels lacked.
 */
export const DAY_MATERIAL: PixelMaterial = {
  bg: '#FBEFF4',
  face: '#F7DCE7',
  faceLt: '#FFF1F7',
  faceDk: '#D9A8C0',
  sunk: '#EDCCDC',
  ink: '#61324A',
  inkDim: '#9A6C82',
  track: '#E6C2D4',
  trackEdge: '#C89AB0',
};

/**
 * Dusk, not dark mode.
 *
 * `CLAUDE.md` convention 8 rules out dark mode, and this doesn't break it: it's
 * the same time-of-day treatment the town and café already run on the shared
 * `isNightAt()` clock, not a user-facing theme switch. The hub is an interior,
 * so it follows the café's logic rather than the town's — it deepens toward
 * lamplit plum instead of dropping to navy, and the ink stays dark-on-light so
 * every screen in here is as readable at 11pm as at noon.
 */
export const NIGHT_MATERIAL: PixelMaterial = {
  bg: '#E4D2E0',
  face: '#E7C9DA',
  faceLt: '#F6E2EE',
  faceDk: '#B98FAB',
  sunk: '#D9B8CD',
  ink: '#4A2540',
  inkDim: '#825E75',
  track: '#D2AEC4',
  trackEdge: '#AD86A0',
};

export const materialAt = (date: Date = new Date()): PixelMaterial =>
  isNightAt(date) ? NIGHT_MATERIAL : DAY_MATERIAL;

/**
 * Section accents.
 *
 * These are the *border* colours from the old tile palette, not the fills —
 * they were already the saturated end of each hue, so they carry identity at
 * stripe width where the pale fills would vanish. Keeping the hues means the
 * hub still colour-codes the way `habitTiers` and `achievements` do.
 */
export const ACCENTS = {
  habits: '#E7A9C8',
  mission: '#8FC2E1',
  reflection: '#E4C983',
  calendar: '#B8A5EF',
  todo: '#E8B38E',
  focus: '#9FD5BF',
  achievements: '#E3C26B',
  resources: '#9FDCCB',
} as const;

export type AccentKey = keyof typeof ACCENTS;

/** Darkest tone — icon outlines and structure. */
export const ACCENT_INKS: Record<AccentKey, string> = {
  habits: '#8A4A67',
  mission: '#38617D',
  reflection: '#7A6230',
  calendar: '#4C3A7A',
  todo: '#8A5A33',
  focus: '#2F6B54',
  achievements: '#7A6230',
  resources: '#2F6B54',
};

/**
 * Mid tones for icon fills.
 *
 * The accents themselves sit about one step from the rose face, so filling an
 * icon with its own accent made the fill vanish and left only the outline —
 * the sprout's leaves disappeared entirely. These are each accent pushed a
 * third of the way toward its ink, which is enough separation to read at 12x12
 * without going as dark as the outline.
 */
export const ACCENT_FILLS: Record<AccentKey, string> = {
  habits: '#D98CB2',
  mission: '#6FA8CC',
  reflection: '#D0AF63',
  calendar: '#9C86DE',
  todo: '#D9976C',
  focus: '#7CBFA4',
  achievements: '#CFA94E',
  resources: '#7CC6B1',
};

/**
 * Type scale.
 *
 * Pixel faces blur at sizes that aren't whole multiples of their design grid,
 * so sizes are chosen rather than freely picked. Handjet is drawn on an 8-unit
 * grid; these are the steps that stay crisp. Reach for a named step instead of
 * typing a number, or the hub drifts back to the 11/12/13/15/17 soup it had.
 */
export const TYPE = {
  micro: 8,
  small: 12,
  body: 16,
  label: 16,
  title: 20,
  hero: 32,
} as const;

/**
 * Family name as registered with `useFonts`. Wiring lives in the root layout,
 * which the greenhouse work currently owns — until that lands, `PixelText`
 * falls back to the system font and the hub simply looks unstyled rather than
 * throwing.
 */
export const PIXEL_FONT = 'HandjetBubble';

/**
 * Baked from the Handjet variable font at ELGR 1 / ELSH 16 / wght 800 — round
 * elements at full weight. Instancing it to a static file rather than shipping
 * the variable font and setting axes at runtime keeps it working on native,
 * where `fontVariationSettings` is not reliable.
 */
export const PIXEL_FONT_FILE = require('../assets/fonts/HandjetBubble.ttf');
