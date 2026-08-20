/**
 * Everything the almanac knows about a cat, derived rather than authored.
 *
 * A roster cat carries nine fields and no prose (`CatSpec` in catSprites.ts).
 * Writing 36 biographies by hand would mean 36 things to keep in sync with art
 * that is itself generated, so every fact here is a function of the sprite
 * data, the roster as a whole, and the player's own history with that cat.
 *
 * Pure by contract — no React, no state, no `Math.random()`, no clock. That is
 * the rule `gacha.ts` and `plants.ts` already follow, and it means the whole
 * feature can be reviewed by reading one file, and the output for all 36 cats
 * diffed by a script without mounting anything.
 */

import {
  CAT_ROSTER,
  PALETTES,
  luminance,
  type CatSpec,
  type EyeName,
  type PaletteName,
  type PatternName,
  type Rarity,
} from './catSprites';
import { RARITY_WEIGHTS } from './gacha';
import { favoriteDrink } from './affinity';
import { DRINKS } from './drinks';
import { toHsl } from '../utils/color';

/* ----------------------------- colour maths ---------------------------- */

export { hueGap, toHsl, type Hsl } from '../utils/color';

/* -------------------------------- odds --------------------------------- */

const TOTAL_WEIGHT = Object.values(RARITY_WEIGHTS).reduce((sum, w) => sum + w, 0);

function countIn(rarity: Rarity): number {
  return CAT_ROSTER.filter((cat) => cat.rarity === rarity).length;
}

/**
 * The chance of drawing this specific cat from a full roster.
 *
 * `pickCat` rolls a rarity by weight and then picks uniformly inside it, so a
 * cat's share is its rarity's weight divided by how many cats share the bucket.
 */
export function baselineOdds(rarity: Rarity): number {
  return RARITY_WEIGHTS[rarity] / TOTAL_WEIGHT / countIn(rarity);
}

/**
 * The chance on your *next* pull, given what you already own.
 *
 * `pickCat` renormalises weights over the rarities that still have unadopted
 * cats, so odds drift as the collection fills — a locked common is far likelier
 * than its baseline once the commons are nearly gone. Returns 0 for an owned
 * cat, which is why owned entries quote the baseline instead.
 */
export function liveOdds(ownedIds: string[], catId: string): number {
  const owned = new Set(ownedIds);
  if (owned.has(catId)) return 0;

  const spec = CAT_ROSTER.find((cat) => cat.id === catId);
  if (!spec) return 0;

  let live = 0;
  let remainingInRarity = 0;
  for (const cat of CAT_ROSTER) {
    if (owned.has(cat.id)) continue;
    if (cat.rarity === spec.rarity) remainingInRarity++;
  }
  if (!remainingInRarity) return 0;

  const rarities = new Set(
    CAT_ROSTER.filter((cat) => !owned.has(cat.id)).map((cat) => cat.rarity)
  );
  rarities.forEach((rarity) => {
    live += RARITY_WEIGHTS[rarity];
  });

  return RARITY_WEIGHTS[spec.rarity] / live / remainingInRarity;
}

export function oddsLabel(probability: number): string {
  if (probability <= 0) return '—';
  return `1 pull in ${Math.round(1 / probability)}`;
}

/* ---------------------------- play history ----------------------------- */

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export const DAY_PART_ORDER: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];

export const DAY_PART_LABEL: Record<DayPart, string> = {
  morning: 'the morning',
  afternoon: 'the afternoon',
  evening: 'the evening',
  night: 'after dark',
};

/**
 * Which slice of the day an hour belongs to.
 *
 * Night is 19:00–05:59 so it matches `isNightAt()` in town/palette.ts — the
 * app already has an opinion about when night starts and the almanac should
 * not invent a second one.
 */
export function dayPartAt(hour: number): DayPart {
  if (hour >= 19 || hour < 6) return 'night';
  if (hour < 11) return 'morning';
  if (hour < 15) return 'afternoon';
  return 'evening';
}

/**
 * What the almanac remembers about your time with one cat.
 *
 * There is deliberately no `served` total: it is the sum of `parts`, and
 * storing both invites the two to disagree. A four-slot tally is also all the
 * resolution the facts need — a 24-hour histogram would be 864 numbers
 * persisted to report one clause, most of it noise at realistic serve counts.
 *
 * `bondXp` follows the same rule and is the only bond field stored: level, tip
 * and progress are all functions of it and the cat's rarity, so they live in
 * `constants/bonds.ts` as derivations rather than as a second persisted number
 * that has to be kept in step with the first.
 */
export interface CatStat {
  /** dateKey of adoption, or null when the save predates this record. */
  adoptedOn: string | null;
  firstServedOn: string | null;
  lastServedOn: string | null;
  parts: Record<DayPart, number>;
  /** Bond XP earned from serving this cat. See `constants/bonds.ts`. */
  bondXp: number;
}

export function emptyCatStat(adoptedOn: string | null): CatStat {
  return {
    adoptedOn,
    firstServedOn: null,
    lastServedOn: null,
    parts: { morning: 0, afternoon: 0, evening: 0, night: 0 },
    bondXp: 0,
  };
}

export function totalServed(stat: CatStat | undefined | null): number {
  if (!stat) return 0;
  return DAY_PART_ORDER.reduce((sum, part) => sum + (stat.parts[part] ?? 0), 0);
}

/**
 * Below this many serves a "favourite time of day" is noise dressed as a fact,
 * so the almanac says it is still working the cat out instead.
 */
export const DAY_PART_MIN_SAMPLE = 5;

export function favouredPart(stat: CatStat | undefined | null): DayPart | null {
  if (!stat || totalServed(stat) < DAY_PART_MIN_SAMPLE) return null;
  let best: DayPart = 'morning';
  for (const part of DAY_PART_ORDER) {
    if (stat.parts[part] > stat.parts[best]) best = part;
  }
  return stat.parts[best] > 0 ? best : null;
}

/**
 * Rebuilds the stat map from whatever a save happens to hold.
 *
 * Keyed off `ownedCats` so that no owned cat can lack a record and no orphan
 * record survives — there is no un-adopt, so dropping is the safe direction.
 * Saves written before this field existed get a record with a null date, which
 * the UI must report honestly rather than filling in with today.
 *
 * Same role `seedOwnedCats` plays for the collection itself.
 */
export function backfillCatStats(
  saved: Record<string, CatStat> | undefined,
  ownedIds: string[]
): Record<string, CatStat> {
  const next: Record<string, CatStat> = {};

  for (const id of ownedIds) {
    const prior = saved?.[id];
    next[id] = {
      adoptedOn: prior?.adoptedOn ?? null,
      firstServedOn: prior?.firstServedOn ?? null,
      lastServedOn: prior?.lastServedOn ?? null,
      parts: {
        morning: prior?.parts?.morning ?? 0,
        afternoon: prior?.parts?.afternoon ?? 0,
        evening: prior?.parts?.evening ?? 0,
        night: prior?.parts?.night ?? 0,
      },
      // Saves from before bonds existed start the relationship at zero rather
      // than being credited for serves the game wasn't scoring yet — there is
      // no record of *which* drink went to whom, so any backfill would be a
      // number invented to look generous.
      bondXp: prior?.bondXp ?? 0,
    };
  }

  return next;
}

/* ------------------------------ vocabulary ----------------------------- */

/** A prose name for each coat. The palette keys are code names, not English. */
const COAT_NAME: Record<PaletteName, string> = {
  ginger: 'ginger', gray: 'blue-grey', cream: 'cream', brown: 'chestnut',
  charcoal: 'charcoal', snow: 'snow-white', sand: 'sand', smoke: 'smoke-grey',
  tabbyb: 'russet', calico: 'butterscotch', soot: 'soot-grey', taupe: 'taupe',
  mint: 'mint green', sky: 'sky blue', rose: 'rose pink', lilac: 'lilac',
  slate: 'slate blue', peach: 'peach', sage: 'sage green', clay: 'terracotta',
  honey: 'honey', pearl: 'pearl grey', lavender: 'lavender', plum: 'plum',
  teal: 'teal', coral: 'coral', emerald: 'emerald', indigo: 'indigo',
  magenta: 'magenta', amber: 'amber', gold: 'old gold', silver: 'silver',
  rosegold: 'rose gold', obsidian: 'near-black', celest: 'cornflower',
  prism: 'rose and cornflower',
};

/** What `applyPattern` actually draws, said in English. */
const PATTERN_PROSE: Record<PatternName, string> = {
  solid: 'one unbroken colour',
  tabby: 'banded across the ribs',
  point: 'dark at the face and paws',
  spots: 'lightly freckled',
  socks: 'in white socks',
  patch: 'patched, with stripes at the cheeks',
  patchBR: 'patched down one side',
  patch2: 'patched in two colours',
  bicolor: 'bibbed in white, with a stripe down the front',
};

const EYE_PROSE: Record<EyeName, string> = {
  big: 'wide, round eyes',
  tall: 'narrow almond eyes',
  sparkle: 'a glint in the eye',
  bigspark: 'wide eyes lit from somewhere inside',
  happy: 'eyes shut in two contented arcs',
};

const PATTERN_LABEL: Record<PatternName, string> = {
  solid: 'Solid', tabby: 'Tabby', point: 'Colourpoint', spots: 'Spotted',
  socks: 'Socked', patch: 'Patched', patchBR: 'Half-patched',
  patch2: 'Two-tone patched', bicolor: 'Bicolour',
};

const EYE_LABEL: Record<EyeName, string> = {
  big: 'Wide', tall: 'Almond', sparkle: 'Bright', bigspark: 'Lit', happy: 'Closed',
};

/* ---------------------------- trait salience --------------------------- */

/**
 * How much a trait is worth saying.
 *
 * A bio that lists every field reads like a stat block, and nine tabby cats
 * described by their tabbiness read like one cat printed nine times. So each
 * candidate line is scored by how rare its trait is across the roster —
 * `-ln(count / 36)` — and only the strongest survives.
 *
 * The effect is that different cats end up *about* different things: Toast
 * gets a line about his socks because he is the only cat with any, Prism about
 * the crown, Obsidian about being the darkest cat here, while a cat whose every
 * trait is ordinary falls through to its rarity. Add a cat to the roster and
 * the weights re-balance themselves.
 */
function salience(count: number): number {
  if (count <= 0) return 0;
  return -Math.log(count / CAT_ROSTER.length);
}

const COUNTS = {
  pattern: {} as Record<string, number>,
  eye: {} as Record<string, number>,
  rarity: {} as Record<string, number>,
  tailUp: 0,
  whiteSecond: 0,
  crown: 0,
  sparkles5: 0,
  sparkles9: 0,
};

for (const cat of CAT_ROSTER) {
  COUNTS.pattern[cat.pattern] = (COUNTS.pattern[cat.pattern] ?? 0) + 1;
  COUNTS.eye[cat.eye] = (COUNTS.eye[cat.eye] ?? 0) + 1;
  COUNTS.rarity[cat.rarity] = (COUNTS.rarity[cat.rarity] ?? 0) + 1;
  if (cat.tailUp) COUNTS.tailUp++;
  if (cat.whiteSecond) COUNTS.whiteSecond++;
  if (cat.crown) COUNTS.crown++;
  if (cat.sparkles === 5) COUNTS.sparkles5++;
  if (cat.sparkles === 9) COUNTS.sparkles9++;
}

/** Extremes worth naming, each true of exactly one cat. */
const EXTREMES = (() => {
  let darkest = CAT_ROSTER[0];
  let palest = CAT_ROSTER[0];
  let starkest = CAT_ROSTER[0];
  let blendest = CAT_ROSTER[0];

  const bodyLum = (c: CatSpec) => luminance(PALETTES[c.palette].B);
  const gap = (c: CatSpec) =>
    luminance(PALETTES[c.palette].W) - luminance(PALETTES[c.palette].B);

  for (const cat of CAT_ROSTER) {
    if (bodyLum(cat) < bodyLum(darkest)) darkest = cat;
    if (bodyLum(cat) > bodyLum(palest)) palest = cat;
    if (gap(cat) > gap(starkest)) starkest = cat;
    if (gap(cat) < gap(blendest)) blendest = cat;
  }
  return { darkest: darkest.id, palest: palest.id, starkest: starkest.id, blendest: blendest.id };
})();

/** An extreme outranks every ordinary trait but never a one-of-a-kind one. */
const EXTREME_WEIGHT = 3.2;

/** FNV-1a. Breaks ties and picks between equal phrasings; never a source of facts. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(pool: T[], seed: number): T {
  return pool[seed % pool.length];
}

/* ------------------------------- the bio ------------------------------- */

/**
 * "an emerald cat", not "a emerald cat". Every coat name here is a plain
 * English word whose written vowel matches its spoken one, so the letter test
 * is sufficient — there is no "a unicorn" case in COAT_NAME.
 */
function article(word: string): string {
  return 'aeiou'.includes(word[0].toLowerCase()) ? 'An' : 'A';
}

function coatBand(spec: CatSpec): 'dark' | 'mid' | 'pale' {
  const l = luminance(PALETTES[spec.palette].B);
  if (l < 0.45) return 'dark';
  if (l < 0.7) return 'mid';
  return 'pale';
}

function contrastBand(spec: CatSpec): 'blended' | 'balanced' | 'stark' {
  const p = PALETTES[spec.palette];
  const gap = luminance(p.W) - luminance(p.B);
  if (gap < 0.28) return 'blended';
  if (gap < 0.45) return 'balanced';
  return 'stark';
}

/** Sentence one: what the cat looks like. Grammar is fixed; the shape varies. */
function appearanceSentence(spec: CatSpec): string {
  const coat = COAT_NAME[spec.palette];
  const pattern = PATTERN_PROSE[spec.pattern];
  const eyes = EYE_PROSE[spec.eye];
  const seed = hashId(spec.id + 'look');

  const templates: Record<ReturnType<typeof contrastBand>, string[]> = {
    blended: [
      `${article(coat)} ${coat} cat, ${pattern}, with ${eyes} and a chest barely a shade off the rest.`,
      `${coat[0].toUpperCase()}${coat.slice(1)} throughout, ${pattern}, ${eyes}, all of it at one soft value.`,
    ],
    balanced: [
      `${article(coat)} ${coat} cat, ${pattern}, with ${eyes}.`,
      `${coat[0].toUpperCase()}${coat.slice(1)}, ${pattern}, and ${eyes}.`,
    ],
    stark: [
      `${article(coat)} ${coat} cat, ${pattern}, with the white at the chest set hard against it and ${eyes}.`,
      `${coat[0].toUpperCase()}${coat.slice(1)}, ${pattern}, the chest white reading almost as a lamp against it, and ${eyes}.`,
    ],
  };

  return pick(templates[contrastBand(spec)], seed);
}

interface Clause {
  weight: number;
  text: string;
}

/** Sentence two: the one thing most worth saying about this cat. */
function standoutSentence(spec: CatSpec): string {
  const name = spec.name;
  const seed = hashId(spec.id + 'trait');
  const candidates: Clause[] = [];

  const add = (weight: number, text: string) => candidates.push({ weight, text });

  if (spec.id === EXTREMES.darkest) {
    add(EXTREME_WEIGHT, `${name} has the darkest coat on the roster, and it is not close.`);
  }
  if (spec.id === EXTREMES.palest) {
    add(EXTREME_WEIGHT, `${name} is the palest cat here, and reads as one soft mass at any distance.`);
  }
  if (spec.id === EXTREMES.starkest) {
    add(EXTREME_WEIGHT, `Nothing else in the café carries a contrast like ${name} does.`);
  }
  if (spec.id === EXTREMES.blendest) {
    add(EXTREME_WEIGHT, `${name} is drawn in one register, coat and chest almost the same value.`);
  }

  if (spec.crown) {
    add(salience(COUNTS.crown), `${name} is the only cat on the roster wearing a crown, and gives no sign of finding that unusual.`);
  }
  if (spec.pattern === 'socks') {
    add(salience(COUNTS.pattern.socks), `${name} is the only cat here in white socks, and wears them as though nobody has mentioned it.`);
  }
  if (spec.sparkles === 9) {
    add(salience(COUNTS.sparkles9), `Nine points of light travel with ${name} wherever ${name} goes.`);
  } else if (spec.sparkles === 5) {
    add(salience(COUNTS.sparkles5), `Five points of light keep station around ${name}.`);
  }
  if (spec.tailUp) {
    add(salience(COUNTS.tailUp), pick([
      `${name} carries the tail up, and has never been seen to drop it.`,
      `The tail on ${name} stays up like a flag.`,
    ], seed));
  }
  if (spec.whiteSecond) {
    add(salience(COUNTS.whiteSecond), `The second coat on ${name} came out white rather than colour.`);
  }
  if (spec.eye === 'happy') {
    add(salience(COUNTS.eye.happy), `${name}'s eyes are shut more or less permanently, in what may or may not be contentment.`);
  }
  if (spec.eye === 'bigspark') {
    add(salience(COUNTS.eye.bigspark), `There is a light in ${name}'s eyes the ordinary cats do not have.`);
  }
  if (spec.pattern === 'patchBR') {
    add(salience(COUNTS.pattern.patchBR), `${name} is patched down one side and plain down the other.`);
  }
  if (spec.pattern === 'spots') {
    add(salience(COUNTS.pattern.spots), `${name} is freckled, which you only notice up close.`);
  }
  if (spec.pattern === 'solid') {
    add(salience(COUNTS.pattern.solid), `${name} came out in a single colour, with nothing to interrupt it.`);
  }

  // The floor. Rarity sets the register, so an unremarkable common still gets a
  // sentence with a voice rather than a shrug.
  const band = coatBand(spec);
  const fallbacks: Record<Rarity, string[]> = {
    common: [
      `${name} is a regular sort of cat, and has never appeared to want to be anything else.`,
      `There is nothing rare about ${name}, which ${name} carries without complaint.`,
    ],
    rare: [
      `${name} turns up less often than most, and seems aware of it.`,
      `You do not see ${name} every day.`,
    ],
    epic: [
      `${name} is one of the scarcer cats, and holds the room a little when present.`,
      `${name} does not arrive often, and the room notices when ${name} does.`,
    ],
    legendary: [
      `${name} is one of five cats anyone rarely gets to meet.`,
      `Sightings of ${name} are the sort of thing people mention afterwards.`,
    ],
    ultra: [
      `${name} has been seen by almost nobody, and behaves as though that is the natural order.`,
    ],
  };
  add(salience(COUNTS.rarity[spec.rarity]) * 0.5, pick(fallbacks[spec.rarity], seed + (band === 'dark' ? 1 : 0)));

  candidates.sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text));
  return candidates[0].text;
}

/**
 * Sentence three: the drink, and the history if there is any.
 *
 * Everything here is either derived from the sprite or read from real play
 * data. Nothing claims *when* or *where* a cat shows up unless `catStats` says
 * so — the café spawns uniformly from your collection, so an invented habit
 * ("first in every morning") is falsifiable on the café floor, and the first
 * time a player notices, every other fact in the almanac loses its credit.
 */
function habitSentence(spec: CatSpec, stat?: CatStat | null): string {
  // The same answer the Taste card gives. These disagreed once — the bio was
  // still on an older five-drink vocabulary and told you a cat took mango
  // directly above a card saying it loved brown sugar.
  const drink = DRINKS[favoriteDrink(spec)].name.toLowerCase();
  const seed = hashId(spec.id + 'drink');
  const opener = pick([
    `Takes the ${drink}.`,
    `Drinks ${drink}, and has not been talked out of it.`,
    `${drink[0].toUpperCase()}${drink.slice(1)}, every time.`,
  ], seed);

  const served = totalServed(stat);
  if (!stat || served === 0) return `${opener} No cup poured yet.`;

  const part = favouredPart(stat);
  const cups = served === 1 ? 'One cup so far' : `${served} cups so far`;
  if (part) return `${opener} ${cups}, most of them in ${DAY_PART_LABEL[part]}.`;
  return `${opener} ${cups}.`;
}

/** The whole entry, three sentences, stable for the life of a save. */
export function catBio(spec: CatSpec, stat?: CatStat | null): string {
  return [appearanceSentence(spec), standoutSentence(spec), habitSentence(spec, stat)].join(' ');
}

/* ---------------------------- observations ----------------------------- */

export function catObservations(spec: CatSpec): { label: string; value: string }[] {
  const coat = COAT_NAME[spec.palette];

  const rows = [
    // The only row stored as a bare noun; every other value is authored in the
    // case it should display in. A blanket text-transform here would reach the
    // sentence-shaped values too and render "1 Pull In 143".
    { label: 'Coat', value: coat[0].toUpperCase() + coat.slice(1) },
    { label: 'Markings', value: PATTERN_LABEL[spec.pattern] },
    { label: 'Eyes', value: EYE_LABEL[spec.eye] },
    { label: 'Tail', value: spec.tailUp ? 'Carried up' : 'Swept low' },
  ];
  if (spec.whiteSecond) rows.push({ label: 'Second coat', value: 'White' });
  if (spec.sparkles) rows.push({ label: 'Sparkles', value: String(spec.sparkles) });
  if (spec.crown) rows.push({ label: 'Crown', value: 'Yes' });
  return rows;
}

export { COAT_NAME };
