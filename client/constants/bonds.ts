/**
 * How well you know a cat, and what that pays.
 *
 * Bond is one number that goes up and tips you coins — no perks, no spawn
 * weighting, nothing unlocked behind a level. The whole feature is: serve a cat
 * drinks it actually likes, and it starts paying you a little more than it used
 * to. A relationship you can read off a single bar.
 *
 * **Level is derived, never stored.** `CatStat` holds `xp` alone, and level,
 * tip and progress all fall out of it. Storing a level beside the xp that
 * produces it is the same mistake `catLore.ts` already refuses to make with
 * `served` beside `parts` — two fields that must agree, kept by two different
 * code paths, eventually disagreeing on someone's save. Deriving costs a
 * comparison against a four-entry array.
 *
 * Pure — no React, no state, no `Math.random()`. Read from inside state
 * updaters, which React may invoke more than once per commit.
 */

import type { Rarity } from './catSprites';

/** Levels run 1–5. Level 1 is "we've met" and pays nothing. */
export const MAX_BOND_LEVEL = 5;

/**
 * The coin tip at each level, as a fraction added to the payout.
 *
 * Indexed by level, so `BOND_TIP[1]` is 0 — a cat you have just met pays
 * exactly what the drink is worth. The top is +35%, which is large enough to
 * be worth aiming a legendary at and small enough that it never eclipses the
 * affinity match (×2.0) that earned it.
 */
export const BOND_TIP: Record<number, number> = {
  1: 0,
  2: 0.05,
  3: 0.1,
  4: 0.2,
  5: 0.35,
};

/**
 * Total XP required to *reach* each level, by rarity.
 *
 * Front-loaded on purpose: the jump to L2 is a tenth of the road to L5, so a
 * new player sees a bond move within a couple of good serves and learns the
 * system exists. An even split would put the first level five favourite serves
 * away, which on a system with no tutorial reads as nothing happening.
 *
 * Rarity sets the length of the road, not its shape — a legendary is not a
 * different relationship, it is a slower one. 2800 XP against Prism is a long
 * way at 105 XP a serve (35 pearls x favourite), and it should be.
 */
export const BOND_CURVE: Record<Rarity, number[]> = {
  //          L2    L3    L4     L5
  common: [0, 40, 120, 240, 400],
  rare: [0, 70, 210, 420, 700],
  epic: [0, 110, 330, 660, 1100],
  legendary: [0, 170, 510, 1020, 1700],
  ultra: [0, 280, 840, 1680, 2800],
};

/** XP to L5 — the headline number an almanac entry can quote. */
export function xpToMax(rarity: Rarity): number {
  return BOND_CURVE[rarity][MAX_BOND_LEVEL - 1];
}

/**
 * The level a given XP total buys at a given rarity.
 *
 * Walks down from the top so the common case of a maxed cat exits first and
 * the loop can't fall through to a level the thresholds don't support.
 */
export function bondLevel(xp: number, rarity: Rarity): number {
  const curve = BOND_CURVE[rarity];
  for (let level = MAX_BOND_LEVEL; level >= 1; level--) {
    if (xp >= curve[level - 1]) return level;
  }
  return 1;
}

/** The coin tip this cat currently pays, as a fraction. Feeds `serveOutcome`. */
export function bondTip(xp: number, rarity: Rarity): number {
  return BOND_TIP[bondLevel(xp, rarity)] ?? 0;
}

export interface BondProgress {
  level: number;
  /** Fraction through the current level, 0–1. Maxed cats read 1. */
  fraction: number;
  /** XP banked toward the next level. Equals `span` at max. */
  into: number;
  /** XP the current level spans. 0-safe for the UI to divide by. */
  span: number;
  /** Total XP still owed to reach the next level. 0 at max. */
  remaining: number;
  maxed: boolean;
}

/**
 * Everything a progress bar needs, in one pass.
 *
 * Returned as a record rather than four exported helpers because every caller
 * that wants one of these wants three of them, and four functions over the
 * same two arguments is three chances to walk the curve inconsistently.
 */
export function bondProgress(xp: number, rarity: Rarity): BondProgress {
  const curve = BOND_CURVE[rarity];
  const level = bondLevel(xp, rarity);

  if (level >= MAX_BOND_LEVEL) {
    return { level, fraction: 1, into: 0, span: 0, remaining: 0, maxed: true };
  }

  const floor = curve[level - 1];
  const ceiling = curve[level];
  const span = ceiling - floor;
  const into = Math.max(0, xp - floor);

  return {
    level,
    fraction: span > 0 ? Math.min(1, into / span) : 1,
    into,
    span,
    remaining: Math.max(0, ceiling - xp),
    maxed: false,
  };
}

/** `+15%` and the like, for a card that has room for one short string. */
export function tipLabel(level: number): string {
  const tip = BOND_TIP[level] ?? 0;
  return tip > 0 ? `+${Math.round(tip * 100)}%` : '—';
}
