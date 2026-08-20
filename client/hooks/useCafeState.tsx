import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  computeHabitStreak,
  daysBetweenDateKeys,
  getPreviousDateKey,
  getTodayDateKey,
  repsOn,
  HabitLogs,
} from '../utils/date';
import { HabitTier, HABIT_TIERS, pearlsForRep } from '../constants/habitTiers';
import { backfillUserXp } from '../constants/userRank';
import {
  cafeQualityMultiplier,
  clampPopularity,
  decayPopularity,
  popularityAfterWalkouts,
  popularityForRep,
  POPULARITY_GAINS,
} from '../constants/popularity';
import {
  pickPrize,
  pullCost,
  seedOwnedCats,
  STARTER_CATS,
  type Prize,
} from '../constants/gacha';
import { DRINKS, STARTER_RECIPES, type DrinkId } from '../constants/drinks';
import {
  emptyCafeVisit,
  impatientCustomers,
  markServed,
  pruneCustomers,
  settleCafeVisit,
  type CafeVisitState,
} from '../constants/cafeVisit';
import {
  backfillCatStats,
  dayPartAt,
  emptyCatStat,
  type CatStat,
} from '../constants/catLore';
import { getCat, type CatSpec } from '../constants/catSprites';
import { serveOutcome } from '../constants/affinity';
import {
  getPlant,
  growthStage,
  yieldForWatering,
  BLOOM_BONUS,
  PENDING_CAP_DAYS,
} from '../constants/plants';
import { catchUpSeenIds } from './guideEngine';

/**
 * One pot on a bench.
 *
 * Growth is counted in *waterings*, never in elapsed time: a plant you ignored
 * for a week is exactly where you left it, older and thirstier but no further
 * along. Coins are paid at the moment you water a mature plant rather than
 * accruing on a clock, for the same reason — the room pays you for showing up,
 * and there is no way to earn from it while the app is closed.
 */
export interface Plant {
  id: string;
  species: string;
  /** Bench socket index. */
  slot: number;
  plantedOn: string;
  waterCount: number;
  lastWateredDate: string | null;
  /** Consecutive days gone by without water. Reset by watering. */
  thirst: number;
  /** Latched once it dies, so a husk stays a husk. */
  dead: boolean;
  /** Earned but unharvested — waiting on a tap. */
  pendingCoins: number;
}

export interface GreenhouseState {
  plants: Plant[];
  /** Benches unlocked. The rest are drawn but bare. */
  benches: number;
  /** Bought and not yet planted, keyed by species. */
  seeds: Record<string, number>;
  /** From composting a husk; each one skips a growth day. */
  fertilizer: number;
  /** Whether the misting system has been installed. */
  misting: boolean;
  /** Days of water in hand, 0–3. Keeps plants alive, never advances them. */
  reservoir: number;
  lastSettledDate: string | null;
}

export type PlantResult =
  | { ok: true; plant: Plant }
  | { ok: false; reason: 'seed' | 'occupied' | 'locked' };

export interface QueueCat {
  id: number;
  name: string;
  emoji: string;
  type: string;
  waitTime: number;
  joinedAt: number;
}

export interface Habit {
  id: string;
  name: string;
  description: string;
  color: string;
  // Tier sets the pearl value per rep; timesPerDay caps how many reps a
  // single day can pay out, which is what keeps tapping from minting pearls.
  tier: HabitTier;
  timesPerDay: number;
  reminderEnabled: boolean;
  reminderText: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

/**
 * One closed week. `weekKey` is the Monday of the week reviewed (see
 * `getWeekKey`), which is also the once-per-week guard: a week can only be
 * closed once. The texts are the user's own words and are kept — a review
 * that vanishes after paying out would make this a quiz, not a journal.
 */
export interface WeeklyReview {
  weekKey: string;
  // option id from the rating row, e.g. 'strong' | 'steady' | 'rough' | 'lost'
  rating: string;
  highlight: string;
  intention: string;
}

export interface DailyStat {
  missionCheckedIn: boolean;
  // whether the daily reflection was answered this day. Day records written
  // before this field existed simply lack it, and every read treats missing
  // as false — no migration walks old records to add a key whose absence
  // already means the right thing.
  reflected: boolean;
  coinsEarned: number;
  drinksMade: number;
  drinksServed: number;
  pearlsEarned: number;
}

export interface CafeVisuals {
  tableStyle: number;
  counterStyle: number;
  rugStyle: number;
}

export interface GuideState {
  // ids of guide beats that have been shown at least once
  seenMessageIds: string[];
  // ids of repeatable beats the user opted out of ("don't show again")
  mutedMessageIds: string[];
  // per-id timestamp of when a beat last surfaced, for cooldown checks
  lastSeenAt: Record<string, number>;
  // timestamp of the last time any beat was shown, for anti-flicker spacing
  lastShownAt: number;
  // if set and in the future, the guide stays silent entirely
  snoozedUntil: number | null;
  // date key of the most recent app open, used to compute the "welcome
  // back" gap; rolled forward to today on every load
  lastOpenedDate: string | null;
  // highest café level the user has already been congratulated for
  lastAcknowledgedLevel: number;
  // whether this save has had its already-true one-time "moment" beats spent
  // without showing them. See `catchUpSeenIds` — without it, any save older
  // than the guide fires a queue of congratulations for things it did weeks
  // ago, four seconds apart, on whatever screen happens to be open.
  caughtUp: boolean;
}

/**
 * The focus timer lives in global state rather than in the Focus screen so a
 * running session survives leaving the section — the Focus view is now one of
 * the Growth Hub's sections, which unmounts whenever you navigate away.
 *
 * `endsAt` is an absolute timestamp rather than a decrementing counter: it
 * means the clock stays correct across unmounts, app restarts, and a
 * throttled/backgrounded interval, instead of drifting by however many ticks
 * were missed.
 */
export interface FocusTimer {
  // length of the session the user selected, in seconds
  durationSeconds: number;
  // authoritative remaining time while paused; while running, remaining is
  // derived from endsAt instead
  remainingSeconds: number;
  // ms epoch when the session is due to finish; null whenever it isn't running
  endsAt: number | null;
  isRunning: boolean;
  // elapsed seconds already paid out, so re-entering the section or reloading
  // never pays for the same minute twice
  creditedSeconds: number;
  // Deep Focus doubles the pearl payout. It is a promise about attention —
  // eventually it will block other apps; today it is the toggle and the rate.
  // Locked while the clock runs (see `setDeepFocus`), and sticky across
  // resets and finished sessions so it behaves like a mode, not a per-session
  // checkbox you re-arm every time.
  deepFocus: boolean;
}

export interface CafeState {
  userName: string;
  mission: string;
  missionLastClaimedDate: string | null;
  // the daily reflection pays out once per calendar day, same as the mission
  // check-in; this is the day it was last answered
  reflectionLastClaimedDate: string | null;
  // every closed week, newest last; the weekKey doubles as the claim guard
  weeklyReviews: WeeklyReview[];
  pearls: number;
  // The player's own progress, in `constants/userRank.ts` terms. It tracks
  // pearls *earned* rather than pearls *held*, so buying something never costs
  // you rank — see `creditPearls`, the only place either number moves.
  userXp: number;
  coins: number;
  // Stored as a float and rounded up only for display — see constants/popularity.ts.
  popularity: number;
  // Date key through which decay has already been applied. Decay is settled
  // against today whenever popularity is read or written, so the value is
  // always a function of days elapsed rather than of how often the app opens.
  popularityLastDecayedDate: string | null;
  level: number;
  bobaInventory: {
    classic: number;
    matcha: number;
    strawberry: number;
  };
  unlockedItems: string[];
  queue: QueueCat[];
  totalFocusMinutes: number;
  upgrades: {
    counter: number;
    seating: number;
    decor: number;
    outdoor: number;
  };
  visuals: CafeVisuals;
  habits: Habit[];
  habitLogs: HabitLogs;
  preferences: {
    // when true, any progress on a habit counts toward the day's completion
    // ring; when false only hitting the full daily cap counts
    partialCountsAsDone: boolean;
  };
  dailyStats: Record<string, DailyStat>;
  guideContext: string;
  todos: TodoItem[];
  guide: GuideState;
  // true while a focus session is actively running, so the guide overlay
  // knows to stay out of the way
  focusSessionActive: boolean;
  focusTimer: FocusTimer;
  /** Achievement ids the user has claimed their pearl reward for. */
  claimedAchievements: string[];
  /**
   * Cat ids adopted from the shelter. This is the whole collection — cats not
   * in here exist nowhere in the app, neither roaming town nor visiting the
   * café.
   */
  ownedCats: string[];
  /**
   * Who is in the café, and when the door last opened.
   *
   * This is the authority on where every owned cat is: listed here means
   * inside the café, absent means out in the town. The two screens read
   * opposite halves of it, which is what stops the same cat being seen in
   * both places at once.
   */
  cafeVisit: CafeVisitState;
  /**
   * Cats who gave up waiting and walked out, ever.
   *
   * Kept because a mechanic that quietly drains your standing with nothing to
   * point at reads as a bug rather than a rule — the guide needs something to
   * match on to explain it, once. A lifetime tally rather than a daily one:
   * it exists to be non-zero, not to be totalled.
   *
   * Counts exactly what was charged for, which is why it moves only when the
   * café is the screen you are on. A cat that came and went while you were
   * doing habits cost you nothing, so claiming it in a tally you are shown
   * would be a lie about a loss you never took.
   */
  catsWalkedOut: number;
  /**
   * What the almanac remembers about each owned cat: when it arrived, and a
   * four-slot tally of when you've served it. Keyed by cat id and kept in step
   * with `ownedCats` by `backfillCatStats` on load, so no owned cat can lack a
   * record. Everything else in an almanac entry is derived from the sprite and
   * needs no storage at all.
   */
  catStats: Record<string, CatStat>;
  /**
   * Recipes on the menu. A drink that isn't in here can't be brewed and shows
   * locked in the almanac — the roster in `drinks.ts` is the catalogue, this
   * is what you actually own of it.
   */
  recipes: DrinkId[];
  // true while an adoption reveal is on screen, so the guide overlay stays out
  // of the way. Never persisted across restarts, same as focusSessionActive.
  revealActive: boolean;
  /** The greenhouse: pots, seeds, and the day the plants were last settled. */
  greenhouse: GreenhouseState;
}

/**
 * The outcome of an adoption attempt. A failure says why so the shelter can
 * show the right thing — you can't afford it, or there's nobody left to adopt.
 */
export type PullResult =
  | { ok: true; prize: Prize }
  | { ok: false; reason: 'coins' | 'complete' };

const STORAGE_KEY = '@focus_cafe_state_v2';

const HABIT_COLORS = [
  '#F6C7D5',
  '#A9D7F3',
  '#C8B6F2',
  '#F2AE72',
  '#B8E1C6',
  '#EAA4B4',
];

export const DEFAULT_FOCUS_MINUTES = 25;

// One boba per minute focused, one pearl per five — the rates the café economy
// is built on, kept here because the timer now settles its own payouts.
const SECONDS_PER_BOBA = 60;
const SECONDS_PER_PEARL = 300;

// Flat per-item reward for checking off a to-do — the list has no tier, so
// unlike habits it pays the same regardless of what got done. Exported so the
// To-Do section can print the payout instead of hardcoding a number that would
// drift the moment this one changed.
export const TODO_PEARL_REWARD = 1;

// The weekly review pays once per calendar week — bigger than the mission's
// daily 25 because it closes seven days, smaller than two days of full
// routine so skipping the week's work and journaling about it never wins.
export const WEEKLY_REVIEW_PEARLS = 40;

const idleFocusTimer = (
  minutes = DEFAULT_FOCUS_MINUTES,
  deepFocus = false
): FocusTimer => ({
  durationSeconds: minutes * 60,
  remainingSeconds: minutes * 60,
  endsAt: null,
  isRunning: false,
  creditedSeconds: 0,
  deepFocus,
});

const initialState: CafeState = {
  userName: '',
  mission: '',
  missionLastClaimedDate: null,
  reflectionLastClaimedDate: null,
  weeklyReviews: [],
  pearls: 100,
  // Zero, not 100: the opening pearls are a float to get you started, not work
  // you did. Rank one is meant to be a thing you walk in at.
  userXp: 0,
  coins: 0,
  popularity: 0,
  popularityLastDecayedDate: null,
  level: 1,
  bobaInventory: {
    classic: 0,
    matcha: 0,
    strawberry: 0,
  },
  unlockedItems: [],
  queue: [],
  totalFocusMinutes: 0,
  upgrades: {
    counter: 0,
    seating: 0,
    decor: 0,
    outdoor: 0,
  },
  visuals: {
    tableStyle: 1,
    counterStyle: 1,
    rugStyle: 1,
  },
  habits: [],
  habitLogs: {},
  preferences: {
    partialCountsAsDone: false,
  },
  dailyStats: {},
  guideContext: 'habits:hub',
  todos: [],
  guide: {
    seenMessageIds: [],
    mutedMessageIds: [],
    lastSeenAt: {},
    lastShownAt: 0,
    snoozedUntil: null,
    lastOpenedDate: null,
    lastAcknowledgedLevel: 1,
    // A brand new save has nothing to catch up on; the load path flips this
    // and finds no matches. It exists so an *older* save only ever runs the
    // backfill once.
    caughtUp: false,
  },
  focusSessionActive: false,
  focusTimer: idleFocusTimer(),
  claimedAchievements: [],
  ownedCats: [...STARTER_CATS],
  cafeVisit: emptyCafeVisit(),
  catsWalkedOut: 0,
  catStats: backfillCatStats(undefined, STARTER_CATS),
  recipes: [...STARTER_RECIPES],
  revealActive: false,
  greenhouse: {
    plants: [],
    // Two benches is a working greenhouse with room to grow; the third is
    // visible from day one so the upgrade has something to point at.
    benches: 2,
    // A free starter seed, so the three-day clock starts on your first visit
    // rather than after a shopping trip — the same reason the collection ships
    // with three cats.
    seeds: { mung: 1 },
    fertilizer: 0,
    misting: false,
    reservoir: 0,
    lastSettledDate: null,
  },
};

/**
 * Older saves stored habitLogs as dateKey -> habitId[] (a habit was either
 * done or not). The rep-based model stores dateKey -> habitId -> count, so
 * a legacy completion migrates to a single rep.
 */
function migrateHabitLogs(raw: unknown): HabitLogs {
  if (!raw || typeof raw !== 'object') return {};

  const out: HabitLogs = {};
  Object.entries(raw as Record<string, unknown>).forEach(([dateKey, value]) => {
    if (Array.isArray(value)) {
      const day: Record<string, number> = {};
      value.forEach((habitId) => {
        if (typeof habitId === 'string') day[habitId] = 1;
      });
      out[dateKey] = day;
    } else if (value && typeof value === 'object') {
      const day: Record<string, number> = {};
      Object.entries(value as Record<string, unknown>).forEach(([habitId, count]) => {
        if (typeof count === 'number' && count > 0) day[habitId] = count;
      });
      out[dateKey] = day;
    }
  });

  return out;
}

/**
 * Older habits carried targetValue/targetLabel/subhabits instead of a tier
 * and a daily cap. Anything missing lands on the middle tier at once a day.
 */
function migrateHabits(raw: unknown): Habit[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((habit, index) => {
    const tier: HabitTier =
      habit?.tier === 'quick' || habit?.tier === 'keystone' || habit?.tier === 'anchor'
        ? habit.tier
        : 'anchor';

    const rawTimes = Number(habit?.timesPerDay);
    const timesPerDay =
      Number.isFinite(rawTimes) && rawTimes > 0
        ? Math.min(Math.round(rawTimes), HABIT_TIERS[tier].maxTimesPerDay)
        : HABIT_TIERS[tier].defaultTimesPerDay;

    return {
      id: typeof habit?.id === 'string' ? habit.id : `habit-${Date.now()}-${index}`,
      name: typeof habit?.name === 'string' ? habit.name : '',
      description: typeof habit?.description === 'string' ? habit.description : '',
      color: typeof habit?.color === 'string' ? habit.color : HABIT_COLORS[index % HABIT_COLORS.length],
      tier,
      timesPerDay,
      reminderEnabled: !!habit?.reminderEnabled,
      reminderText: typeof habit?.reminderText === 'string' ? habit.reminderText : '',
    };
  });
}

/**
 * Rebuilds the focus timer from a save. Anything malformed or missing falls
 * back to a fresh idle timer, and a session that was mid-run always comes back
 * paused — see the call site for why offline time is never credited.
 */
function restoreFocusTimer(raw: unknown): FocusTimer {
  if (!raw || typeof raw !== 'object') return idleFocusTimer();

  const saved = raw as Partial<FocusTimer>;
  const duration = Number(saved.durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) return idleFocusTimer();

  const credited = Number(saved.creditedSeconds);
  const storedRemaining = Number(saved.remainingSeconds);

  // While running, remaining was only ever derived from endsAt, so recompute
  // it against the clock rather than trusting the last written value.
  const remaining =
    saved.isRunning && typeof saved.endsAt === 'number'
      ? Math.max(0, Math.round((saved.endsAt - Date.now()) / 1000))
      : storedRemaining;

  return {
    durationSeconds: duration,
    remainingSeconds: Number.isFinite(remaining)
      ? Math.min(Math.max(0, remaining), duration)
      : duration,
    endsAt: null,
    isRunning: false,
    creditedSeconds: Number.isFinite(credited) ? Math.max(0, credited) : 0,
    // Older saves have no deepFocus key; a strict === true reads them as off.
    deepFocus: saved.deepFocus === true,
  };
}

/**
 * Brings popularity up to date with today, applying one decay step per calendar
 * day elapsed since it was last settled.
 *
 * Every read and every gain goes through this first, which is what makes decay
 * a function of *days elapsed* rather than of app opens: settling twice in the
 * same day is a no-op, and settling once after five days applies all five steps
 * at once. Settling before a gain also means a rep logged today is never eroded
 * by decay owed from yesterday.
 */
function settlePopularity(state: CafeState, todayKey: string): CafeState {
  const lastSettled = state.popularityLastDecayedDate;

  // First run (or a save from before popularity existed): adopt today as the
  // baseline rather than retroactively decaying from an unknown date.
  if (!lastSettled) {
    return { ...state, popularityLastDecayedDate: todayKey };
  }

  const days = daysBetweenDateKeys(lastSettled, todayKey);
  if (days <= 0) return state;

  return {
    ...state,
    popularity: decayPopularity(state.popularity, days),
    popularityLastDecayedDate: todayKey,
  };
}

/**
 * Brings the greenhouse up to date with today.
 *
 * Same shape and the same reason as `settlePopularity`: this has to stay
 * correct across app closes and missed days, so it is a pure function of *days
 * elapsed* rather than of how often the app is opened. Settling twice in one
 * day is a no-op; settling once after five days applies all five.
 *
 * Only absence is handled here. Growth and coins both happen at the moment you
 * water something, so there is nothing to accrue for a day nobody showed up —
 * which is the whole design.
 */
function settleGreenhouse(state: CafeState, todayKey: string): CafeState {
  const gh = state.greenhouse;

  // First run, or a save from before the greenhouse existed: adopt today as
  // the baseline rather than retroactively killing everything.
  if (!gh.lastSettledDate) {
    return { ...state, greenhouse: { ...gh, lastSettledDate: todayKey } };
  }

  const days = daysBetweenDateKeys(gh.lastSettledDate, todayKey);
  if (days <= 0) return state;

  // The misting reservoir spends a day per day to keep plants *alive*. It
  // never advances growth and never accrues yield, so a long weekend costs you
  // the progress and the income but not the plant.
  const covered = gh.misting ? Math.min(days, gh.reservoir) : 0;
  const dry = days - covered;

  const plants = gh.plants.map((plant) => {
    if (plant.dead || dry <= 0) return plant;
    const spec = getPlant(plant.species);
    if (!spec) return plant;

    const thirst = plant.thirst + dry;
    // Strictly greater: on the morning after a watering thirst is already 1,
    // and today is still savable. A plant dies for the days you *missed*, not
    // for the day you're currently standing in.
    return { ...plant, thirst, dead: thirst > spec.dieAfter };
  });

  return {
    ...state,
    greenhouse: {
      ...gh,
      plants,
      reservoir: gh.reservoir - covered,
      lastSettledDate: todayKey,
    },
  };
}

/**
 * Brings the café up to date with the wall clock: cats that finished their
 * drink go home, and the door opens for however many arrivals the elapsed time
 * bought.
 *
 * Measured in milliseconds rather than in date keys, unlike the two settles
 * above — the café fills on the spawn interval, which is minutes, not days.
 * Same contract otherwise: pure, idempotent within a tick, and safe to run
 * from whichever screen happens to be open.
 *
 * **Walk-outs are charged wherever you are.** They used to be charged only
 * while the café floor was the screen you were on, because at the old
 * forty-second windows the arithmetic had no bound of its own: walk-outs equal
 * arrivals forever, so an app left open drained about forty points an hour, and
 * popularity would have measured how much café you played rather than how much
 * life you did.
 *
 * Patience in hours supplies the bound the gate was standing in for. A café
 * holds `maxInside` cats and each takes half an afternoon to give up, so the
 * worst case is a few points an hour rather than forty — and a return from a
 * long absence charges for at most one caféful, because the catch-up sweeps
 * cats who came and went without ever landing in state. A week away therefore
 * costs exactly what a day away costs.
 *
 * That bound is what lets the charge land honestly. With hours on the clock,
 * losing a cat is never a reflex you missed; it is a day you didn't open the
 * app. Gating that on being at the counter would have meant the charge could
 * essentially never fire — you would have to be standing on the café screen at
 * the instant a three-hour window closed.
 */
function settleVisit(state: CafeState, now: number): CafeState {
  // Counted before the settle, because the settle is what removes them and a
  // swept customer leaves nothing behind to count. Same `now` to both, so the
  // two derivations cannot disagree about who left.
  const walkedOut = impatientCustomers(state.cafeVisit, now).length;

  const visit = settleCafeVisit(
    state.cafeVisit,
    now,
    state.popularity,
    state.ownedCats,
    state.catStats
  );
  // Identity is the signal that nothing happened — returning a new state object
  // here would re-render both canvases on every five-second tick.
  if (visit === state.cafeVisit) return state;
  if (!walkedOut) return { ...state, cafeVisit: visit };

  // Convention 2 says settle decay before a gain, and this deliberately
  // doesn't: it is a loss, and both decay and the walk-out loss are
  // multiplicative, so they commute — charging first and decaying later lands
  // on the same number. Reaching for `settlePopularity` here would drag a date
  // key into a settle that measures in milliseconds, for no arithmetic gain.
  return {
    ...state,
    cafeVisit: visit,
    popularity: popularityAfterWalkouts(state.popularity, walkedOut),
    catsWalkedOut: state.catsWalkedOut + walkedOut,
  };
}

/**
 * Whether today counts for the bloom bonus — the mechanic that is the whole
 * thesis of the app in one line: the garden pays more on days you did the
 * actual work.
 */
function isBloomDay(state: CafeState, todayKey: string): boolean {
  if (state.missionLastClaimedDate === todayKey) return true;
  const day = state.habitLogs[todayKey] ?? {};
  return state.habits.some((h) => (day[h.id] ?? 0) >= Math.max(1, h.timesPerDay));
}

/** Coins in, plus the level tick — shared by `addCoins` and harvesting. */
function creditCoins(
  state: CafeState,
  amount: number,
  todayKey: string
): CafeState {
  const withDay = ensureDailyStat(state.dailyStats, todayKey);
  const next = {
    ...state,
    coins: state.coins + amount,
    dailyStats: {
      ...withDay,
      [todayKey]: {
        ...withDay[todayKey],
        coinsEarned: withDay[todayKey].coinsEarned + amount,
      },
    },
  };

  if (next.coins >= next.level * 100) next.level += 1;
  return next;
}

/**
 * Pearls in, plus the day's tally and the player's rank XP — the counterpart
 * to `creditCoins`, and the only place any of the three moves.
 *
 * Every payout in the app that hands over pearls goes through here so the
 * rank ladder is structural rather than remembered: adding a new way to earn
 * pearls later can't quietly forget to feed it. `amount` may be negative (an
 * un-logged habit rep refunds itself), and each figure floors at zero rather
 * than going into the red.
 *
 * The one deliberate exception is claiming an achievement. An achievement pays
 * for work whose pearls were already credited — counting the reward too would
 * pay the ladder twice for the same days, and would put the total out of step
 * with the `dailyStats` tallies an older save is rebuilt from.
 */
function creditPearls(
  state: CafeState,
  amount: number,
  dateKey: string
): CafeState {
  const withDay = ensureDailyStat(state.dailyStats, dateKey);
  const day = withDay[dateKey];

  return {
    ...state,
    pearls: Math.max(0, state.pearls + amount),
    userXp: Math.max(0, state.userXp + amount),
    dailyStats: {
      ...withDay,
      [dateKey]: {
        ...day,
        pearlsEarned: Math.max(0, day.pearlsEarned + amount),
      },
    },
  };
}

function ensureDailyStat(
  stats: Record<string, DailyStat>,
  dateKey: string
): Record<string, DailyStat> {
  if (stats[dateKey]) return stats;

  return {
    ...stats,
    [dateKey]: {
      missionCheckedIn: false,
      reflected: false,
      coinsEarned: 0,
      drinksMade: 0,
      drinksServed: 0,
      pearlsEarned: 0,
    },
  };
}

type CafeContextType = {
  state: CafeState;
  isLoading: boolean;
  // days since the previous app open, computed once at load time; null if
  // this is the first time the app has ever been opened
  daysSinceLastOpen: number | null;
  // popularity lost to decay while the user was away, computed once at load
  // time; null when nothing meaningful was lost. Surfaced on the café screen
  // so the drop is legible rather than silent.
  popularityLostWhileAway: number | null;
  // current café quality multiplier, derived from owned decor and upgrades
  cafeMultiplier: number;
  updateState: (updates: Partial<CafeState>) => void;
  resetCafe: () => Promise<void>;
  setUserName: (name: string) => void;
  setGuideContext: (context: string) => void;
  setMission: (mission: string) => void;
  claimMissionPearlsForToday: (dateKey: string) => boolean;
  claimReflectionForToday: (dateKey: string, pearls: number) => boolean;
  // Files one WeeklyReview and pays WEEKLY_REVIEW_PEARLS, once per weekKey.
  claimWeeklyReview: (review: WeeklyReview) => boolean;
  setFocusDuration: (minutes: number) => void;
  startFocusTimer: () => void;
  pauseFocusTimer: () => void;
  resetFocusTimer: () => void;
  // Arms/disarms Deep Focus (2× pearls). Refused while the clock runs.
  setDeepFocus: (value: boolean) => void;
  // Advances the timer against the wall clock and pays out any whole minutes
  // that just completed. Returns true on the tick that finishes the session so
  // the screen can fire its one-off celebration.
  settleFocusTimer: () => boolean;
  addPearl: (amount?: number) => void;
  spendPearls: (amount: number) => boolean;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addPopularity: (amount: number) => void;
  addDrinkServed: (amount?: number) => void;
  addBoba: (type: 'classic' | 'matcha' | 'strawberry', amount?: number) => void;
  addCatToQueue: (cat: Omit<QueueCat, 'id' | 'joinedAt' | 'waitTime'>) => void;
  updateQueueWaitTimes: () => void;
  unlockItem: (itemId: string) => boolean;
  applyVisualUpgrade: (
    type: keyof CafeVisuals,
    styleValue: number,
    itemId?: string
  ) => void;
  addHabit: (habit: Omit<Habit, 'id' | 'color'>) => void;
  updateHabit: (
    habitId: string,
    updates: Partial<Omit<Habit, 'id' | 'color'>>
  ) => void;
  removeHabit: (habitId: string) => void;
  logHabitRep: (dateKey: string, habitId: string) => number;
  unlogHabitRep: (dateKey: string, habitId: string) => number;
  setPartialCountsAsDone: (value: boolean) => void;
  getHabitStreak: (habitId: string, dateKey?: string) => number;
  addTodo: (text: string) => void;
  toggleTodo: (todoId: string) => void;
  removeTodo: (todoId: string) => void;
  recordGuideShown: (id: string) => void;
  snoozeGuideMessages: (minutes: number) => void;
  muteGuideMessage: (id: string) => void;
  setFocusSessionActive: (active: boolean) => void;
  claimAchievement: (achievementId: string, pearlReward: number) => boolean;
  pullPrize: () => PullResult;
  // Takes the drink because bond XP is scored per cat against what it was
  // actually handed — the affinity multiplier can't be recovered afterwards.
  recordCatsServed: (catIds: string[], drink: DrinkId) => void;
  // Lets cats in and sends finished ones home. Driven by a tick in the
  // provider, so both canvases can just render whatever it produced.
  settleCafeVisitNow: () => void;
  // Hands a group their cups: they stop queueing, sit, and stay counted as
  // being in the café until they've drunk it and left.
  serveCustomers: (customerIds: string[]) => void;
  setRevealActive: (active: boolean) => void;
  buySeed: (speciesId: string) => boolean;
  plantSeed: (speciesId: string, slot: number) => PlantResult;
  // Waters every pot the can was swept over, and reports the total so the
  // screen can show one summary instead of one toast per plant.
  waterPlants: (
    plantIds: string[],
    dateKey?: string
  ) => { watered: number; earned: number; bloom: boolean };
  harvestPlant: (plantId: string) => number;
  clearHusk: (plantId: string, compost: boolean) => boolean;
};

const CafeContext = createContext<CafeContextType | null>(null);

export function CafeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CafeState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [daysSinceLastOpen, setDaysSinceLastOpen] = useState<number | null>(null);
  const [popularityLostWhileAway, setPopularityLostWhileAway] = useState<
    number | null
  >(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Writes stay off until the stored save has been read and applied. */
  const hasLoadedRef = useRef(false);

  /**
   * A mirror of the committed state, for actions that must decide something
   * and report it back to the caller in the same tick.
   *
   * Most actions here assign their outcome to a local inside the setState
   * updater and return it. That only works because React eagerly runs an
   * updater when the fiber has no other pending update — when one is already
   * queued it defers the updater to render time, and the action returns its
   * default instead of the real outcome. Reading the mirror keeps a decision
   * independent of when React chooses to run the updater.
   */
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Whether the café floor is the screen you are on, set by
   * `app/cafe/index.tsx` on mount and read by the five-second settle.
   *
   * A ref rather than a state field so it is neither persisted nor reset on
   * load — the reset would race a screen that mounted while AsyncStorage was
   * still reading — and so that walking into the room doesn't re-render two
   * canvases to say something no drawing depends on. See `settleVisit`.
   */

  useEffect(() => {
    const loadState = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        let merged = initialState;

        if (saved) {
          const parsed = JSON.parse(saved);
          merged = {
            ...initialState,
            ...parsed,
            visuals: {
              ...initialState.visuals,
              ...(parsed.visuals ?? {}),
            },
            upgrades: {
              ...initialState.upgrades,
              ...(parsed.upgrades ?? {}),
            },
            bobaInventory: {
              ...initialState.bobaInventory,
              ...(parsed.bobaInventory ?? {}),
            },
            guide: {
              ...initialState.guide,
              ...(parsed.guide ?? {}),
              lastSeenAt: {
                ...initialState.guide.lastSeenAt,
                ...(parsed.guide?.lastSeenAt ?? {}),
              },
            },
            preferences: {
              ...initialState.preferences,
              ...(parsed.preferences ?? {}),
            },
            // A session that was still running when the app closed comes back
            // paused, with the clock advanced to reflect real elapsed time but
            // nothing credited for it. Paying out time spent with the app shut
            // would let you earn boba by closing the app, which is exactly
            // backwards from what the timer is meant to reward.
            focusTimer: restoreFocusTimer(parsed.focusTimer),
            habits: migrateHabits(parsed.habits),
            habitLogs: migrateHabitLogs(parsed.habitLogs),
            dailyStats: parsed.dailyStats ?? {},
            // Saves from before the rank ladder existed rebuild their XP from
            // the per-day pearl tallies the app was already keeping, so a
            // routine kept for months doesn't arrive back at "New here". The
            // explicit `undefined` check matters: the spread above would
            // otherwise hand a missing key `initialState`'s zero and the
            // backfill would never run.
            userXp:
              typeof parsed.userXp === 'number'
                ? parsed.userXp
                : backfillUserXp(parsed.dailyStats ?? {}),
            todos: Array.isArray(parsed.todos) ? parsed.todos : [],
            // Saves from before the shelter existed have no collection. Seed
            // one from the starters plus whatever cats they'd bought in the
            // Market back when it sold them, so nobody's town loses a cat.
            ownedCats: Array.isArray(parsed.ownedCats)
              ? parsed.ownedCats
              : seedOwnedCats(parsed.unlockedItems ?? []),
            // Saves from before recipes were ownable open with the starter
            // menu, same as a fresh one. Filtered against the roster because a
            // save can outlive a recipe id, and an unknown id would sit in the
            // menu as a cup with no spec behind it.
            recipes: Array.isArray(parsed.recipes)
              ? (parsed.recipes as DrinkId[]).filter((id) => !!DRINKS[id])
              : [...STARTER_RECIPES],
            // Saves from before the greenhouse existed get a fresh one, free
            // starter seed included. The nested spread matters: a partial
            // greenhouse from a future rollback would otherwise arrive without
            // its seeds map and blow up on first read.
            greenhouse: {
              ...initialState.greenhouse,
              ...(parsed.greenhouse ?? {}),
              plants: Array.isArray(parsed.greenhouse?.plants)
                ? parsed.greenhouse.plants
                : [],
              seeds: {
                ...(parsed.greenhouse ? {} : initialState.greenhouse.seeds),
                ...(parsed.greenhouse?.seeds ?? {}),
              },
            },
            // Saves from before the café tracked its own room open empty and
            // fill on the first settle below. The nested spread is what keeps a
            // partial object from a rollback from arriving without `customers`.
            cafeVisit: {
              ...emptyCafeVisit(),
              ...(parsed.cafeVisit ?? {}),
              customers: Array.isArray(parsed.cafeVisit?.customers)
                ? parsed.cafeVisit.customers
                : [],
            },
            // never resume a "session in progress" flag across app restarts
            focusSessionActive: false,
            revealActive: false,
          };
        }

        // Rebuilt from `ownedCats` rather than trusted from the save, so a
        // collection seeded by `seedOwnedCats` — or any cat adopted before
        // this field existed — still gets a record to hang facts off.
        merged = {
          ...merged,
          catStats: backfillCatStats(merged.catStats, merged.ownedCats),
        };

        const todayKey = getTodayDateKey();
        const previousOpenDateKey = merged.guide.lastOpenedDate;
        setDaysSinceLastOpen(
          previousOpenDateKey ? daysBetweenDateKeys(previousOpenDateKey, todayKey) : null
        );

        // Settle decay owed since the last session, and hold on to how much was
        // lost so the café screen can surface it rather than silently showing a
        // lower number.
        const settled = settlePopularity(merged, todayKey);
        const lost = merged.popularity - settled.popularity;
        setPopularityLostWhileAway(lost >= 1 ? lost : null);

        // Thirst owed for days away is applied here too, so walking into the
        // greenhouse shows what actually happened rather than yesterday's
        // picture. Every gain path settles again before it writes.
        const grown = settleGreenhouse(settled, todayKey);

        // Fill the café for the time spent away, so opening it shows cats
        // already in line rather than an empty room that starts filling from
        // the moment you look at it. Popularity is read *after* its own settle,
        // since a neglected café should let people in more slowly.
        //
        // This is also where the walk-out charge usually lands: the cats billed
        // for are the ones who were still in the café when you last closed it
        // and have since run out of patience — at most a caféful, however long
        // you were gone.
        const opened = settleVisit(
          {
            ...grown,
            cafeVisit: pruneCustomers(
              grown.cafeVisit,
              grown.ownedCats,
              Date.now(),
              grown.catStats
            ),
          },
          Date.now()
        );

        // Spend the one-time moments this save already satisfies, once, without
        // showing them. `lastAcknowledgedLevel` is the same idea for the one
        // moment that repeats: a save that reached level 4 before the beat
        // existed shouldn't be told it just got there.
        //
        // A first launch has no history to catch up on, so it only flips the
        // flag — running the backfill there would be harmless today but would
        // silently eat any future moment that happens to be true at zero.
        const caughtUpGuide = opened.guide.caughtUp
          ? opened.guide
          : saved
          ? {
              ...opened.guide,
              caughtUp: true,
              lastAcknowledgedLevel: Math.max(opened.guide.lastAcknowledgedLevel, opened.level),
              seenMessageIds: Array.from(
                new Set([...opened.guide.seenMessageIds, ...catchUpSeenIds(opened)])
              ),
            }
          : { ...opened.guide, caughtUp: true };

        const next = {
          ...opened,
          guide: { ...caughtUpGuide, lastOpenedDate: todayKey },
        };

        setState(next);

        // Persist the settled value straight away rather than waiting for some
        // later action to commit. The decay itself is self-correcting either
        // way (it is a pure function of days since the anchor date), but
        // leaving the anchor stale means every reload re-reports the same
        // "while away" drop the user has already been shown.
        if (saved) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch (error) {
        console.error('Failed to load state:', error);
      } finally {
        // Only now is it safe to persist: anything committed before this point
        // was working against initialState.
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    };

    loadState();
  }, []);

  const saveState = useCallback((next: CafeState) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Failed to save state:', error);
      }
    }, 250);
  }, []);

  /**
   * Persistence is driven off the committed state rather than from inside
   * `commit`, and stays off until the initial load has landed.
   *
   * Saving from within the updater meant the snapshot was captured when React
   * *processed* the queue, not when the action was called. A commit made while
   * the load was still in flight would run against `initialState`, and its
   * write would land after the load had already restored the real save —
   * quietly wiping it. Reacting to `state` means a write always reflects what
   * was actually committed, and the guard drops the pre-load writes whose
   * contents the load is about to discard anyway.
   */
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveState(state);
  }, [state, saveState]);

  // Persisting is handled by the effect above, so this is purely a state
  // transition — no side effects inside the updater.
  const commit = useCallback((updater: (prev: CafeState) => CafeState) => {
    setState(updater);
  }, []);

  const updateState = useCallback(
    (updates: Partial<CafeState>) => {
      commit((prev) => ({ ...prev, ...updates }));
    },
    [commit]
  );

  const resetCafe = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setState({ ...initialState });
      setDaysSinceLastOpen(null);
      setPopularityLostWhileAway(null);
    } catch (error) {
      console.error('Failed to reset state:', error);
    }
  }, []);

  const setUserName = useCallback(
    (name: string) => {
      commit((prev) => ({ ...prev, userName: name.trim() }));
    },
    [commit]
  );

  const setGuideContext = useCallback(
    (context: string) => {
      commit((prev) => ({ ...prev, guideContext: context }));
    },
    [commit]
  );

  const setMission = useCallback(
    (mission: string) => {
      commit((prev) => ({ ...prev, mission }));
    },
    [commit]
  );

  const addPearl = useCallback(
    (amount = 1) => {
      const todayKey = getTodayDateKey();

      commit((prev) => creditPearls(prev, amount, todayKey));
    },
    [commit]
  );

  const spendPearls = useCallback(
    (amount: number) => {
      let success = false;
      commit((prev) => {
        if (prev.pearls < amount) return prev;
        success = true;
        return { ...prev, pearls: prev.pearls - amount };
      });
      return success;
    },
    [commit]
  );

  const addCoins = useCallback(
    (amount: number) => {
      const todayKey = getTodayDateKey();

      commit((prev) => creditCoins(prev, amount, todayKey));
    },
    [commit]
  );

  const spendCoins = useCallback(
    (amount: number) => {
      let success = false;
      commit((prev) => {
        if (prev.coins < amount) return prev;
        success = true;
        return { ...prev, coins: prev.coins - amount };
      });
      return success;
    },
    [commit]
  );

  /**
   * Adds popularity, scaling by the café quality multiplier.
   *
   * Callers pass the *base* amount from POPULARITY_GAINS; the multiplier is
   * applied here so there is one place it can be got wrong rather than one per
   * call site. Pass a negative amount to remove a gain.
   */
  const addPopularity = useCallback(
    (baseAmount: number) => {
      const todayKey = getTodayDateKey();

      commit((prev) => {
        const settled = settlePopularity(prev, todayKey);
        const gain = baseAmount * cafeQualityMultiplier(settled.unlockedItems);

        return {
          ...settled,
          popularity: clampPopularity(settled.popularity + gain),
        };
      });
    },
    [commit]
  );

  const addDrinkServed = useCallback(
    (amount = 1) => {
      const todayKey = getTodayDateKey();

      commit((prev) => {
        const settled = settlePopularity(prev, todayKey);
        const withDay = ensureDailyStat(settled.dailyStats, todayKey);

        // NOTE: the README specifies popularity for cats served *promptly*, but
        // wait time isn't tracked through this path yet, so every serve pays
        // out. Gate this on wait time once cats have a patience timer.
        const popularityGain =
          POPULARITY_GAINS.catServed *
          amount *
          cafeQualityMultiplier(settled.unlockedItems);

        return {
          ...settled,
          popularity: clampPopularity(settled.popularity + popularityGain),
          dailyStats: {
            ...withDay,
            [todayKey]: {
              ...withDay[todayKey],
              drinksServed: withDay[todayKey].drinksServed + amount,
            },
          },
        };
      });
    },
    [commit]
  );

  const addBoba = useCallback(
    (type: 'classic' | 'matcha' | 'strawberry', amount = 1) => {
      const todayKey = getTodayDateKey();

      commit((prev) => {
        const withDay = ensureDailyStat(prev.dailyStats, todayKey);
        return {
          ...prev,
          bobaInventory: {
            ...prev.bobaInventory,
            [type]: prev.bobaInventory[type] + amount,
          },
          dailyStats: {
            ...withDay,
            [todayKey]: {
              ...withDay[todayKey],
              drinksMade: withDay[todayKey].drinksMade + amount,
            },
          },
        };
      });
    },
    [commit]
  );

  const addCatToQueue = useCallback(
    (cat: Omit<QueueCat, 'id' | 'joinedAt' | 'waitTime'>) => {
      commit((prev) => ({
        ...prev,
        queue: [
          ...prev.queue,
          {
            ...cat,
            id: Date.now() + Math.floor(Math.random() * 1000),
            joinedAt: Date.now(),
            waitTime: 0,
          },
        ],
      }));
    },
    [commit]
  );

  const updateQueueWaitTimes = useCallback(() => {
    commit((prev) => ({
      ...prev,
      queue: prev.queue.map((cat) => ({
        ...cat,
        waitTime: Math.floor((Date.now() - cat.joinedAt) / 60000),
      })),
    }));
  }, [commit]);

  const unlockItem = useCallback(
    (itemId: string) => {
      let success = false;
      commit((prev) => {
        if (prev.unlockedItems.includes(itemId)) return prev;
        success = true;
        return {
          ...prev,
          unlockedItems: [...prev.unlockedItems, itemId],
        };
      });
      return success;
    },
    [commit]
  );

  const applyVisualUpgrade = useCallback(
    (type: keyof CafeVisuals, styleValue: number, itemId?: string) => {
      commit((prev) => ({
        ...prev,
        visuals: {
          ...prev.visuals,
          [type]: styleValue,
        },
        unlockedItems: itemId && !prev.unlockedItems.includes(itemId)
          ? [...prev.unlockedItems, itemId]
          : prev.unlockedItems,
      }));
    },
    [commit]
  );

  const claimMissionPearlsForToday = useCallback(
    (dateKey: string) => {
      let success = false;

      commit((prev) => {
        if (!prev.mission.trim()) return prev;
        if (prev.missionLastClaimedDate === dateKey) return prev;

        success = true;
        const credited = creditPearls(prev, 25, dateKey);

        return {
          ...credited,
          missionLastClaimedDate: dateKey,
          dailyStats: {
            ...credited.dailyStats,
            [dateKey]: {
              ...credited.dailyStats[dateKey],
              missionCheckedIn: true,
            },
          },
        };
      });

      return success;
    },
    [commit]
  );

  /**
   * Pays out the daily reflection exactly once per calendar day. The pearl
   * amount comes from the option the user picked, so the guard has to live
   * here rather than in the screen — otherwise a double tap pays twice.
   */
  const claimReflectionForToday = useCallback(
    (dateKey: string, pearls: number) => {
      let success = false;

      commit((prev) => {
        if (prev.reflectionLastClaimedDate === dateKey) return prev;

        success = true;
        const credited = creditPearls(prev, pearls, dateKey);

        return {
          ...credited,
          reflectionLastClaimedDate: dateKey,
          // creditPearls ran ensureDailyStat, so today's record exists.
          dailyStats: {
            ...credited.dailyStats,
            [dateKey]: {
              ...credited.dailyStats[dateKey],
              reflected: true,
            },
          },
        };
      });

      return success;
    },
    [commit]
  );

  /**
   * Closes a week. `weekKey` must come through `getWeekKey` — it is both the
   * filing key and the once-per-week guard. Pays through `creditPearls`
   * (convention 20) against today's date key, since the claim happens today
   * even when the week it closes started six days ago.
   */
  const claimWeeklyReview = useCallback(
    (review: WeeklyReview) => {
      let success = false;

      commit((prev) => {
        if (!review.rating) return prev;
        if (prev.weeklyReviews.some((r) => r.weekKey === review.weekKey)) {
          return prev;
        }

        success = true;
        const credited = creditPearls(
          prev,
          WEEKLY_REVIEW_PEARLS,
          getTodayDateKey()
        );

        return {
          ...credited,
          weeklyReviews: [
            ...credited.weeklyReviews,
            {
              weekKey: review.weekKey,
              rating: review.rating,
              highlight: review.highlight.trim(),
              intention: review.intention.trim(),
            },
          ],
        };
      });

      return success;
    },
    [commit]
  );

  const setFocusDuration = useCallback(
    (minutes: number) => {
      commit((prev) => {
        // Changing the length replaces the timer wholesale, so a running
        // session refuses it — otherwise a preset tap mid-block silently
        // destroys the session it was sitting next to. The UI dims the
        // presets too; this is the guard that makes the dimming honest.
        if (prev.focusTimer.isRunning) return prev;

        return {
          ...prev,
          focusSessionActive: false,
          focusTimer: idleFocusTimer(minutes, prev.focusTimer.deepFocus),
        };
      });
    },
    [commit]
  );

  const startFocusTimer = useCallback(() => {
    commit((prev) => {
      const timer = prev.focusTimer;
      if (timer.isRunning || timer.remainingSeconds <= 0) return prev;

      return {
        ...prev,
        focusSessionActive: true,
        focusTimer: {
          ...timer,
          isRunning: true,
          endsAt: Date.now() + timer.remainingSeconds * 1000,
        },
      };
    });
  }, [commit]);

  const pauseFocusTimer = useCallback(() => {
    commit((prev) => {
      const timer = prev.focusTimer;
      if (!timer.isRunning || timer.endsAt === null) return prev;

      return {
        ...prev,
        focusSessionActive: false,
        focusTimer: {
          ...timer,
          isRunning: false,
          endsAt: null,
          remainingSeconds: Math.max(
            0,
            Math.round((timer.endsAt - Date.now()) / 1000)
          ),
        },
      };
    });
  }, [commit]);

  const resetFocusTimer = useCallback(() => {
    commit((prev) => ({
      ...prev,
      focusSessionActive: false,
      focusTimer: idleFocusTimer(
        prev.focusTimer.durationSeconds / 60,
        prev.focusTimer.deepFocus
      ),
    }));
  }, [commit]);

  /**
   * Deep Focus doubles pearls, so it can't be flipped while the clock runs —
   * otherwise the winning move is to toggle it on just before each five-minute
   * boundary. Set it before you start; it locks in with the session.
   */
  const setDeepFocus = useCallback(
    (value: boolean) => {
      commit((prev) => {
        if (prev.focusTimer.isRunning) return prev;
        if (prev.focusTimer.deepFocus === value) return prev;

        return {
          ...prev,
          focusTimer: { ...prev.focusTimer, deepFocus: value },
        };
      });
    },
    [commit]
  );

  /**
   * One atomic step of the clock. Rewards are derived from total elapsed time
   * measured against creditedSeconds rather than incremented per tick, so a
   * missed or doubled interval can never over- or under-pay: whatever the gap,
   * the next settle pays exactly the minutes that actually elapsed.
   */
  const settleFocusTimer = useCallback(() => {
    let completed = false;

    commit((prev) => {
      const timer = prev.focusTimer;
      if (!timer.isRunning || timer.endsAt === null) return prev;

      const remaining = Math.max(
        0,
        Math.round((timer.endsAt - Date.now()) / 1000)
      );
      const elapsed = Math.min(
        timer.durationSeconds,
        timer.durationSeconds - remaining
      );

      const newBoba =
        Math.floor(elapsed / SECONDS_PER_BOBA) -
        Math.floor(timer.creditedSeconds / SECONDS_PER_BOBA);
      // Deep Focus doubles pearls and only pearls — boba is the café's supply
      // line and popularity is the café's standing, and neither gets better
      // because your phone was locked. The pearl is the reward for the work,
      // so it's the number the harder promise multiplies.
      const newPearls =
        (Math.floor(elapsed / SECONDS_PER_PEARL) -
          Math.floor(timer.creditedSeconds / SECONDS_PER_PEARL)) *
        (timer.deepFocus ? 2 : 1);

      const finished = remaining <= 0;
      completed = finished;

      const todayKey = getTodayDateKey();

      // Popularity used to be awarded per minute by the focus screen itself.
      // It rides along with the boba credit now so the whole payout for a tick
      // lands in one commit — and so decay is settled before the gain, which
      // is what keeps a minute earned today from being eroded by decay owed
      // from yesterday.
      const settled = settlePopularity(prev, todayKey);
      const popularityGain =
        newBoba *
        POPULARITY_GAINS.focusPerMinute *
        cafeQualityMultiplier(settled.unlockedItems);

      const credited = creditPearls(settled, newPearls, todayKey);

      return {
        ...credited,
        popularity: clampPopularity(credited.popularity + popularityGain),
        totalFocusMinutes: credited.totalFocusMinutes + newBoba,
        bobaInventory: {
          ...credited.bobaInventory,
          classic: credited.bobaInventory.classic + newBoba,
        },
        dailyStats: {
          ...credited.dailyStats,
          [todayKey]: {
            ...credited.dailyStats[todayKey],
            drinksMade: credited.dailyStats[todayKey].drinksMade + newBoba,
          },
        },
        focusSessionActive: !finished,
        focusTimer: finished
          ? idleFocusTimer(timer.durationSeconds / 60, timer.deepFocus)
          : { ...timer, remainingSeconds: remaining, creditedSeconds: elapsed },
      };
    });

    return completed;
  }, [commit]);

  const addHabit = useCallback(
    (habit: Omit<Habit, 'id' | 'color'>) => {
      commit((prev) => ({
        ...prev,
        habits: [
          ...prev.habits,
          {
            id: `habit-${Date.now()}`,
            color: HABIT_COLORS[prev.habits.length % HABIT_COLORS.length],
            ...habit,
          },
        ],
      }));
    },
    [commit]
  );

  const updateHabit = useCallback(
    (habitId: string, updates: Partial<Omit<Habit, 'id' | 'color'>>) => {
      commit((prev) => ({
        ...prev,
        habits: prev.habits.map((habit) =>
          habit.id === habitId ? { ...habit, ...updates } : habit
        ),
      }));
    },
    [commit]
  );

  const removeHabit = useCallback(
    (habitId: string) => {
      commit((prev) => {
        const nextLogs: HabitLogs = {};
        Object.entries(prev.habitLogs).forEach(([dateKey, day]) => {
          const { [habitId]: _removed, ...rest } = day;
          nextLogs[dateKey] = rest;
        });

        return {
          ...prev,
          habits: prev.habits.filter((habit) => habit.id !== habitId),
          habitLogs: nextLogs,
        };
      });
    },
    [commit]
  );

  const getHabitStreak = useCallback(
    (habitId: string, dateKey?: string) => {
      const habit = state.habits.find((entry) => entry.id === habitId);
      if (!habit) return 0;
      return computeHabitStreak(
        state.habitLogs,
        habitId,
        dateKey ?? getTodayDateKey(),
        habit.timesPerDay
      );
    },
    [state.habitLogs, state.habits]
  );

  /**
   * Logs one rep. Returns the pearls awarded, or 0 if the habit already hit
   * its daily cap — the cap is what stops repeated tapping from printing
   * pearls. The streak bonus is paid once, on the rep that completes the day.
   */
  const logHabitRep = useCallback(
    (dateKey: string, habitId: string) => {
      let awarded = 0;

      commit((prev) => {
        const habit = prev.habits.find((entry) => entry.id === habitId);
        if (!habit) return prev;

        const current = repsOn(prev.habitLogs, dateKey, habitId);
        if (current >= habit.timesPerDay) return prev;

        // Settle decay before crediting the gain, so a rep logged today is
        // never eaten by decay still owed from yesterday.
        const settled = settlePopularity(prev, getTodayDateKey());

        const nextReps = current + 1;
        const completesDay = nextReps >= habit.timesPerDay;

        // Prior streak is counted from the day *before* dateKey, since
        // dateKey isn't complete until this very rep lands.
        const priorStreak = completesDay
          ? computeHabitStreak(
              settled.habitLogs,
              habitId,
              getPreviousDateKey(dateKey),
              habit.timesPerDay
            )
          : 0;

        awarded =
          pearlsForRep(habit.tier, habit.timesPerDay, nextReps) + priorStreak;

        const popularityGain =
          popularityForRep(habit.tier, habit.timesPerDay) *
          cafeQualityMultiplier(settled.unlockedItems);

        const credited = creditPearls(settled, awarded, dateKey);

        return {
          ...credited,
          popularity: clampPopularity(credited.popularity + popularityGain),
          habitLogs: {
            ...credited.habitLogs,
            [dateKey]: { ...(credited.habitLogs[dateKey] ?? {}), [habitId]: nextReps },
          },
        };
      });

      return awarded;
    },
    [commit]
  );

  /**
   * Removes one rep and refunds exactly what that rep paid out, so
   * un-logging and re-logging nets zero.
   */
  const unlogHabitRep = useCallback(
    (dateKey: string, habitId: string) => {
      let refunded = 0;

      commit((prev) => {
        const habit = prev.habits.find((entry) => entry.id === habitId);
        if (!habit) return prev;

        const current = repsOn(prev.habitLogs, dateKey, habitId);
        if (current <= 0) return prev;

        const settled = settlePopularity(prev, getTodayDateKey());

        const wasComplete = current >= habit.timesPerDay;
        const priorStreak = wasComplete
          ? computeHabitStreak(
              settled.habitLogs,
              habitId,
              getPreviousDateKey(dateKey),
              habit.timesPerDay
            )
          : 0;

        // Refund exactly what this specific rep paid out, so removing and
        // re-adding a rep nets zero even on budget tiers with uneven splits.
        refunded =
          pearlsForRep(habit.tier, habit.timesPerDay, current) + priorStreak;

        // Popularity is reversed at the *current* multiplier. If the user
        // bought decor between logging and un-logging, the reversal is slightly
        // larger than the original gain — an acceptable drift, and not worth
        // persisting a per-rep multiplier to avoid.
        const popularityLoss =
          popularityForRep(habit.tier, habit.timesPerDay) *
          cafeQualityMultiplier(settled.unlockedItems);

        const nextDay = { ...(settled.habitLogs[dateKey] ?? {}) };
        if (current - 1 <= 0) {
          delete nextDay[habitId];
        } else {
          nextDay[habitId] = current - 1;
        }

        // Negative through the same helper the award went through, so the
        // rank XP a rep bought is handed back with the pearls rather than
        // being quietly kept.
        const credited = creditPearls(settled, -refunded, dateKey);

        return {
          ...credited,
          popularity: clampPopularity(credited.popularity - popularityLoss),
          habitLogs: { ...credited.habitLogs, [dateKey]: nextDay },
        };
      });

      return refunded;
    },
    [commit]
  );

  const setPartialCountsAsDone = useCallback(
    (value: boolean) => {
      commit((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, partialCountsAsDone: value },
      }));
    },
    [commit]
  );

  const addTodo = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      commit((prev) => ({
        ...prev,
        todos: [
          ...prev.todos,
          { id: `${Date.now()}`, text: text.trim(), done: false },
        ],
      }));
    },
    [commit]
  );

  // Pays TODO_PEARL_REWARD on the transition to done and refunds it on the
  // transition back, so toggling twice always nets zero — same shape as
  // logHabitRep/unlogHabitRep, just without a tier to look up.
  const toggleTodo = useCallback(
    (todoId: string) => {
      const todayKey = getTodayDateKey();

      commit((prev) => {
        const todo = prev.todos.find((entry) => entry.id === todoId);
        if (!todo) return prev;

        const nowDone = !todo.done;
        const credited = creditPearls(
          prev,
          nowDone ? TODO_PEARL_REWARD : -TODO_PEARL_REWARD,
          todayKey
        );

        return {
          ...credited,
          todos: credited.todos.map((entry) =>
            entry.id === todoId ? { ...entry, done: nowDone } : entry
          ),
        };
      });
    },
    [commit]
  );

  const removeTodo = useCallback(
    (todoId: string) => {
      commit((prev) => ({
        ...prev,
        todos: prev.todos.filter((todo) => todo.id !== todoId),
      }));
    },
    [commit]
  );

  const recordGuideShown = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        guide: {
          ...prev.guide,
          lastShownAt: Date.now(),
          lastSeenAt: { ...prev.guide.lastSeenAt, [id]: Date.now() },
          seenMessageIds: prev.guide.seenMessageIds.includes(id)
            ? prev.guide.seenMessageIds
            : [...prev.guide.seenMessageIds, id],
          lastAcknowledgedLevel:
            id === 'level-up' ? prev.level : prev.guide.lastAcknowledgedLevel,
        },
      }));
    },
    [commit]
  );

  const snoozeGuideMessages = useCallback(
    (minutes: number) => {
      const until = Date.now() + minutes * 60000;
      commit((prev) => ({ ...prev, guide: { ...prev.guide, snoozedUntil: until } }));
    },
    [commit]
  );

  const muteGuideMessage = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        guide: {
          ...prev.guide,
          mutedMessageIds: prev.guide.mutedMessageIds.includes(id)
            ? prev.guide.mutedMessageIds
            : [...prev.guide.mutedMessageIds, id],
        },
      }));
    },
    [commit]
  );

  const setFocusSessionActive = useCallback(
    (active: boolean) => {
      commit((prev) => ({ ...prev, focusSessionActive: active }));
    },
    [commit]
  );

  const claimAchievement = useCallback(
    (achievementId: string, pearlReward: number): boolean => {
      let claimed = false;
      commit((prev) => {
        if (prev.claimedAchievements.includes(achievementId)) return prev;
        claimed = true;
        // Deliberately not `creditPearls`: an achievement is a receipt for
        // work whose pearls — and whose rank XP — were paid when it was done.
        // See the note on that helper.
        return {
          ...prev,
          claimedAchievements: [...prev.claimedAchievements, achievementId],
          pearls: prev.pearls + pearlReward,
        };
      });
      return claimed;
    },
    [commit]
  );

  const setRevealActive = useCallback(
    (active: boolean) => {
      commit((prev) => ({ ...prev, revealActive: active }));
    },
    [commit]
  );

  /**
   * One turn of the crank: a cat or a recipe, decided by the draw.
   *
   * The draw happens here, against the mirror, rather than inside the updater.
   * The caller is waiting on this result to play a reveal, so it can't depend
   * on whether React ran the updater eagerly or deferred it — a deferred
   * updater would report "you can't afford this" for a pull that actually went
   * through, losing the reveal.
   */
  const pullPrize = useCallback((): PullResult => {
    const current = stateRef.current;

    const cost = pullCost(current.ownedCats.length, current.recipes.length);
    if (current.coins < cost) return { ok: false, reason: 'coins' };

    const prize = pickPrize(
      current.ownedCats,
      current.recipes,
      Math.random(),
      Math.random(),
      Math.random()
    );
    if (!prize) return { ok: false, reason: 'complete' };

    // A cat needs an almanac record the moment it arrives; a recipe carries no
    // per-entry state at all, which is the only place the two halves differ.
    const adoptedOn = getTodayDateKey();

    /** The half of the state this prize touches, off whatever base is given. */
    const grant = (base: CafeState): CafeState =>
      prize.kind === 'cat'
        ? {
            ...base,
            ownedCats: [...base.ownedCats, prize.cat.id],
            catStats: {
              ...base.catStats,
              [prize.cat.id]: emptyCatStat(adoptedOn),
            },
          }
        : { ...base, recipes: [...base.recipes, prize.drink.id] };

    const alreadyHas = (base: CafeState): boolean =>
      prize.kind === 'cat'
        ? base.ownedCats.includes(prize.cat.id)
        : base.recipes.includes(prize.drink.id);

    // Advance the mirror before committing so a second tap in the same frame
    // draws against the spend that's already in flight instead of stale coins.
    // The effect above resyncs it from the real state on the next render.
    stateRef.current = grant({ ...current, coins: current.coins - cost });

    // Spending and granting are one commit — composing spendCoins() with a
    // separate unlock would leave a window where the coins are gone and the
    // prize isn't in the collection yet. `prev` is the authority: the mirror
    // can lag, so re-check against it before charging anyone.
    commit((prev) => {
      // Priced off `prev`, not the `cost` computed above: the mirror can lag,
      // and since the price climbs with the collection, charging a stale one
      // would undercharge for a pull that landed after another.
      const prevCost = pullCost(prev.ownedCats.length, prev.recipes.length);
      if (prev.coins < prevCost || alreadyHas(prev)) return prev;
      return grant({ ...prev, coins: prev.coins - prevCost });
    });

    return { ok: true, prize };
  }, [commit]);

  /**
   * Tallies a round of cups against the cats that drank them.
   *
   * Takes the whole group in one commit rather than one call per cat: the café
   * serves a group at a time, and N separate updaters would each rebuild the
   * map off a `prev` that may not include the last one yet.
   *
   * The hour is read here rather than passed in because there is exactly one
   * moment being recorded — the serve — and letting the caller supply a clock
   * is how the tally ends up disagreeing with `dateKey`.
   *
   * `drink` is what the whole group was handed, which is also what makes this
   * the bond XP writer: affinity is per cat, so one cup across three cats can
   * pay three different amounts of XP — triple for the one that loves it,
   * nothing at all for the one that won't drink it.
   */
  const recordCatsServed = useCallback(
    (catIds: string[], drink: DrinkId) => {
      if (!catIds.length) return;

      const dateKey = getTodayDateKey();
      const part = dayPartAt(new Date().getHours());

      commit((prev) => {
        const catStats = { ...prev.catStats };

        for (const id of catIds) {
          // A cat with no record is one the café is drawing but the collection
          // has never seen. That shouldn't happen — the spawner picks from
          // ownedCats — so open a record rather than dropping the cup.
          const prior = catStats[id] ?? emptyCatStat(null);
          const spec = getCat(id);
          // No spec means a roster id this build doesn't have. Record the cup
          // — it was poured — but don't guess at an affinity for it.
          const xp = spec && DRINKS[drink] ? serveOutcome(spec, drink).xp : 0;

          catStats[id] = {
            ...prior,
            firstServedOn: prior.firstServedOn ?? dateKey,
            lastServedOn: dateKey,
            parts: { ...prior.parts, [part]: (prior.parts[part] ?? 0) + 1 },
            // `?? 0` rather than a bare add: a save written before bonds
            // existed has stats without the field, and `undefined + 3` is NaN
            // — which would persist and never recover.
            bondXp: (prior.bondXp ?? 0) + xp,
          };
        }

        return { ...prev, catStats };
      });
    },
    [commit]
  );

  /* ------------------------------- the café ------------------------------ */

  const settleCafeVisitNow = useCallback(() => {
    commit((prev) => settleVisit(prev, Date.now()));
  }, [commit]);

  /**
   * The café runs on a clock whichever screen you're on: the town map needs it
   * so the door indicator is honest and so cats leave for the café while you
   * watch, and the café screen needs it so the line grows while you stand
   * there. `settleVisit` returns `prev` untouched when nothing happened, so a
   * quiet tick costs one comparison and no render.
   */
  useEffect(() => {
    if (isLoading) return;
    const id = setInterval(settleCafeVisitNow, 5000);
    return () => clearInterval(id);
  }, [isLoading, settleCafeVisitNow]);

  const serveCustomers = useCallback(
    (customerIds: string[]) => {
      if (!customerIds.length) return;
      const now = Date.now();
      commit((prev) => {
        const visit = markServed(prev.cafeVisit, customerIds, now);
        return visit === prev.cafeVisit ? prev : { ...prev, cafeVisit: visit };
      });
    },
    [commit]
  );

  /* ---------------------------- the greenhouse --------------------------- */

  const buySeed = useCallback(
    (speciesId: string): boolean => {
      const spec = getPlant(speciesId);
      if (!spec) return false;

      // Answer from the mirror, not from inside the updater, for the same
      // reason `plantSeed` and `pullPrize` do: the caller flashes a message off
      // this result, and React only runs an updater eagerly while its queue is
      // empty. With anything else already queued the flag was still false when
      // we returned it, so a purchase that went through reported "not enough
      // coins" and charged for the seed anyway.
      const current = stateRef.current;
      if (current.level < spec.level || current.coins < spec.cost) return false;

      // Advance the mirror before committing so a second tap in the same frame
      // prices against the spend already in flight rather than stale coins.
      // The effect that owns stateRef resyncs it on the next render.
      stateRef.current = { ...current, coins: current.coins - spec.cost };

      commit((prev) => {
        // `prev` is the authority — the mirror can lag, and React may run this
        // updater more than once for a single commit.
        if (prev.level < spec.level || prev.coins < spec.cost) return prev;
        return {
          ...prev,
          coins: prev.coins - spec.cost,
          greenhouse: {
            ...prev.greenhouse,
            seeds: {
              ...prev.greenhouse.seeds,
              [speciesId]: (prev.greenhouse.seeds[speciesId] ?? 0) + 1,
            },
          },
        };
      });
      return true;
    },
    [commit]
  );

  const plantSeed = useCallback(
    (speciesId: string, slot: number): PlantResult => {
      const todayKey = getTodayDateKey();
      // Decided against the mirror rather than inside the updater, for the same
      // reason `pullPrize` does: the caller animates the result, so it can't
      // depend on whether React ran the updater eagerly or deferred it.
      const current = stateRef.current;
      const gh = current.greenhouse;

      if ((gh.seeds[speciesId] ?? 0) <= 0) return { ok: false, reason: 'seed' };
      if (gh.plants.some((p) => p.slot === slot)) {
        return { ok: false, reason: 'occupied' };
      }
      if (slot >= gh.benches * 4) return { ok: false, reason: 'locked' };

      const plant: Plant = {
        id: `plant-${Date.now()}-${slot}`,
        species: speciesId,
        slot,
        plantedOn: todayKey,
        // Compost from a dead plant hands you the first day of the next one.
        waterCount: gh.fertilizer > 0 ? 1 : 0,
        lastWateredDate: null,
        thirst: 0,
        dead: false,
        pendingCoins: 0,
      };

      commit((prev) => {
        const p = prev.greenhouse;
        // `prev` is the authority — the mirror can lag, and React may run this
        // updater more than once for a single commit.
        if ((p.seeds[speciesId] ?? 0) <= 0) return prev;
        if (p.plants.some((x) => x.slot === slot || x.id === plant.id)) return prev;

        return {
          ...prev,
          greenhouse: {
            ...p,
            plants: [...p.plants, { ...plant, waterCount: p.fertilizer > 0 ? 1 : 0 }],
            seeds: { ...p.seeds, [speciesId]: p.seeds[speciesId] - 1 },
            fertilizer: Math.max(0, p.fertilizer - 1),
          },
        };
      });

      return { ok: true, plant };
    },
    [commit]
  );

  /**
   * Waters every pot the can was swept over. Returns how many actually took
   * water and what they paid, so the screen can show one summary rather than
   * one toast per pot.
   */
  const waterPlants = useCallback(
    (plantIds: string[], dateKey?: string) => {
      const todayKey = dateKey ?? getTodayDateKey();
      const ids = new Set(plantIds);
      let watered = 0;
      let earned = 0;
      let bloomed = false;

      commit((prev) => {
        const settled = settleGreenhouse(prev, todayKey);
        const bloom = isBloomDay(settled, todayKey);
        watered = 0;
        earned = 0;

        const plants = settled.greenhouse.plants.map((plant) => {
          if (!ids.has(plant.id) || plant.dead) return plant;
          // One watering per plant per day. A second sweep is a no-op rather
          // than a way to farm a mature plant by dragging in circles.
          if (plant.lastWateredDate === todayKey) return plant;

          const spec = getPlant(plant.species);
          if (!spec) return plant;

          watered += 1;
          const waterCount = plant.waterCount + 1;

          // The watering that completes growth also pays — reaching maturity
          // should land as a payoff, not as one more empty day.
          const mature = growthStage(waterCount, spec.daysToMature) === 'mature';
          const gain = mature ? yieldForWatering(spec, bloom) : 0;
          earned += gain;

          // Capped so ignoring the harvest tap for a month doesn't compound,
          // while a single missed collection costs nothing.
          const cap = Math.round(spec.coinsPerDay * BLOOM_BONUS) * PENDING_CAP_DAYS;

          return {
            ...plant,
            waterCount,
            lastWateredDate: todayKey,
            thirst: 0,
            pendingCoins: Math.min(cap, plant.pendingCoins + gain),
          };
        });

        if (!watered) return settled;
        bloomed = bloom;

        return {
          ...settled,
          greenhouse: {
            ...settled.greenhouse,
            plants,
            // A visit tops the reservoir back up, one day at a time.
            reservoir: settled.greenhouse.misting
              ? Math.min(3, settled.greenhouse.reservoir + 1)
              : settled.greenhouse.reservoir,
          },
        };
      });

      return { watered, earned, bloom: bloomed };
    },
    [commit]
  );

  const harvestPlant = useCallback(
    (plantId: string): number => {
      const todayKey = getTodayDateKey();
      let collected = 0;

      commit((prev) => {
        const plant = prev.greenhouse.plants.find((p) => p.id === plantId);
        if (!plant || plant.pendingCoins <= 0) return prev;

        collected = plant.pendingCoins;
        // Emptying the pot and paying out are one commit; splitting them would
        // leave a window where the coins exist nowhere.
        const credited = creditCoins(prev, collected, todayKey);

        return {
          ...credited,
          greenhouse: {
            ...credited.greenhouse,
            plants: credited.greenhouse.plants.map((p) =>
              p.id === plantId ? { ...p, pendingCoins: 0 } : p
            ),
          },
        };
      });

      return collected;
    },
    [commit]
  );

  /**
   * Clears a husk. Composting returns a fertilizer instead of nothing, so a
   * dead plant hands you the first step of the next one rather than a hole —
   * permanent loss in a self-improvement app is a quit risk.
   */
  const clearHusk = useCallback(
    (plantId: string, compost: boolean): boolean => {
      let cleared = false;
      commit((prev) => {
        const plant = prev.greenhouse.plants.find((p) => p.id === plantId);
        if (!plant || !plant.dead) return prev;
        cleared = true;
        return {
          ...prev,
          greenhouse: {
            ...prev.greenhouse,
            plants: prev.greenhouse.plants.filter((p) => p.id !== plantId),
            fertilizer: prev.greenhouse.fertilizer + (compost ? 1 : 0),
          },
        };
      });
      return cleared;
    },
    [commit]
  );

  return (
    <CafeContext.Provider
      value={{
        state,
        isLoading,
        daysSinceLastOpen,
        popularityLostWhileAway,
        cafeMultiplier: cafeQualityMultiplier(state.unlockedItems),
        updateState,
        resetCafe,
        setUserName,
        setGuideContext,
        setMission,
        claimMissionPearlsForToday,
        claimReflectionForToday,
        claimWeeklyReview,
        setFocusDuration,
        setDeepFocus,
        startFocusTimer,
        pauseFocusTimer,
        resetFocusTimer,
        settleFocusTimer,
        addPearl,
        spendPearls,
        addCoins,
        spendCoins,
        addPopularity,
        addDrinkServed,
        addBoba,
        addCatToQueue,
        updateQueueWaitTimes,
        unlockItem,
        applyVisualUpgrade,
        addHabit,
        updateHabit,
        removeHabit,
        logHabitRep,
        unlogHabitRep,
        setPartialCountsAsDone,
        getHabitStreak,
        addTodo,
        toggleTodo,
        removeTodo,
        recordGuideShown,
        snoozeGuideMessages,
        muteGuideMessage,
        setFocusSessionActive,
        claimAchievement,
        pullPrize,
        recordCatsServed,
        settleCafeVisitNow,
        serveCustomers,
        setRevealActive,
        buySeed,
        plantSeed,
        waterPlants,
        harvestPlant,
        clearHusk,
      }}
    >
      {children}
    </CafeContext.Provider>
  );
}

export function useCafeState() {
  const context = useContext(CafeContext);
  if (!context) {
    throw new Error('useCafeState must be used inside a CafeProvider');
  }
  return context;
}