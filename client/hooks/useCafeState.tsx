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
  popularity: number;
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
}

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
};

const CafeContext = createContext<CafeContextType | null>(null);

export function CafeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CafeState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [daysSinceLastOpen, setDaysSinceLastOpen] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            // never resume a "session in progress" flag across app restarts
            focusSessionActive: false,
          };
        }

        const todayKey = getTodayDateKey();
        const previousOpenDateKey = merged.guide.lastOpenedDate;
        setDaysSinceLastOpen(
          previousOpenDateKey ? daysBetweenDateKeys(previousOpenDateKey, todayKey) : null
        );

        setState({
          ...merged,
          guide: { ...merged.guide, lastOpenedDate: todayKey },
        });
      } catch (error) {
        console.error('Failed to load state:', error);
      } finally {
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

  const commit = useCallback(
    (updater: (prev: CafeState) => CafeState) => {
      setState((prev) => {
        const next = updater(prev);
        saveState(next);
        return next;
      });
    },
    [saveState]
  );

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

      commit((prev) => {
        const withDay = ensureDailyStat(prev.dailyStats, todayKey);
        const next = {
          ...prev,
          coins: prev.coins + amount,
          dailyStats: {
            ...withDay,
            [todayKey]: {
              ...withDay[todayKey],
              coinsEarned: withDay[todayKey].coinsEarned + amount,
            },
          },
        };

        if (next.coins >= next.level * 100) {
          next.level += 1;
        }

        return next;
      });
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

  const addPopularity = useCallback(
    (amount: number) => {
      commit((prev) => ({ ...prev, popularity: prev.popularity + amount }));
    },
    [commit]
  );

  const addDrinkServed = useCallback(
    (amount = 1) => {
      const todayKey = getTodayDateKey();

      commit((prev) => {
        const withDay = ensureDailyStat(prev.dailyStats, todayKey);
        return {
          ...prev,
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
      const withDay = ensureDailyStat(prev.dailyStats, todayKey);

      return {
        ...prev,
        pearls: prev.pearls + newPearls,
        totalFocusMinutes: prev.totalFocusMinutes + newBoba,
        bobaInventory: {
          ...prev.bobaInventory,
          classic: prev.bobaInventory.classic + newBoba,
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

        const nextReps = current + 1;
        const completesDay = nextReps >= habit.timesPerDay;

        // Prior streak is counted from the day *before* dateKey, since
        // dateKey isn't complete until this very rep lands.
        const priorStreak = completesDay
          ? computeHabitStreak(
              prev.habitLogs,
              habitId,
              getPreviousDateKey(dateKey),
              habit.timesPerDay
            )
          : 0;

        awarded =
          pearlsForRep(habit.tier, habit.timesPerDay, nextReps) + priorStreak;
        const withDay = ensureDailyStat(prev.dailyStats, dateKey);

        return {
          ...prev,
          pearls: prev.pearls + awarded,
          habitLogs: {
            ...prev.habitLogs,
            [dateKey]: { ...(prev.habitLogs[dateKey] ?? {}), [habitId]: nextReps },
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

        const wasComplete = current >= habit.timesPerDay;
        const priorStreak = wasComplete
          ? computeHabitStreak(
              prev.habitLogs,
              habitId,
              getPreviousDateKey(dateKey),
              habit.timesPerDay
            )
          : 0;

        // Refund exactly what this specific rep paid out, so removing and
        // re-adding a rep nets zero even on budget tiers with uneven splits.
        refunded =
          pearlsForRep(habit.tier, habit.timesPerDay, current) + priorStreak;

        const nextDay = { ...(prev.habitLogs[dateKey] ?? {}) };
        if (current - 1 <= 0) {
          delete nextDay[habitId];
        } else {
          nextDay[habitId] = current - 1;
        }

        const withDay = ensureDailyStat(prev.dailyStats, dateKey);

        return {
          ...prev,
          pearls: Math.max(0, prev.pearls - refunded),
          habitLogs: { ...prev.habitLogs, [dateKey]: nextDay },
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

  return (
    <CafeContext.Provider
      value={{
        state,
        isLoading,
        daysSinceLastOpen,
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