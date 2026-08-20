/**
 * The player's own ladder — how long you have kept this up.
 *
 * **This is not a level.** The app already spends that word twice: `state.level`
 * is the café's, which coins buy and which gates seeds and shop stock, and
 * `bondLevel` is a single cat's. A third thing called a level would make every
 * "reach level 5" string in the app ambiguous. This one is a *rank*, and it is
 * mostly worn as a title — the number beside it is small on purpose.
 *
 * **It buys nothing.** No gates hang off it, no multiplier reads it. It is the
 * one number in the app that measures the person rather than the café, and
 * giving it a payout would immediately make it a thing to farm rather than a
 * thing to look at.
 *
 * **XP is exactly the pearls you have earned.** Not coins, not cups served,
 * not minutes the app was open — pearls, which the economy already pays only
 * for real work: habits logged, focus sat through, a mission checked in, a
 * reflection answered. Spending pearls never costs you rank; un-logging a
 * habit takes back what that rep paid, the same way it takes back the pearls.
 * That equivalence is what lets `creditPearls` in `useCafeState` be the one
 * place either number changes, and what lets an old save rebuild its rank
 * exactly from the daily tallies it was already keeping.
 *
 * Pure — no React, no state. Read from inside state updaters, which React may
 * invoke more than once per commit.
 */

export interface RankSpec {
  /** What you are called at this rank. */
  title: string;
  /** Total XP required to reach it. */
  xp: number;
}

/**
 * Ten ranks, roughly doubling in width.
 *
 * A full day of the routine — mission, a keystone, a couple of anchors, some
 * quick wins, a focus block — pays somewhere around 200–250 pearls, so the
 * first title lands on day one and the last is a couple of months of showing
 * up. The titles say nothing about how *much* you did, only how long you have
 * been at it, because that is the only thing this ladder actually measures.
 */
export const RANKS: RankSpec[] = [
  { title: 'New here', xp: 0 },
  { title: 'Settling in', xp: 150 },
  { title: 'Finding a rhythm', xp: 400 },
  { title: 'Steady', xp: 850 },
  { title: 'Regular', xp: 1500 },
  { title: 'Reliable', xp: 2400 },
  { title: 'Practised', xp: 3600 },
  { title: 'Seasoned', xp: 5200 },
  { title: 'Rooted', xp: 7200 },
  { title: 'Devoted', xp: 9800 },
];

export const TOTAL_RANKS = RANKS.length;

/**
 * The rank a given XP total holds, 1-based.
 *
 * Walks down from the top so a maxed player exits first and the loop cannot
 * fall through to a rank the thresholds don't support.
 */
export function rankAt(xp: number): number {
  for (let rank = TOTAL_RANKS; rank >= 1; rank--) {
    if (xp >= RANKS[rank - 1].xp) return rank;
  }
  return 1;
}

/** The title held at a given XP total. */
export function rankTitle(xp: number): string {
  return RANKS[rankAt(xp) - 1].title;
}

export interface RankProgress {
  rank: number;
  title: string;
  /** The title being walked toward, or null once there isn't one. */
  nextTitle: string | null;
  /** Fraction through the current rank, 0–1. A maxed player reads 1. */
  fraction: number;
  /** XP banked toward the next rank. */
  into: number;
  /** XP the current rank spans. 0-safe for the UI to divide by. */
  span: number;
  /** XP still owed to the next rank. 0 at the top. */
  remaining: number;
  maxed: boolean;
}

/**
 * Everything a progress band needs, in one pass — same shape and the same
 * reasoning as `bondProgress`: every caller that wants one of these wants
 * three, and separate helpers over the same argument are separate chances to
 * walk the ladder inconsistently.
 */
export function rankProgress(xp: number): RankProgress {
  const rank = rankAt(xp);
  const title = RANKS[rank - 1].title;

  if (rank >= TOTAL_RANKS) {
    return {
      rank,
      title,
      nextTitle: null,
      fraction: 1,
      into: 0,
      span: 0,
      remaining: 0,
      maxed: true,
    };
  }

  const floor = RANKS[rank - 1].xp;
  const ceiling = RANKS[rank].xp;
  const span = ceiling - floor;
  const into = Math.max(0, xp - floor);

  return {
    rank,
    title,
    nextTitle: RANKS[rank].title,
    fraction: span > 0 ? Math.min(1, into / span) : 1,
    into,
    span,
    remaining: Math.max(0, ceiling - xp),
    maxed: false,
  };
}

/**
 * Rebuilds a save's XP from the per-day pearl tallies in `dailyStats`.
 *
 * Only for saves written before this field existed. It is exact rather than
 * generous: `pearlsEarned` is incremented at precisely the sites that now call
 * `creditPearls`, so a rebuilt total matches what the save would hold if the
 * ladder had been there all along. The one thing it can't see is a save old
 * enough to predate `dailyStats` itself, which starts at zero — there is no
 * record left to count.
 */
export function backfillUserXp(dailyStats: Record<string, { pearlsEarned?: number }>): number {
  let total = 0;
  for (const day of Object.values(dailyStats ?? {})) {
    const earned = day?.pearlsEarned;
    if (typeof earned === 'number' && earned > 0) total += earned;
  }
  return Math.round(total);
}

/**
 * The ladder's colour: pearl lavender, because the ladder *is* pearls.
 *
 * Not in `ACCENTS` because that map is keyed by Growth Hub section and the
 * rank isn't one — it sits above the sections rather than beside them, and a
 * ninth key would make every `Record<AccentKey, ...>` in the theme owe it an
 * entry it has no use for.
 *
 * It is the pearl lavender (`colors.lavender`, `#C8B6F2`) pushed a third of
 * the way toward its ink, which is the same correction `ACCENT_FILLS` applies
 * and for the same reason: at its own value the fill lands within a dozen or so
 * points of luminance of the panel it fills against, and a bar that differs
 * from its track only in hue reads as a tint rather than as progress. The
 * material's track is repainted at dusk and has been repainted outright since
 * this was chosen, so the fill is darkened rather than fitted to one ground.
 */
export const RANK_ACCENT = '#9F8DCA';
