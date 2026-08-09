export type HabitTier = 'quick' | 'anchor' | 'keystone';

/**
 * How a tier converts reps into pearls.
 *
 * - `budget`: the tier is worth a fixed amount for the whole day, split
 *   across however many reps the habit is set to. Splitting a habit into
 *   more reps makes each one cheaper, never more lucrative, so rep count
 *   is a scheduling choice rather than a way to farm pearls.
 * - `perRep`: each rep pays a flat amount. Used for small repeatable
 *   habits where doing it more genuinely is doing more.
 */
export type RewardModel = 'budget' | 'perRep';

export interface HabitTierDef {
  id: HabitTier;
  label: string;
  blurb: string;
  rewardModel: RewardModel;
  /** daily total for `budget` tiers, per-rep value for `perRep` tiers */
  pearls: number;
  defaultTimesPerDay: number;
  maxTimesPerDay: number;
  tint: string;
  ink: string;
}

export const HABIT_TIERS: Record<HabitTier, HabitTierDef> = {
  keystone: {
    id: 'keystone',
    label: 'Keystone',
    blurb: 'Your one hard thing. Big payoff, once a day.',
    rewardModel: 'budget',
    pearls: 100,
    defaultTimesPerDay: 1,
    maxTimesPerDay: 1,
    tint: '#D9F5EA',
    ink: '#2F6B54',
  },
  anchor: {
    id: 'anchor',
    label: 'Daily anchor',
    blurb: 'The everyday backbone of your routine.',
    rewardModel: 'budget',
    // 60 splits evenly across 1, 2, or 3 reps (60 / 30 / 20)
    pearls: 60,
    defaultTimesPerDay: 1,
    maxTimesPerDay: 3,
    tint: '#CFEAFF',
    ink: '#38617D',
  },
  quick: {
    id: 'quick',
    label: 'Quick win',
    blurb: 'Small and repeatable. Stack a few a day.',
    rewardModel: 'perRep',
    pearls: 10,
    defaultTimesPerDay: 3,
    maxTimesPerDay: 4,
    tint: '#FFDDBF',
    ink: '#8A5A33',
  },
};

// Display order: heaviest commitment first.
export const TIER_ORDER: HabitTier[] = ['keystone', 'anchor', 'quick'];

/** Total pearls a habit can pay out in a single fully-completed day. */
export function dailyPearlTotal(tier: HabitTier, timesPerDay: number): number {
  const def = HABIT_TIERS[tier];
  return def.rewardModel === 'budget' ? def.pearls : def.pearls * Math.max(1, timesPerDay);
}

/**
 * Pearls awarded for the nth rep (1-indexed) of a habit.
 *
 * Budget tiers distribute their daily total across reps using running
 * floors, so the payouts always sum to exactly the budget even when it
 * doesn't divide evenly — no rep is silently lost to rounding.
 */
export function pearlsForRep(
  tier: HabitTier,
  timesPerDay: number,
  repNumber: number
): number {
  const def = HABIT_TIERS[tier];
  if (def.rewardModel === 'perRep') return def.pearls;

  const cap = Math.max(1, timesPerDay);
  const n = Math.min(Math.max(1, repNumber), cap);
  return (
    Math.floor((def.pearls * n) / cap) - Math.floor((def.pearls * (n - 1)) / cap)
  );
}
