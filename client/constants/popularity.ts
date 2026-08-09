import { HABIT_TIERS, HabitTier } from './habitTiers';
import { SHOP_ITEMS } from './cafeData';

/**
 * Popularity is the café's live standing — how busy the place is *right now*.
 * Unlike pearls and coins it is not a currency: it cannot be spent, it moves in
 * both directions, and it is a readout of current form rather than a total to
 * accumulate.
 *
 * The model, in one line:
 *
 *   popularity(today) = popularity(lastDay) × 0.9^daysElapsed + gains × caféMultiplier
 *
 * Everything here is pure so the curve can be reasoned about and tested without
 * touching state. See the Popularity System section of the README for the
 * design rationale behind each number.
 */

export const MAX_POPULARITY = 100;

/** Fraction of current popularity lost per calendar day. ⚑ tunable */
export const DAILY_DECAY_RATE = 0.1;

/**
 * Exponential decay approaches zero but never reaches it, and the display
 * rounds up — without a snap, an abandoned café would read `1` forever.
 */
export const ZERO_SNAP_THRESHOLD = 0.5;

/**
 * Base popularity per source, *before* the café multiplier.
 *
 * These deliberately compress the habit tier spread: pearls run 100/60/10
 * across keystone/anchor/quick (a 10× spread) while popularity runs
 * 2.0/1.25/0.25. Popularity is meant to read as "a lot is going on here", so it
 * rewards breadth across a day rather than one heroic thing — pearls already
 * reward difficulty and it should not be double-counted.
 */
export const POPULARITY_GAINS = {
  keystone: 2.0,
  anchor: 1.25,
  quick: 0.25,
  focusPerMinute: 0.05,
  catServed: 0.1,
} as const;

/** Café quality multiplier bounds, driven by owned decor and upgrades. */
export const MIN_CAFE_MULTIPLIER = 1.0;
export const MAX_CAFE_MULTIPLIER = 2.0;

/** Shop categories that make the café look nicer, and so raise the multiplier. */
const QUALITY_CATEGORIES = ['decor', 'upgrades'];

/** Spawn pacing at the two ends of the range. */
const IDLE_SPAWN_MS = 180000; // popularity 0 — a slow trickle, never zero
const BUSY_SPAWN_MS = 25000; // popularity 100

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampPopularity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, MAX_POPULARITY);
}

/**
 * Applies `days` worth of decay. Proportional rather than flat, which makes it
 * self-limiting: it takes 10 points from a standing of 100 but only 2 from a
 * standing of 20, so the loss lands hardest on users who have built something
 * up and stays gentle on those returning from a lapse.
 */
export function decayPopularity(value: number, days: number): number {
  if (days <= 0 || value <= 0) return clampPopularity(value);

  const decayed = value * Math.pow(1 - DAILY_DECAY_RATE, days);
  return decayed < ZERO_SNAP_THRESHOLD ? 0 : clampPopularity(decayed);
}

/**
 * The whole number shown to the user. Rounds *up*, so rounding always favours
 * the player and they never see a decimal.
 *
 * This is the only place rounding is allowed to happen. Rounding the stored
 * value instead would compound error daily, and rounding the per-recompute
 * *loss* would make the decay rate depend on how often the app is opened.
 */
export function displayPopularity(value: number): number {
  return clamp(Math.ceil(value), 0, MAX_POPULARITY);
}

/**
 * 1.0× at a bare café, scaling to 2.0× once every decor and upgrade item is
 * owned. This is what makes coins spent on decor an investment: the same
 * real-world effort converts into more standing in a nicer café.
 */
export function cafeQualityMultiplier(unlockedItems: string[]): number {
  const qualifying = SHOP_ITEMS.filter((item) =>
    QUALITY_CATEGORIES.includes(item.category)
  );
  if (!qualifying.length) return MIN_CAFE_MULTIPLIER;

  const owned = qualifying.filter((item) => unlockedItems.includes(item.id)).length;
  const progress = owned / qualifying.length;

  return (
    MIN_CAFE_MULTIPLIER + progress * (MAX_CAFE_MULTIPLIER - MIN_CAFE_MULTIPLIER)
  );
}

/**
 * Base popularity for one rep of a habit, before the café multiplier.
 *
 * Mirrors how pearls treat tiers: `budget` tiers spread a fixed daily amount
 * across however many reps the habit is set to, so splitting a habit into more
 * reps never mints extra popularity. Because popularity is stored as a float
 * the split is exact and needs none of the running-floor correction that
 * `pearlsForRep` does.
 */
export function popularityForRep(tier: HabitTier, timesPerDay: number): number {
  const base = POPULARITY_GAINS[tier];
  if (HABIT_TIERS[tier].rewardModel === 'perRep') return base;
  return base / Math.max(1, timesPerDay);
}

/**
 * Where popularity settles for a given daily gain, i.e. the point at which
 * gains exactly offset the 10% decay. Used by the café screen to show the user
 * what their current routine is worth, and handy when tuning.
 */
export function equilibriumFor(dailyGain: number): number {
  return clampPopularity(dailyGain / DAILY_DECAY_RATE);
}

/**
 * How often a new group arrives. The death-spiral guard lives here rather than
 * on popularity itself: the number is allowed to tell the truth and reach 0,
 * but the café never goes fully dead, so there is always something to come back
 * to.
 */
export function spawnIntervalMs(popularity: number): number {
  const t = clamp(popularity / MAX_POPULARITY, 0, 1);
  return Math.round(IDLE_SPAWN_MS + (BUSY_SPAWN_MS - IDLE_SPAWN_MS) * t);
}

/** Busier cafés draw bigger groups, not just more of them. */
export function maxGroupSize(popularity: number): number {
  if (popularity >= 66) return 3;
  if (popularity >= 33) return 2;
  return 1;
}
