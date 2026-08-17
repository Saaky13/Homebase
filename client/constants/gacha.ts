import {
  CAT_ROSTER,
  RARITY_ORDER,
  catsByRarity,
  type CatSpec,
  type Rarity,
} from './catSprites';

/**
 * The Cat Shelter's adoption draw.
 *
 * Every function here is pure — no React, no state, no Math.random(). Rolls
 * arrive as parameters so the draw can be replayed, tested, and (importantly)
 * called from inside a state updater that React may invoke more than once for
 * a single commit. See `adoptCat` in useCafeState.
 */

export const TOTAL_CATS = CAT_ROSTER.length;

/**
 * The adoption price ladder — the fourth entry is also the ceiling.
 *
 * The shelter used to charge a flat 100, which is the wrong shape at both
 * ends. You open with three cats and a café that runs the same handful of
 * customers past you on a loop, so the opening adoptions are the ones worth
 * making nearly free — they're what turns that into a café. A tenner for the
 * fourth cat is meant to be an easy yes.
 *
 * The ladder roughly doubles, so the price is 100 once you're six cats in and
 * the collection has started to feel like one.
 */
export const EARLY_ADOPTION_COSTS = [10, 25, 50, 100];

/**
 * The price of the next adoption, given how many cats are already home:
 * 10, 25, 50, then 100 for every adoption after that.
 *
 * 100 is a ceiling, not a waypoint. The ramp exists to stop the opening cats
 * costing the same as the last legendary, and once it's done that job there's
 * no reason to keep climbing — a price that kept rising would end up taxing
 * the players who stuck around longest, and the tail of the collection is
 * already the hard part on rarity alone. 3,085 coins for the full set.
 *
 * Derived from the collection rather than a stored counter, so there's no new
 * state field and no migration — an existing save prices itself correctly the
 * moment it loads, including one whose extra commons came from the retired
 * Market items via `seedOwnedCats`.
 */
export function adoptionCost(ownedCount: number): number {
  const adoptionsMade = Math.max(0, ownedCount - STARTER_CATS.length);
  const rung = Math.min(adoptionsMade, EARLY_ADOPTION_COSTS.length - 1);
  return EARLY_ADOPTION_COSTS[rung];
}

/**
 * The cats you start with. Three commons keeps the town from looking abandoned
 * on day one without handing out anything the shelter should be making you
 * work for — no epic or legendary is ever free.
 */
export const STARTER_CATS: string[] = ['mochi', 'clover', 'pebble'];

/**
 * Relative odds of each rarity. These are weights rather than percentages
 * because they get renormalised over whichever rarities still have unadopted
 * cats left — once the commons run out their share is redistributed across
 * the rest, so a pull is never wasted and the collection always completes.
 */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  rare: 25,
  epic: 11,
  legendary: 3.5,
  ultra: 0.5,
};

/** Rolls come from Math.random(), but a caller passing exactly 1 shouldn't overflow a bucket. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(0.9999999, Math.max(0, n));
}

/**
 * Draws one cat the player doesn't already own, or null once all of them are
 * adopted. Rarity is chosen first and the cat uniformly within it, so the odds
 * describe the rarity you get rather than being diluted by how many cats
 * happen to share it.
 */
export function pickCat(
  ownedIds: string[],
  rarityRoll: number,
  indexRoll: number
): CatSpec | null {
  const owned = new Set(ownedIds);

  const buckets = RARITY_ORDER.map((rarity) => ({
    rarity,
    cats: catsByRarity(rarity).filter((cat) => !owned.has(cat.id)),
  })).filter((bucket) => bucket.cats.length > 0);

  if (buckets.length === 0) return null;

  const totalWeight = buckets.reduce(
    (sum, bucket) => sum + RARITY_WEIGHTS[bucket.rarity],
    0
  );

  // Walk the buckets subtracting their weight until the roll runs out. The
  // last bucket is the fallback so floating-point drift can't fall through.
  let remaining = clamp01(rarityRoll) * totalWeight;
  let chosen = buckets[buckets.length - 1];

  for (const bucket of buckets) {
    remaining -= RARITY_WEIGHTS[bucket.rarity];
    if (remaining < 0) {
      chosen = bucket;
      break;
    }
  }

  const index = Math.floor(clamp01(indexRoll) * chosen.cats.length);
  return chosen.cats[index];
}

/**
 * What an existing save starts out owning. The Market used to sell three cats
 * that only ever incremented a counter; anyone who bought them keeps the same
 * number of cats walking their town, drawn from the commons in roster order so
 * the result is stable across reloads.
 */
export function seedOwnedCats(unlockedItems: string[]): string[] {
  const owned = [...STARTER_CATS];

  const boughtCats = unlockedItems.filter((id) => id.startsWith('cat-')).length;
  if (boughtCats === 0) return owned;

  const replacements = catsByRarity('common')
    .map((cat) => cat.id)
    .filter((id) => !owned.includes(id))
    .slice(0, boughtCats);

  return [...owned, ...replacements];
}

/** Per-rarity progress for the Collection screen's section headers. */
export function catsOwnedByRarity(
  ownedIds: string[]
): Record<Rarity, { owned: number; total: number }> {
  const owned = new Set(ownedIds);

  return RARITY_ORDER.reduce((acc, rarity) => {
    const cats = catsByRarity(rarity);
    acc[rarity] = {
      owned: cats.filter((cat) => owned.has(cat.id)).length,
      total: cats.length,
    };
    return acc;
  }, {} as Record<Rarity, { owned: number; total: number }>);
}
