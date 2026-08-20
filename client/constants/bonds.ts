/**
 * How well you know a cat, and what that pays.
 *
 * Bond is one number that goes up, and it buys exactly two things: a coin tip
 * on every cup that cat buys, and how long that cat will wait in line for you.
 * No spawn weighting, nothing unlocked behind a level. The whole feature is:
 * serve a cat drinks it actually likes, and it gets both more generous and more
 * forgiving. A relationship you can read off a single bar.
 *
 * The two payouts are the same idea pointed at money and at time. A cat that
 * knows you tips you, and a cat that knows you waits for you — and neither is
 * something you can buy, because bond XP only moves when you hand a cat a drink
 * it actually wanted.
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

/**
 * How long a cat will stand in line before it gives up and walks out.
 *
 * ── Why it is measured in hours ──────────────────────────────────────────
 *
 * It used to be seconds — 150s at popularity 0 down to 40s at 100 — and that
 * made the café a reflex test. A cat you couldn't reach in two minutes was a
 * cat you lost, which meant the only way to keep a café was to sit and watch
 * one, and this is an app whose entire thesis is that the work happens
 * somewhere else. A timer that punishes you for closing the app is arguing
 * against the rest of the product.
 *
 * At 30 minutes to 4 hours it argues for it instead: the café fills while you
 * are away, and coming back to it is the visit. You lose cats by forgetting for
 * a day, not by looking away for a minute — the same shape as the greenhouse,
 * which is the other half of the economy that can go backwards through neglect
 * alone, and which also measures in days rather than in seconds.
 *
 * The knock-on is that arrivals are now paced by *you*: the café fills to
 * `maxInside` and holds there until you serve someone. Serving is what makes
 * room for the next cat, so the loop runs at the speed you show up at rather
 * than at the speed of a spawn timer.
 *
 * ── Why bond and rarity, and not popularity ──────────────────────────────
 *
 * Popularity used to set it, on the argument that a busy café should be harder.
 * But popularity already buys more cats and bigger groups, and at hour scale a
 * shorter fuse stopped reading as difficulty and started reading as noise — the
 * number on the card moved for reasons you couldn't see or influence.
 *
 * Bond and rarity are both legible from the inspect card you read it on:
 *
 *   rarity — the base, and it runs *downward*. A common will wait all
 *            afternoon; Prism gives you half an hour. Rarity is otherwise pure
 *            upside — better tips, longer bond road, nicer sprite — and this is
 *            the one place it costs you something. The fancy cat has places to
 *            be.
 *   bond   — a multiplier, doubling across the five levels, which is the
 *            answer to that cost. A legendary you have never served is a
 *            45-minute problem; one you have taken care of will wait an hour
 *            and a half. You earn a rare cat's patience the same way you earn
 *            its tip.
 *
 * The corners are the stated range exactly: ultra at L1 is 30 minutes, common
 * at L5 is 4 hours.
 */
const RARITY_PATIENCE_MS: Record<Rarity, number> = {
  //                    L1        L5
  common: 120 * 60000, //  2h00 →  4h00  ⚑ tunable
  rare: 90 * 60000, //     1h30 →  3h00  ⚑ tunable
  epic: 65 * 60000, //     1h05 →  2h10  ⚑ tunable
  legendary: 45 * 60000, //  45m →  1h30  ⚑ tunable
  ultra: 30 * 60000, //      30m →  1h00  ⚑ tunable
};

/**
 * What each bond level multiplies the base window by.
 *
 * Shaped like `BOND_TIP` and deliberately steeper than it: the tip tops out at
 * +35% because it competes with the affinity match, but nothing competes with
 * patience, so it can afford to double. It is also the level reward you feel
 * first — a few extra coins is arithmetic you have to go looking for, whereas
 * an ultra that suddenly waits an hour is the difference between catching it
 * and not.
 */
export const BOND_PATIENCE: Record<number, number> = {
  1: 1,
  2: 1.15,
  3: 1.35,
  4: 1.6,
  5: 2,
};

/** The longest any cat can ever wait — what a catch-up has to rewind past. */
export const MAX_PATIENCE_MS = Math.max(
  ...Object.values(RARITY_PATIENCE_MS)
) * BOND_PATIENCE[MAX_BOND_LEVEL];

export function patienceWindowMs(xp: number, rarity: Rarity): number {
  return Math.round(
    RARITY_PATIENCE_MS[rarity] * (BOND_PATIENCE[bondLevel(xp, rarity)] ?? 1)
  );
}

/**
 * `3h 12m`, `42m`, `50s` — a wait said at the coarsest unit that still tells
 * you something.
 *
 * Two units at most, and the second is dropped once it stops mattering: `3h`
 * rather than `3h 04m`, because at three hours nobody is counting minutes.
 * Seconds only appear under a minute, where they are the whole story.
 */
export function patienceLabel(ms: number): string {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  if (secs < 60) return `${secs}s`;

  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest >= 5 ? `${hours}h ${rest}m` : `${hours}h`;
}
