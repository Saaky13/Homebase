import {
  CAT_ROSTER,
  RARITY_ORDER,
  catsByRarity,
  type CatSpec,
  type Rarity,
} from './catSprites';
import {
  DRINK_ORDER,
  STARTER_RECIPES,
  drinksByRarity,
  type DrinkSpec,
} from './drinks';

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
 * The price ladder — the fourth entry is also the ceiling.
 *
 * The shelter used to charge a flat 100, which is the wrong shape at both
 * ends. You open with three cats, two recipes, and a café that runs the same
 * handful of customers past you on a loop, so the opening pulls are the ones
 * worth making nearly free — they're what turns that into a café. A tenner for
 * the fourth thing you own is meant to be an easy yes.
 */
export const PULL_COSTS = [10, 25, 50, 100];

/**
 * The price of the next pull, given how much of the collection is already
 * home — 10, 25, 50, then 100 for everything after that.
 *
 * One ladder for both halves, because there is one crank. 100 is a ceiling,
 * not a waypoint: the ramp exists to stop the opening pulls costing the same
 * as the last legendary, and once it's done that job there's no reason to keep
 * climbing — a price that kept rising would end up taxing the players who
 * stuck around longest, and the tail is already the hard part on rarity alone.
 *
 * Derived from what you own rather than a stored counter, so there's no new
 * state field and no migration — an existing save prices itself correctly the
 * moment it loads, including one whose extra commons came from the retired
 * Market items via `seedOwnedCats`.
 */
export function pullCost(ownedCats: number, ownedRecipes: number): number {
  const starters = STARTER_CATS.length + STARTER_RECIPES.length;
  const pullsMade = Math.max(0, ownedCats + ownedRecipes - starters);
  const rung = Math.min(pullsMade, PULL_COSTS.length - 1);
  return PULL_COSTS[rung];
}

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

/** Anything the machine can dispense: it needs an id and a rarity, nothing else. */
interface Collectible {
  id: string;
  rarity: Rarity;
}

/**
 * Draws one entry the player doesn't already own, or null once the roster is
 * complete. Rarity is chosen first and the entry uniformly within it, so the
 * odds describe the rarity you get rather than being diluted by how many
 * entries happen to share it.
 *
 * Generic over what's being drawn because the shelter and the brew bar are the
 * same machine on the same weights — the drink roster is deliberately built to
 * the same five rarities so a pull reads the same either way.
 */
function pickUnowned<T extends Collectible>(
  rosterFor: (rarity: Rarity) => T[],
  ownedIds: string[],
  rarityRoll: number,
  indexRoll: number
): T | null {
  const owned = new Set(ownedIds);

  const buckets = RARITY_ORDER.map((rarity) => ({
    rarity,
    entries: rosterFor(rarity).filter((entry) => !owned.has(entry.id)),
  })).filter((bucket) => bucket.entries.length > 0);

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

  const index = Math.floor(clamp01(indexRoll) * chosen.entries.length);
  return chosen.entries[index];
}

/** Draws one cat the player doesn't already own, or null once all are adopted. */
export function pickCat(
  ownedIds: string[],
  rarityRoll: number,
  indexRoll: number
): CatSpec | null {
  return pickUnowned(catsByRarity, ownedIds, rarityRoll, indexRoll);
}

/** Draws one recipe the player doesn't already know, or null once the menu is complete. */
export function pickDrink(
  ownedIds: string[],
  rarityRoll: number,
  indexRoll: number
): DrinkSpec | null {
  return pickUnowned(drinksByRarity, ownedIds, rarityRoll, indexRoll);
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

/* ------------------------------------------------------------------ *
 * The brew bar — the same machine, dispensing recipes instead of cats.
 * ------------------------------------------------------------------ */

export const TOTAL_RECIPES = DRINK_ORDER.length;

/** Per-rarity progress for the menu's section headers. */
export function recipesOwnedByRarity(
  ownedIds: string[]
): Record<Rarity, { owned: number; total: number }> {
  const owned = new Set(ownedIds);

  return RARITY_ORDER.reduce((acc, rarity) => {
    const drinks = drinksByRarity(rarity);
    acc[rarity] = {
      owned: drinks.filter((drink) => owned.has(drink.id)).length,
      total: drinks.length,
    };
    return acc;
  }, {} as Record<Rarity, { owned: number; total: number }>);
}

/**
 * What a turn of the crank produced. The machine dispenses two kinds of thing,
 * and the reveal has to know which it's looking at — a discriminated union
 * rather than two nullable fields, so "both" and "neither" can't happen.
 */
export type Prize =
  | { kind: 'cat'; cat: CatSpec }
  | { kind: 'drink'; drink: DrinkSpec };

/**
 * One crank, one price, one capsule — a cat or a recipe, and you don't get to
 * pick.
 *
 * The two halves are weighted by **how many are left in each**, not by a fixed
 * split. That's self-balancing and needs no tuning: the roster you've barely
 * touched is the one more likely to come up, both halves run dry at roughly
 * the same moment, and once one is complete the other quietly takes every
 * pull. A fixed 50/50 would spend the back half of the game handing out
 * nothing but whichever roster is bigger.
 *
 * Pure, like everything else here — the three rolls arrive as parameters so
 * this can be called from inside a state updater React may run twice.
 */
export function pickPrize(
  ownedCats: string[],
  ownedRecipes: string[],
  kindRoll: number,
  rarityRoll: number,
  indexRoll: number
): Prize | null {
  const catsLeft = TOTAL_CATS - ownedCats.length;
  const drinksLeft = TOTAL_RECIPES - ownedRecipes.length;
  if (catsLeft <= 0 && drinksLeft <= 0) return null;

  const wantCat = clamp01(kindRoll) * (catsLeft + drinksLeft) < catsLeft;

  // The `?? ` arms cover the case where the preferred half is empty. They can't
  // both miss: one of the two counts is positive or we returned above.
  if (wantCat) {
    const cat = pickCat(ownedCats, rarityRoll, indexRoll);
    if (cat) return { kind: 'cat', cat };
    const drink = pickDrink(ownedRecipes, rarityRoll, indexRoll);
    return drink ? { kind: 'drink', drink } : null;
  }

  const drink = pickDrink(ownedRecipes, rarityRoll, indexRoll);
  if (drink) return { kind: 'drink', drink };
  const cat = pickCat(ownedCats, rarityRoll, indexRoll);
  return cat ? { kind: 'cat', cat } : null;
}
