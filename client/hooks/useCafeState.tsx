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
import {
  cafeQualityMultiplier,
  clampPopularity,
  decayPopularity,
  popularityForRep,
  POPULARITY_GAINS,
} from '../constants/popularity';
import {
  adoptionCost,
  pickCat,
  seedOwnedCats,
  STARTER_CATS,
} from '../constants/gacha';
import type { CatSpec } from '../constants/catSprites';
import {
  getPlant,
  growthStage,
  yieldForWatering,
  BLOOM_BONUS,
  PENDING_CAP_DAYS,
} from '../constants/plants';

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

export interface DailyStat {
  missionCheckedIn: boolean;
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
}

export interface CafeState {
  userName: string;
  mission: string;
  missionLastClaimedDate: string | null;
  // the daily reflection pays out once per calendar day, same as the mission
  // check-in; this is the day it was last answered
  reflectionLastClaimedDate: string | null;
  pearls: number;
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
export type AdoptResult =
  | { ok: true; cat: CatSpec }
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

const idleFocusTimer = (minutes = DEFAULT_FOCUS_MINUTES): FocusTimer => ({
  durationSeconds: minutes * 60,
  remainingSeconds: minutes * 60,
  endsAt: null,
  isRunning: false,
  creditedSeconds: 0,
});

const initialState: CafeState = {
  userName: '',
  mission: '',
  missionLastClaimedDate: null,
  reflectionLastClaimedDate: null,
  pearls: 100,
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
  },
  focusSessionActive: false,
  focusTimer: idleFocusTimer(),
  claimedAchievements: [],
  ownedCats: [...STARTER_CATS],
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

function ensureDailyStat(
  stats: Record<string, DailyStat>,
  dateKey: string
): Record<string, DailyStat> {
  if (stats[dateKey]) return stats;

  return {
    ...stats,
    [dateKey]: {
      missionCheckedIn: false,
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
  setFocusDuration: (minutes: number) => void;
  startFocusTimer: () => void;
  pauseFocusTimer: () => void;
  resetFocusTimer: () => void;
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
  adoptCat: () => AdoptResult;
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
            todos: Array.isArray(parsed.todos) ? parsed.todos : [],
            // Saves from before the shelter existed have no collection. Seed
            // one from the starters plus whatever cats they'd bought in the
            // Market back when it sold them, so nobody's town loses a cat.
            ownedCats: Array.isArray(parsed.ownedCats)
              ? parsed.ownedCats
              : seedOwnedCats(parsed.unlockedItems ?? []),
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
            // never resume a "session in progress" flag across app restarts
            focusSessionActive: false,
            revealActive: false,
          };
        }

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

        const next = {
          ...grown,
          guide: { ...grown.guide, lastOpenedDate: todayKey },
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

      commit((prev) => {
        const withDay = ensureDailyStat(prev.dailyStats, todayKey);
        return {
          ...prev,
          pearls: prev.pearls + amount,
          dailyStats: {
            ...withDay,
            [todayKey]: {
              ...withDay[todayKey],
              pearlsEarned: withDay[todayKey].pearlsEarned + amount,
            },
          },
        };
      });
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

        const withDay = ensureDailyStat(prev.dailyStats, dateKey);
        success = true;

        return {
          ...prev,
          pearls: prev.pearls + 25,
          missionLastClaimedDate: dateKey,
          dailyStats: {
            ...withDay,
            [dateKey]: {
              ...withDay[dateKey],
              missionCheckedIn: true,
              pearlsEarned: withDay[dateKey].pearlsEarned + 25,
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

        const withDay = ensureDailyStat(prev.dailyStats, dateKey);
        success = true;

        return {
          ...prev,
          pearls: prev.pearls + pearls,
          reflectionLastClaimedDate: dateKey,
          dailyStats: {
            ...withDay,
            [dateKey]: {
              ...withDay[dateKey],
              pearlsEarned: withDay[dateKey].pearlsEarned + pearls,
            },
          },
        };
      });

      return success;
    },
    [commit]
  );

  const setFocusDuration = useCallback(
    (minutes: number) => {
      commit((prev) => ({
        ...prev,
        focusSessionActive: false,
        focusTimer: idleFocusTimer(minutes),
      }));
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
      focusTimer: idleFocusTimer(prev.focusTimer.durationSeconds / 60),
    }));
  }, [commit]);

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
      const newPearls =
        Math.floor(elapsed / SECONDS_PER_PEARL) -
        Math.floor(timer.creditedSeconds / SECONDS_PER_PEARL);

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

      const withDay = ensureDailyStat(settled.dailyStats, todayKey);

      return {
        ...settled,
        pearls: settled.pearls + newPearls,
        popularity: clampPopularity(settled.popularity + popularityGain),
        totalFocusMinutes: settled.totalFocusMinutes + newBoba,
        bobaInventory: {
          ...settled.bobaInventory,
          classic: settled.bobaInventory.classic + newBoba,
        },
        dailyStats: {
          ...withDay,
          [todayKey]: {
            ...withDay[todayKey],
            drinksMade: withDay[todayKey].drinksMade + newBoba,
            pearlsEarned: withDay[todayKey].pearlsEarned + newPearls,
          },
        },
        focusSessionActive: !finished,
        focusTimer: finished
          ? idleFocusTimer(timer.durationSeconds / 60)
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
        const withDay = ensureDailyStat(settled.dailyStats, dateKey);

        const popularityGain =
          popularityForRep(habit.tier, habit.timesPerDay) *
          cafeQualityMultiplier(settled.unlockedItems);

        return {
          ...settled,
          pearls: settled.pearls + awarded,
          popularity: clampPopularity(settled.popularity + popularityGain),
          habitLogs: {
            ...settled.habitLogs,
            [dateKey]: { ...(settled.habitLogs[dateKey] ?? {}), [habitId]: nextReps },
          },
          dailyStats: {
            ...withDay,
            [dateKey]: {
              ...withDay[dateKey],
              pearlsEarned: withDay[dateKey].pearlsEarned + awarded,
            },
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

        const withDay = ensureDailyStat(settled.dailyStats, dateKey);

        return {
          ...settled,
          pearls: Math.max(0, settled.pearls - refunded),
          popularity: clampPopularity(settled.popularity - popularityLoss),
          habitLogs: { ...settled.habitLogs, [dateKey]: nextDay },
          dailyStats: {
            ...withDay,
            [dateKey]: {
              ...withDay[dateKey],
              pearlsEarned: Math.max(0, withDay[dateKey].pearlsEarned - refunded),
            },
          },
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

  const toggleTodo = useCallback(
    (todoId: string) => {
      commit((prev) => ({
        ...prev,
        todos: prev.todos.map((todo) =>
          todo.id === todoId ? { ...todo, done: !todo.done } : todo
        ),
      }));
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

  const adoptCat = useCallback((): AdoptResult => {
    // The draw is decided here, against the mirror, rather than inside the
    // updater. The caller is waiting on this result to play a reveal, so it
    // can't depend on whether React ran the updater eagerly or deferred it —
    // a deferred updater would report "you can't afford this" for an adoption
    // that actually went through, losing the cat's reveal.
    const current = stateRef.current;

    const cost = adoptionCost(current.ownedCats.length);
    if (current.coins < cost) return { ok: false, reason: 'coins' };

    const cat = pickCat(current.ownedCats, Math.random(), Math.random());
    if (!cat) return { ok: false, reason: 'complete' };

    // Advance the mirror before committing so a second tap in the same frame
    // draws against the spend that's already in flight instead of stale coins.
    // The effect above resyncs it from the real state on the next render.
    stateRef.current = {
      ...current,
      coins: current.coins - cost,
      ownedCats: [...current.ownedCats, cat.id],
    };

    // Spending and granting are one commit — composing spendCoins() with a
    // separate unlock would leave a window where the coins are gone and the
    // cat isn't in the collection yet. `prev` is the authority: the mirror can
    // lag, so re-check against it before charging anyone.
    commit((prev) => {
      // Priced off `prev`, not the `cost` computed above: the mirror can lag,
      // and now that the price climbs with the collection, charging a stale
      // one would undercharge for an adoption that landed after another.
      const prevCost = adoptionCost(prev.ownedCats.length);
      if (prev.coins < prevCost || prev.ownedCats.includes(cat.id)) {
        return prev;
      }
      return {
        ...prev,
        coins: prev.coins - prevCost,
        ownedCats: [...prev.ownedCats, cat.id],
      };
    });

    return { ok: true, cat };
  }, [commit]);

  /* ---------------------------- the greenhouse --------------------------- */

  const buySeed = useCallback(
    (speciesId: string): boolean => {
      const spec = getPlant(speciesId);
      if (!spec) return false;

      let bought = false;
      commit((prev) => {
        if (prev.level < spec.level || prev.coins < spec.cost) return prev;
        bought = true;
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
      return bought;
    },
    [commit]
  );

  const plantSeed = useCallback(
    (speciesId: string, slot: number): PlantResult => {
      const todayKey = getTodayDateKey();
      // Decided against the mirror rather than inside the updater, for the same
      // reason `adoptCat` does: the caller animates the result, so it can't
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
        setFocusDuration,
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
        adoptCat,
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