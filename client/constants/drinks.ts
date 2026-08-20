/**
 * The drink roster.
 *
 * Fourteen recipes across the same five rarities as the cats, which is what
 * lets a serve be a decision rather than a tap: they cost different amounts of
 * pearls, they pay different amounts of coins, and — through `affinity.ts` —
 * each cat wants some of them much more than others.
 *
 * Two things here are generated rather than authored, for the same reason
 * `bobaCup.ts` generates its grid: keeping fourteen near-identical
 * nine-colour palettes hand-tuned is how they drift apart.
 *
 *   - the cup palette, from the drink's hue
 *   - which cats like it, from the coat hue (see `affinity.ts`)
 *
 * Pure — no React, no state, no `Math.random()`. It is read from inside state
 * updaters, which React may invoke more than once per commit.
 */

import type { Rarity } from './catSprites';
import type { Vessel } from './vessels';

export type DrinkId =
  // common
  | 'classic' | 'house-drip' | 'jasmine' | 'honey-oolong' | 'brown-sugar' | 'cafe-au-lait'
  // rare
  | 'earl-grey' | 'matcha' | 'strawberry' | 'flat-white' | 'mango' | 'taro' | 'genmaicha'
  // epic
  | 'lavender' | 'black-sesame' | 'hojicha' | 'espresso-tonic' | 'peach-oolong' | 'sea-salt'
  // legendary
  | 'osmanthus' | 'yuzu' | 'reserve-roast' | 'ube-cloud'
  // ultra
  | 'aurora';

/** The nine palette keys `bobaCupGrid` paints with. */
export interface CupPalette {
  /** Indexed so it satisfies `PixelPalette` — the grid walk looks keys up. */
  [key: string]: string;
  /** outline */ o: string;
  /** lid cream */ c: string;
  /** highlight */ h: string;
  /** lid shade */ l: string;
  /** tea */ t: string;
  /** tea light */ u: string;
  /** tapioca */ p: string;
  /** straw */ s: string;
  /** cup shade */ d: string;
}

export interface DrinkSpec {
  id: DrinkId;
  name: string;
  rarity: Rarity;
  /** What it is served in — drives the sprite silhouette. */
  vessel: Vessel;
  /** What it costs to brew, per cat served. */
  pearls: number;
  /** Coins before affinity, café multiplier, streak and bond tip. */
  baseCoins: number;
  /**
   * Where it sits on the colour wheel, for matching against a cat's coat.
   * `null` means it has no colour worth matching — those drinks anchor on
   * luminance instead, which is how the browns, greys and creams get served.
   */
  hueAnchor: number | null;
  /** One line for the almanac. */
  note: string;
  /**
   * For tight spots — collection cards, the inspect card, the rail. A drink
   * name has to fit a 96pt cell next to a 16pt cup, and "Golden Osmanthus"
   * does not.
   */
  short: string;
  /** Drives the generated cup palette. Not the same as `hueAnchor`: Classic */
  /** has no matching hue but is still visibly a brown drink. */
  cupHue: number;
  /** Scales the generated palette's saturation. 1 is a fully coloured drink. */
  cupSat?: number;
  /** Shifts the generated palette's lightness. Negative is a darker drink. */
  cupLight?: number;
  /** Overrides generation outright. Only the ultra earns this. */
  cupPalette?: CupPalette;
}

/* ------------------------------ the roster ----------------------------- */

export const DRINKS: Record<DrinkId, DrinkSpec> = {
  /* ------------------------------- common ------------------------------ */
  classic: {
    id: 'classic', name: 'Classic Milk Tea', short: 'Milk Tea', vessel: 'boba',
    rarity: 'common', pearls: 3, baseCoins: 20, hueAnchor: null,
    cupHue: 28, cupSat: 0.82,
    note: 'The one every cat will accept and no cat asks for by name.',
  },
  'house-drip': {
    id: 'house-drip', name: 'House Drip', short: 'Drip', vessel: 'coffee',
    rarity: 'common', pearls: 3, baseCoins: 20, hueAnchor: 26,
    cupHue: 26, cupSat: 0.7, cupLight: -0.08,
    note: 'Brewed by the pot since open. Nobody has ever complained about it.',
  },
  jasmine: {
    id: 'jasmine', name: 'Jasmine Green', short: 'Jasmine', vessel: 'tea',
    rarity: 'common', pearls: 4, baseCoins: 26, hueAnchor: 100,
    cupHue: 100, cupSat: 0.7, cupLight: 0.08,
    note: 'Scented with the flower over three nights. Cheaper than it sounds.',
  },
  'honey-oolong': {
    id: 'honey-oolong', name: 'Honey Oolong', short: 'Honey', vessel: 'boba',
    rarity: 'common', pearls: 4, baseCoins: 26, hueAnchor: 40, cupHue: 40,
    note: 'Roasted leaf, a spoon of honey. Warm enough to win over a ginger.',
  },
  'brown-sugar': {
    id: 'brown-sugar', name: 'Brown Sugar', short: 'Brown Sugar', vessel: 'boba',
    rarity: 'common', pearls: 5, baseCoins: 32, hueAnchor: 30, cupHue: 30,
    note: 'Syrup striped down the inside of the glass. Sweet, and it shows.',
  },
  'cafe-au-lait': {
    id: 'cafe-au-lait', name: 'Café au Lait', short: 'Au Lait', vessel: 'coffee',
    rarity: 'common', pearls: 5, baseCoins: 32, hueAnchor: 35,
    cupHue: 35, cupSat: 0.72, cupLight: 0.1,
    note: 'Half coffee, half hot milk, poured together so neither wins.',
  },

  /* -------------------------------- rare ------------------------------- */
  'earl-grey': {
    id: 'earl-grey', name: 'Earl Grey', short: 'Earl Grey', vessel: 'tea',
    rarity: 'rare', pearls: 7, baseCoins: 48, hueAnchor: 17, cupHue: 17,
    note: 'Bergamot over black tea. Smells like someone else\u2019s good taste.',
  },
  matcha: {
    id: 'matcha', name: 'Matcha Latte', short: 'Matcha', vessel: 'boba',
    rarity: 'rare', pearls: 7, baseCoins: 48, hueAnchor: 130, cupHue: 112,
    note: 'Stone-ground, whisked to a froth. The green cats can smell it coming.',
  },
  strawberry: {
    id: 'strawberry', name: 'Strawberry Cream', short: 'Strawberry', vessel: 'boba',
    rarity: 'rare', pearls: 8, baseCoins: 54, hueAnchor: 346, cupHue: 346,
    note: 'Real fruit, crushed to a pulp, folded through cold cream.',
  },
  'flat-white': {
    id: 'flat-white', name: 'Flat White', short: 'Flat White', vessel: 'coffee',
    rarity: 'rare', pearls: 8, baseCoins: 54, hueAnchor: 22,
    cupHue: 22, cupSat: 0.55, cupLight: 0.12,
    note: 'Microfoam, poured close, no foam cap. The pour is the whole trick.',
  },
  mango: {
    id: 'mango', name: 'Mango Sago', short: 'Mango', vessel: 'boba',
    rarity: 'rare', pearls: 9, baseCoins: 62, hueAnchor: 42,
    cupHue: 42, cupSat: 1.15,
    note: 'Pulp and pearls both. Somewhere between a drink and a dessert.',
  },
  taro: {
    id: 'taro', name: 'Taro Swirl', short: 'Taro', vessel: 'boba',
    rarity: 'rare', pearls: 9, baseCoins: 62, hueAnchor: 272, cupHue: 272,
    note: 'Root, steamed and mashed. The colour is not an additive.',
  },
  genmaicha: {
    id: 'genmaicha', name: 'Genmaicha', short: 'Genmaicha', vessel: 'tea',
    rarity: 'epic', pearls: 14, baseCoins: 98, hueAnchor: 140, cupHue: 90, cupSat: 0.6,
    note: 'Green tea cut with toasted rice. Tastes like a warm kitchen.',
  },

  /* -------------------------------- epic ------------------------------- */
  lavender: {
    id: 'lavender', name: 'Lavender Haze', short: 'Lavender', vessel: 'boba',
    rarity: 'epic', pearls: 15, baseCoins: 106, hueAnchor: 262,
    cupHue: 262, cupLight: 0.05,
    note: 'Steeped with the flower still in it. Smells like a long afternoon.',
  },
  'black-sesame': {
    id: 'black-sesame', name: 'Black Sesame', short: 'Sesame', vessel: 'boba',
    rarity: 'epic', pearls: 16, baseCoins: 114, hueAnchor: null,
    cupHue: 265, cupSat: 0.28, cupLight: -0.24,
    note: 'Toasted, ground, almost savoury. The drink for cats with no colour.',
  },
  hojicha: {
    id: 'hojicha', name: 'Hojicha Latte', short: 'Hojicha', vessel: 'tea',
    rarity: 'epic', pearls: 14, baseCoins: 98, hueAnchor: 35,
    cupHue: 24, cupSat: 0.62, cupLight: -0.04,
    note: 'Green tea roasted until it stops being green. Barely any caffeine.',
  },
  'espresso-tonic': {
    id: 'espresso-tonic', name: 'Espresso Tonic', short: 'Tonic', vessel: 'coffee',
    rarity: 'epic', pearls: 15, baseCoins: 106, hueAnchor: 190,
    cupHue: 190, cupLight: 0.08,
    note: 'A shot dropped through tonic and ice. Divides the room every time.',
  },
  'peach-oolong': {
    id: 'peach-oolong', name: 'Peach Oolong', short: 'Peach', vessel: 'tea',
    rarity: 'epic', pearls: 13, baseCoins: 92, hueAnchor: 12,
    cupHue: 10, cupLight: 0.08,
    note: 'White peach over roasted oolong. Delicate, and priced accordingly.',
  },
  'sea-salt': {
    id: 'sea-salt', name: 'Sea Salt Cream', short: 'Sea Salt', vessel: 'boba',
    rarity: 'rare', pearls: 10, baseCoins: 68, hueAnchor: 205, cupHue: 205,
    note: 'A salted cap floated on cold tea. Divisive. The blue cats insist.',
  },

  /* ----------------------------- legendary ----------------------------- */
  /* The payout cliff. Everything up to epic converts pearls to coins at about
     6.5-to-1; these run past 10-to-1. A legendary is not a bigger drink, it is
     a different class of drink, and it should feel like one when it lands. */
  osmanthus: {
    id: 'osmanthus', name: 'Golden Osmanthus', short: 'Osmanthus', vessel: 'tea',
    rarity: 'legendary', pearls: 24, baseCoins: 240, hueAnchor: 45,
    cupHue: 48, cupSat: 1.2,
    note: 'Tiny gold flowers, dried and steeped. Two weeks of work in a cup.',
  },
  yuzu: {
    id: 'yuzu', name: 'Midnight Yuzu', short: 'Yuzu', vessel: 'boba',
    rarity: 'legendary', pearls: 26, baseCoins: 270, hueAnchor: null,
    cupHue: 58, cupSat: 0.5, cupLight: -0.26,
    note: 'Citrus over charcoal-filtered tea. Sharp, and very dark in the glass.',
  },
  'reserve-roast': {
    id: 'reserve-roast', name: 'Reserve Roast', short: 'Reserve', vessel: 'coffee',
    rarity: 'legendary', pearls: 22, baseCoins: 210, hueAnchor: 16,
    cupHue: 16, cupSat: 0.8, cupLight: -0.16,
    note: 'One farm, one lot, forty cups in the tin. Ground to order or not at all.',
  },
  'ube-cloud': {
    id: 'ube-cloud', name: 'Ube Cloud', short: 'Ube', vessel: 'boba',
    rarity: 'legendary', pearls: 28, baseCoins: 300, hueAnchor: 288,
    cupHue: 288, cupSat: 1.1,
    note: 'Purple yam whipped to a foam that sits above the glass, not in it.',
  },

  /* ------------------------------- ultra ------------------------------- */
  aurora: {
    id: 'aurora', name: 'Aurora Fizz', short: 'Aurora', vessel: 'boba',
    rarity: 'ultra', pearls: 35, baseCoins: 420, hueAnchor: null, cupHue: 190,
    note: 'Nobody agrees on what is in it. It changes colour while you watch.',
    cupPalette: {
      o: '#4A3A6B', c: '#FFF7EC', h: '#FFFFFF', l: '#DCF0F4',
      t: '#8FD6D0', u: '#C3E9F2', p: '#5E4A8C', s: '#F2A6D8', d: '#B6C9E0',
    },
  },
};

/** Cheapest first — the order the recipe rail renders in. */
export const DRINK_ORDER: DrinkId[] = (Object.keys(DRINKS) as DrinkId[]).sort(
  (a, b) => DRINKS[a].pearls - DRINKS[b].pearls
);

/**
 * Owned from the first launch: one boba and one coffee.
 *
 * Two rather than three, and deliberately one of each vessel — the opening
 * hand has to teach that a drink is a *choice*, and a menu of one shape
 * teaches nothing. Everything past these two comes out of the machine, which
 * is what makes the third recipe feel like something you got.
 */
export const STARTER_RECIPES: DrinkId[] = ['classic', 'house-drip'];

/**
 * Rarity frames on the recipe rail. These are the app's existing accents
 * rather than new colours: the hub already means "rare" with mission blue and
 * "legendary" with achievement gold.
 */
export const DRINK_FRAME: Record<Rarity, string> = {
  common: '#B08A63',
  rare: '#8FC2E1',
  epic: '#B8A5EF',
  legendary: '#E4C983',
  ultra: '#F2A6D8',
};

/**
 * The same five rarities at text weight, for a drink's *name*.
 *
 * `DRINK_FRAME` can't do this job: those are frames, pitched pale enough to
 * ring a card on cream, and pale is exactly wrong for 9pt type. These are the
 * same five hues taken down to something readable on the app's warm grounds —
 * so a name says its rarity without a chip, a badge or a second line, which is
 * all the room a card row has.
 */
export const DRINK_INK: Record<Rarity, string> = {
  common: '#6E5744',
  rare: '#2F6FA8',
  epic: '#6B4FC4',
  legendary: '#A8760B',
  ultra: '#C0397F',
};

/* --------------------------- palette generation ------------------------ */

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** HSL to hex. Hue in degrees, saturation and lightness 0–1. */
function hsl(hue: number, sat: number, light: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp01(sat);
  const l = clamp01(light);

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/**
 * The nine cup colours, from one hue.
 *
 * The lid cream and the highlight are constant across every flavour — they are
 * the cup, not the drink. Everything else is the drink's hue at a fixed
 * saturation/lightness profile, which is what keeps fourteen cups reading as
 * one set of cups rather than fourteen unrelated sprites.
 *
 * The straw is deliberately thrown 160 degrees off: it is the only mark on the
 * sprite that has to stay legible against the tea behind it.
 */
export function cupPalette(id: DrinkId): CupPalette {
  const spec = DRINKS[id];
  if (spec.cupPalette) return spec.cupPalette;

  const h = spec.cupHue;
  const sm = spec.cupSat ?? 1;
  const lo = spec.cupLight ?? 0;

  return {
    o: hsl(h, 0.26 * sm, 0.33 + lo * 0.5),
    c: '#FFF7EC',
    h: '#FFFFFF',
    l: hsl(h, 0.32 * sm, 0.87 + lo * 0.3),
    t: hsl(h, 0.48 * sm, 0.62 + lo),
    u: hsl(h, 0.58 * sm, 0.76 + lo * 0.7),
    p: hsl(h, 0.32 * sm, 0.24 + lo * 0.4),
    s: hsl(h + 160, 0.48 * sm, 0.72),
    d: hsl(h, 0.15 * sm, 0.72 + lo * 0.4),
  };
}

/** Every palette, built once. The rail draws all fourteen on mount. */
export const CUP_PALETTES: Record<DrinkId, CupPalette> = DRINK_ORDER.reduce(
  (acc, id) => {
    acc[id] = cupPalette(id);
    return acc;
  },
  {} as Record<DrinkId, CupPalette>
);

/* ------------------------------- helpers ------------------------------- */

export const TOTAL_DRINKS = DRINK_ORDER.length;

export function drinksByRarity(rarity: Rarity): DrinkSpec[] {
  return DRINK_ORDER.map((id) => DRINKS[id]).filter((d) => d.rarity === rarity);
}

/** Coins per pearl at neutral affinity — the ratio the roster keeps near-flat. */
export function coinsPerPearl(id: DrinkId): number {
  const spec = DRINKS[id];
  return spec.baseCoins / spec.pearls;
}
