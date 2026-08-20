/**
 * Which cats want which drinks.
 *
 * Thirty-six cats against twenty-four drinks is 864 pairs. Authoring those by
 * hand is both a lot of typing and a rule nobody can learn, so the whole thing
 * is derived instead of tuned by eye — each cat/drink pair gets a stable
 * pseudo-random score from the two ids, nothing else. Earlier this ran off
 * coat colour ("a green cat drinks green things"), which quietly turned into
 * sorting cats by their colouring and deciding what they're allowed to like —
 * not a rule this game needs a version of. The id-based version keeps a cat's
 * taste fixed and guessable-from-the-almanac without hanging it off anything
 * you can see on the sprite.
 *
 * Rarity does the second half of the work: a cat's *favorite* is pulled toward
 * drinks within one rarity band of its own, which is what makes a legendary
 * cat worth saving pearls for and stops a common one demanding the ultra.
 *
 * Overlap is deliberately generous — most cats like most drinks at least a
 * little, so a drink entry in the almanac reads as a small crowd, not a
 * single name. `LIKES_COUNT` is what controls that; see the note below.
 *
 * Pure — no React, no state, no `Math.random()`. Read from inside state
 * updaters, which React may invoke more than once per commit.
 */

import { CAT_ROSTER, type CatSpec, type Rarity } from './catSprites';
import { DRINKS, DRINK_ORDER, type DrinkId } from './drinks';

export type Affinity = 'favorite' | 'likes' | 'fine' | 'dislikes';

/* ------------------------------ the payouts ---------------------------- */

/** Coin multiplier on the drink's base. */
export const AFFINITY_COINS: Record<Affinity, number> = {
  favorite: 2.0,
  likes: 1.4,
  fine: 1.0,
  dislikes: 0.5,
};

/**
 * Popularity, added on serve. Dislikes is **negative** on purpose: a wrong
 * drink has to be actively bad, not merely less good, or the optimal play is
 * always to serve the cheapest thing to everyone.
 */
export const AFFINITY_POPULARITY: Record<Affinity, number> = {
  favorite: 0.3,
  likes: 0.15,
  fine: 0.05,
  dislikes: -0.2,
};

/** Bond XP multiplier on the drink's pearl cost. */
export const AFFINITY_XP: Record<Affinity, number> = {
  favorite: 3,
  likes: 2,
  fine: 1,
  dislikes: 0,
};

export const AFFINITY_LABEL: Record<Affinity, string> = {
  favorite: 'Loves',
  likes: 'Likes',
  fine: 'Fine with',
  dislikes: 'Dislikes',
};

/** Pips on the payout badge. Three slots always, so the row never reflows. */
export const AFFINITY_PIPS: Record<Affinity, string> = {
  favorite: '♥♥♥',
  likes: '♥',
  fine: '–',
  dislikes: '✕',
};

/* ------------------------------- scoring ------------------------------- */

/** Above this score a cat actively refuses the drink. Out of a 0–199 range. */
const DISLIKE_SCORE = 170;
/**
 * How hard a cat is pulled toward drinks of its own rarity, per band of
 * distance. This is what makes a legendary cat want something expensive
 * without hard-gating it — and what keeps the ultra off common cats.
 *
 * Applied to the favorite only. What a cat *refuses* is unrelated to rarity;
 * rarity has no business making a cat hate a cheap drink.
 *
 * Asymmetric on purpose. Pulling a legendary cat *down* to a common drink is
 * the thing we most want to prevent — that is the whole "save your pearls for
 * this one" pressure — while a common cat reaching *up* is merely unlikely.
 * A symmetric pull left the ultra drink as nobody's favorite at all.
 */
const RARITY_PULL_DOWN = 26;
const RARITY_PULL_UP = 10;

function rarityPull(catRank: number, drinkRank: number): number {
  return drinkRank < catRank
    ? (catRank - drinkRank) * RARITY_PULL_DOWN
    : (drinkRank - catRank) * RARITY_PULL_UP;
}
/**
 * How many drinks sit between the favorite and merely tolerated.
 *
 * Deliberately wide — a quarter of the menu — so a drink's almanac entry is a
 * small crowd rather than one or two names. Two used to leave most drinks with
 * a single fan; this is the knob that fixes that without touching how a
 * *favorite* is picked.
 */
const LIKES_COUNT = 6;

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  ultra: 4,
};

/**
 * A stable pseudo-random integer in [0, 200) for one id pair. FNV-1a over the
 * concatenated ids — deterministic, so the same cat always wants the same
 * drink across renders and reloads, without a lookup table to maintain by
 * hand or any trait of the cat (or the drink) feeding into it.
 */
function pairScore(a: string, b: string): number {
  let h = 0x811c9dc5;
  const s = `${a}:${b}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 200;
}

/** How badly a drink suits a cat. Lower is better. */
function matchScore(cat: CatSpec, id: DrinkId): number {
  return pairScore(cat.id, id);
}

/**
 * Rarest first, then dearest, then by id.
 *
 * Every preference list on every screen is sorted with this, so the order a
 * player learns on the inspect card is the order they meet again in the
 * almanac. Rarest-first because the top of a list is where the eye lands and
 * the rarest drink is the one worth pouring — and because rarity tracks the
 * payout, so the coins column reads roughly downhill.
 */
function byRarity(a: DrinkId, b: DrinkId): number {
  return (
    RARITY_RANK[DRINKS[b].rarity] - RARITY_RANK[DRINKS[a].rarity] ||
    DRINKS[b].pearls - DRINKS[a].pearls ||
    a.localeCompare(b)
  );
}

export interface Preferences {
  favorite: DrinkId;
  likes: DrinkId[];
  dislikes: DrinkId[];
  /**
   * Every drink: the favourite, then likes, then the merely fine, then the
   * refused — rarest first within each. Drives the almanac's full ordering.
   */
  ranked: DrinkId[];
}

const cache = new Map<string, Preferences>();

/**
 * The full preference set for one cat.
 *
 * Memoised by cat id: this runs on every payout preview badge, for every cat
 * in a nine-deep queue, on every recipe the thumb passes over.
 */
export function preferencesFor(spec: CatSpec): Preferences {
  const hit = cache.get(spec.id);
  if (hit) return hit;

  const scored = DRINK_ORDER.map((id) => ({ id, score: matchScore(spec, id) }));

  // Ties break toward the *cheaper* drink, then by id, so the result is stable
  // across runs and a cat never flickers between two equal matches.
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      DRINKS[a.id].pearls - DRINKS[b.id].pearls ||
      a.id.localeCompare(b.id)
  );

  // The favorite is re-scored with rarity pulled in, so a legendary cat wants
  // something worth saving for. `likes` and `dislikes` stay on colour alone.
  const catRank = RARITY_RANK[spec.rarity];
  const favorite = [...scored]
    .map((entry) => ({
      id: entry.id,
      score: entry.score + rarityPull(catRank, RARITY_RANK[DRINKS[entry.id].rarity]),
    }))
    .sort(
      (a, b) =>
        a.score - b.score ||
        DRINKS[a.id].pearls - DRINKS[b.id].pearls ||
        a.id.localeCompare(b.id)
    )[0].id;

  const likes = scored
    .filter((entry) => entry.id !== favorite && entry.score <= DISLIKE_SCORE)
    .slice(0, LIKES_COUNT)
    .map((entry) => entry.id)
    .sort(byRarity);

  const dislikes = scored
    .filter((entry) => entry.score > DISLIKE_SCORE)
    .map((entry) => entry.id)
    .sort(byRarity);

  // Everything that is neither loved, liked nor refused. It has no section of
  // its own on any screen, but `ranked` has to account for all fourteen.
  const fine = scored
    .map((entry) => entry.id)
    .filter((id) => id !== favorite && !likes.includes(id) && !dislikes.includes(id))
    .sort(byRarity);

  const prefs: Preferences = {
    favorite,
    likes,
    dislikes,
    // Affinity first, rarity within it. The match score that picked the groups
    // has done its job by the time they exist, and it is not a quantity a
    // player can see — sorting a *displayed* list by an invisible number makes
    // the order look arbitrary. Rarity is legible on every row.
    ranked: [favorite, ...likes, ...fine, ...dislikes],
  };
  cache.set(spec.id, prefs);
  return prefs;
}

/** What this cat thinks of this drink. */
export function affinityFor(spec: CatSpec, drink: DrinkId): Affinity {
  const prefs = preferencesFor(spec);
  if (drink === prefs.favorite) return 'favorite';
  if (prefs.likes.includes(drink)) return 'likes';
  if (prefs.dislikes.includes(drink)) return 'dislikes';
  return 'fine';
}

export function favoriteDrink(spec: CatSpec): DrinkId {
  return preferencesFor(spec).favorite;
}

/* ------------------------------- payouts ------------------------------- */

export interface ServeOutcome {
  affinity: Affinity;
  coins: number;
  popularity: number;
  xp: number;
}

/**
 * What one cat pays for one drink.
 *
 * `cafeMultiplier`, `streak` and `bondTip` are passed in rather than read,
 * because this is called from inside the serve commit and from the payout
 * preview, which must agree exactly — a badge that promises 112 and pays 96 is
 * worse than no badge.
 */
export function serveOutcome(
  spec: CatSpec,
  drink: DrinkId,
  opts: { cafeMultiplier?: number; streak?: number; bondTip?: number } = {}
): ServeOutcome {
  const affinity = affinityFor(spec, drink);
  const base = DRINKS[drink].baseCoins;
  const cafe = opts.cafeMultiplier ?? 1;
  const streak = opts.streak ?? 1;
  const tip = 1 + (opts.bondTip ?? 0);

  return {
    affinity,
    coins: Math.round(base * AFFINITY_COINS[affinity] * cafe * streak * tip),
    popularity: AFFINITY_POPULARITY[affinity],
    xp: Math.round(DRINKS[drink].pearls * AFFINITY_XP[affinity]),
  };
}

/* ------------------------------- almanac ------------------------------- */

/**
 * Which cats love this drink — the line that does the work on a drink entry.
 * You read it, see four cats you don't own, and go want them.
 */
export function catsFavoring(drink: DrinkId): CatSpec[] {
  return CAT_ROSTER.filter((cat) => preferencesFor(cat).favorite === drink);
}

/** Every cat that will at least happily take it. */
export function catsLiking(drink: DrinkId): CatSpec[] {
  return CAT_ROSTER.filter((cat) => {
    const prefs = preferencesFor(cat);
    return prefs.favorite === drink || prefs.likes.includes(drink);
  });
}
