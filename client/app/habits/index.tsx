import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  TODO_PEARL_REWARD,
  WEEKLY_REVIEW_PEARLS,
  useCafeState,
} from '../../hooks/useCafeState';
import { getReflectionPromptForDate, SHOP_ITEMS } from '../../constants/cafeData';
import { getCat } from '../../constants/catSprites';
import FocusSection from '../../components/FocusSection';
import { getDateKey, getWeekKey } from '../../utils/date';
import {
  dailyPearlTotal,
  HABIT_TIERS,
  pearlsForRep,
  TIER_ORDER,
} from '../../constants/habitTiers';
import {
  PixelButton,
  PixelChip,
  PixelIcon,
  PixelPanel,
  PixelProgress,
  PixelText,
  PixelToast,
  usePixelMaterial,
} from '../../components/pixel';
import type { ToastValue } from '../../components/pixel';
import {
  ACCENTS,
  ACCENT_INKS,
  BEVEL_THIN,
  PIXEL_FONT,
  PIXEL_FONT_FILE,
  PX,
  PixelMaterial,
} from '../../constants/pixelTheme';
import { RANK_ACCENT, TOTAL_RANKS, rankProgress } from '../../constants/userRank';
import type { SectionIconKey } from '../../constants/pixelIcons';
import ACHIEVEMENTS, {
  ACHIEVEMENT_CATEGORIES,
  AchievementCategory,
  AchievementCheckState,
  CATEGORY_BY_ID,
} from '../../constants/achievements';
import {
  LIBRARY,
  principleForDate,
  sourceOf,
  type Principle,
} from '../../constants/library';

const SHOP_ITEM_IDS = new Set(SHOP_ITEMS.map((item) => item.id));

/** "+1 pearl" / "+3 pearls" — the payout is the point, so it reads as prose. */
const pearlLabel = (n: number) => `+${n} pearl${n === 1 ? '' : 's'}`;

/**
 * A tick, drawn rather than typed.
 *
 * The pixel face has no checkmark glyph, and the hub's rule is to draw the
 * mark instead of falling back to the system font mid-line. Each entry is one
 * 1-cell-wide column as `[top, height]` on a 7x6 grid: a short left arm
 * descending, a long right arm climbing out of it.
 */
const TICK: readonly (readonly [number, number])[] = [
  [2, 2],
  [3, 2],
  [4, 2],
  [3, 2],
  [2, 2],
  [1, 2],
  [0, 2],
];

function PixelTick({ color, unit = PX }: { color: string; unit?: number }) {
  return (
    <View style={{ flexDirection: 'row', height: unit * 6 }}>
      {TICK.map(([top, height], i) => (
        <View key={i} style={{ width: unit, height: unit * 6 }}>
          <View
            style={{
              marginTop: top * unit,
              height: height * unit,
              backgroundColor: color,
            }}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * One to-do, with its payout spelled out on the row.
 *
 * The row used to be a bare square, a label and a full-width Delete button,
 * and said nothing at all about the pearl it pays — the credit landed silently
 * in the top bar, which is easy to miss and impossible to attribute. Now the
 * reward is written before you tap, and the tap floats it up off the row, so
 * the payout is visible where the action happened instead of only in a total.
 */
function TodoRow({
  todo,
  material,
  onToggle,
  onRemove,
}: {
  todo: { id: string; text: string; done: boolean };
  material: PixelMaterial;
  onToggle: () => void;
  onRemove: () => void;
}) {
  // The float is always mounted and driven entirely by this value — at rest it
  // sits at 0, which is fully transparent. Mounting it on a `useState` instead
  // meant a dropped completion callback left a stray "+1" pinned to the row.
  const rise = useRef(new Animated.Value(0)).current;

  const handleToggle = () => {
    // Only the earning direction gets the flourish. Un-checking refunds the
    // pearl, and celebrating a refund would read as a second payout.
    if (!todo.done) {
      rise.setValue(0);
      Animated.timing(rise, {
        toValue: 1,
        duration: 700,
        // react-native-web has no native animated module, so asking for the
        // native driver only earns a warning and a JS fallback.
        useNativeDriver: false,
      }).start();
    }
    onToggle();
  };

  return (
    <View style={pixel.todoRow}>
      <PixelButton
        material={material}
        behind={material.face}
        onPress={handleToggle}
        contentStyle={[
          pixel.todoCheck,
          todo.done && { backgroundColor: ACCENTS.todo },
        ]}
      >
        {todo.done ? <PixelTick color={ACCENT_INKS.todo} /> : null}
      </PixelButton>

      <Pressable onPress={handleToggle} style={pixel.todoBody}>
        <PixelText
          size="small"
          color={todo.done ? material.inkDim : material.ink}
          style={todo.done ? pixel.todoTextDone : undefined}
        >
          {todo.text}
        </PixelText>
      </Pressable>

      <View style={pixel.todoReward}>
        {todo.done ? (
          <PixelChip
            material={material}
            tint={ACCENTS.todo}
            color={ACCENT_INKS.todo}
            label={pearlLabel(TODO_PEARL_REWARD)}
          />
        ) : (
          <PixelText size="small" color={material.inkDim}>
            {pearlLabel(TODO_PEARL_REWARD)}
          </PixelText>
        )}

        <Animated.View
          pointerEvents="none"
          style={[
            pixel.todoFloat,
            {
              // Snaps in, holds, then fades out on the way up.
              opacity: rise.interpolate({
                inputRange: [0, 0.01, 0.6, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: rise.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -PX * 11],
                  }),
                },
              ],
            },
          ]}
        >
          <PixelText size="label" color={ACCENT_INKS.todo}>
            +{TODO_PEARL_REWARD}
          </PixelText>
        </Animated.View>
      </View>

      <PixelButton
        material={material}
        behind={material.face}
        onPress={onRemove}
        contentStyle={pixel.todoDelete}
      >
        <PixelText size="small" color={material.inkDim}>
          x
        </PixelText>
      </PixelButton>
    </View>
  );
}

type HubSection =
  | 'hub'
  | 'habits'
  | 'mission'
  | 'reflection'
  | 'review'
  | 'focus'
  | 'calendar'
  | 'resources'
  | 'todo'
  | 'achievements';

/**
 * The weekly rating vocabulary. Ids are what `WeeklyReview.rating` stores, so
 * renaming a label is free but renaming an id orphans old reviews.
 */
const REVIEW_RATINGS = [
  { id: 'strong', label: 'Strong week 💪' },
  { id: 'steady', label: 'Steady week 🌤' },
  { id: 'rough', label: 'Rough week 🌧' },
  { id: 'lost', label: 'Lost the thread 🌀' },
] as const;

const RATING_LABELS: Record<string, string> = Object.fromEntries(
  REVIEW_RATINGS.map((r) => [r.id, r.label])
);

interface CalendarDay {
  date: number;
  dateKey: string;
  completedHabitIds: string[];
  isToday: boolean;
}

/**
 * The eight destinations, in grid order.
 *
 * A tile no longer carries its own pastel fill. Identity is the accent stripe
 * and the icon, over one shared material — eight fills at the same value read
 * as eight equally important things, which is exactly the flatness this
 * redesign is undoing. Adding a section now means choosing an accent, not
 * inventing another hue.
 *
 * Every key is both a `HubSection` and a `SectionIconKey`, so the icon and the
 * destination can never drift apart.
 */
const HUB_TILES: { key: SectionIconKey & HubSection; title: string; sub: string }[] = [
  { key: 'habits', title: 'Habits', sub: 'Build routines' },
  { key: 'mission', title: 'Mission', sub: 'Your direction' },
  { key: 'reflection', title: 'Reflection', sub: 'Close the day' },
  { key: 'review', title: 'Weekly Review', sub: 'Close the week' },
  { key: 'calendar', title: 'Calendar', sub: 'Track days' },
  { key: 'todo', title: 'To-Do', sub: 'Quick list' },
  { key: 'focus', title: 'Focus', sub: 'Start a session' },
  { key: 'achievements', title: 'Achievements', sub: 'Milestones' },
  // Keyed 'resources' still — the key is also the icon and accent name, and
  // the town's Library building already routes here. Only the face changed.
  { key: 'resources', title: 'Library', sub: 'Ideas that work' },
];

const SECTION_KEYS = new Set<string>(['hub', ...HUB_TILES.map((tile) => tile.key)]);

/**
 * The hub keeps its section in local state rather than in the route, so a link
 * to `/habits` always lands on the grid. A `?section=` param is how the guide
 * (and anything else outside this screen) points at one destination — "check
 * in with your mission" used to drop you a tap short of the mission.
 */
function toSection(value: string | string[] | undefined): HubSection {
  const key = Array.isArray(value) ? value[0] : value;
  return key && SECTION_KEYS.has(key) ? (key as HubSection) : 'hub';
}

export default function HabitsTab() {
  const router = useRouter();
  const {
    state,
    isLoading,
    setMission,
    claimMissionPearlsForToday,
    claimReflectionForToday,
    claimWeeklyReview,
    logHabitRep,
    unlogHabitRep,
    setPartialCountsAsDone,
    getHabitStreak,
    setGuideContext,
    addTodo,
    toggleTodo,
    removeTodo,
    claimAchievement,
  } = useCafeState();

  // Day/night runs off the same `isNightAt()` clock as the town and the cafe,
  // so walking in from the map at 8pm doesn't hand you a differently-lit room.
  const m = usePixelMaterial();

  // The pixel font is loaded here rather than in the root layout: `_layout.tsx`
  // is contended with the greenhouse work, and the hub is so far the only
  // screen that uses it. This moves up once the rest of the app converts.
  const [fontLoaded] = useFonts({ [PIXEL_FONT]: PIXEL_FONT_FILE });

  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<HubSection>(() => toSection(params.section));
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [missionDraft, setMissionDraft] = useState(state.mission);
  const [todoInput, setTodoInput] = useState('');

  // Weekly review draft — local until the claim commits it.
  const [reviewRating, setReviewRating] = useState<string | null>(null);
  const [reviewHighlight, setReviewHighlight] = useState('');
  const [reviewIntention, setReviewIntention] = useState('');

  // Payout feedback. Every confirmation here used to be an `Alert.alert`,
  // which react-native-web renders as nothing — so checking in, reflecting
  // and claiming achievements were all silent on the platform the app runs
  // on. The toast is the visible replacement.
  const [toast, setToast] = useState<ToastValue | null>(null);
  const showToast = useCallback((text: string, tint?: string) => {
    setToast({ id: Date.now(), text, tint });
  }, []);

  useEffect(() => {
    setGuideContext(`habits:${section}`);
  }, [section, setGuideContext]);

  // Re-navigating to `/habits?section=x` while the hub is already mounted only
  // changes the param, not the mounted component, so the initial state above
  // never re-runs.
  useEffect(() => {
    if (params.section) setSection(toSection(params.section));
  }, [params.section]);

  // missionDraft is seeded from state.mission before the persisted state has
  // finished loading from AsyncStorage. Sync it once loading completes so a
  // saved mission actually shows up in the textbox instead of appearing blank.
  useEffect(() => {
    if (!isLoading) {
      setMissionDraft(state.mission);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const today = new Date();
  const todayKey = getDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const calendarDays: (CalendarDay | null)[] = [];

  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = getDateKey(year, month, day);
    const dayLog = state.habitLogs[dateKey] ?? {};
    calendarDays.push({
      date: day,
      dateKey,
      completedHabitIds: Object.keys(dayLog).filter((id) => dayLog[id] > 0),
      isToday: dateKey === todayKey,
    });
  }

  const selectedDayData =
    selectedDateKey &&
    calendarDays.find((day) => day && day.dateKey === selectedDateKey);

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const todayLog = state.habitLogs[todayKey] ?? {};

  // A habit counts toward the day's ring either on any progress or only at
  // full cap, depending on the user's partial-credit preference.
  const doneToday = state.habits.filter((habit) => {
    const reps = todayLog[habit.id] ?? 0;
    return state.preferences.partialCountsAsDone
      ? reps > 0
      : reps >= habit.timesPerDay;
  }).length;

  const habitsByTier = useMemo(
    () =>
      TIER_ORDER.map((tierId) => ({
        tier: tierId,
        def: HABIT_TIERS[tierId],
        habits: state.habits.filter((habit) => habit.tier === tierId),
      })).filter((group) => group.habits.length > 0),
    [state.habits]
  );

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDateKey(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDateKey(null);
  };

  const hasPendingMissionEdit =
    !!missionDraft.trim() && missionDraft.trim() !== state.mission.trim();
  const missionCheckedInToday = state.missionLastClaimedDate === todayKey;
  const canCheckInMissionToday = !!state.mission.trim() && !missionCheckedInToday;

  const handleSaveMission = () => {
    if (!hasPendingMissionEdit) return;
    setMission(missionDraft.trim());
    showToast('Mission saved', ACCENTS.mission);
  };

  const handleMissionCheckIn = () => {
    if (!canCheckInMissionToday) return;
    // The button is disabled whenever this can't succeed, so a false return
    // (a double-tap racing the commit) just stays silent.
    if (!claimMissionPearlsForToday(todayKey)) return;

    showToast('Checked in · +25 pearls', ACCENTS.mission);
  };

  const handleLogRep = (habit: (typeof state.habits)[number]) => {
    const reps = todayLog[habit.id] ?? 0;
    if (reps >= habit.timesPerDay) return;

    const newCount = logHabitRep(todayKey, habit.id);
    // Mid-way reps speak through the dots filling in; the rep that completes
    // the day is the one worth saying out loud.
    if (newCount >= habit.timesPerDay) {
      showToast(`${habit.name || 'Habit'} done for today`, habit.color);
    }
  };

  const handleUnlogRep = (habit: (typeof state.habits)[number]) => {
    const reps = todayLog[habit.id] ?? 0;
    if (reps <= 0) return;
    unlogHabitRep(todayKey, habit.id);
  };

  const reflectionPrompt = getReflectionPromptForDate(todayKey);
  const reflectedToday = state.reflectionLastClaimedDate === todayKey;
  const weekClosed = state.weeklyReviews.some(
    (r) => r.weekKey === getWeekKey(todayKey)
  );

  const handleReflectionAnswer = (option: { pearls: number }) => {
    if (reflectedToday) return;
    if (!claimReflectionForToday(todayKey, option.pearls)) return;

    showToast(`Reflected · ${pearlLabel(option.pearls)}`, ACCENTS.reflection);
  };

  const habitTotal = state.habits.length;
  const habitsLeft = Math.max(0, habitTotal - doneToday);

  // The player's own standing. Deliberately the only number on this screen
  // that isn't about today — everything below it resets at midnight, and this
  // one only ever goes up.
  const rank = rankProgress(state.userXp);

  // The three things that can actually be finished today. Everything else in
  // the hub is a place; these are the day's open loops, which is why they get
  // to be rows rather than tiles — and why each one is still a way in.
  const todayRows: { key: SectionIconKey & HubSection; label: string; done: boolean }[] = [
    {
      key: 'habits',
      label:
        habitTotal === 0
          ? 'No habits yet'
          : habitsLeft === 0
            ? 'All habits done'
            : `${habitsLeft} habit${habitsLeft === 1 ? '' : 's'} left`,
      done: habitTotal > 0 && habitsLeft === 0,
    },
    {
      key: 'mission',
      label: !state.mission.trim()
        ? 'Write your mission'
        : missionCheckedInToday
          ? 'Checked in today'
          : 'Mission check-in ready',
      done: missionCheckedInToday,
    },
    {
      key: 'reflection',
      label: reflectedToday ? 'Reflected today' : 'Reflection waiting',
      done: reflectedToday,
    },
  ];

  const renderHub = () => (
    <>
      {/*
        Above the today strip, and above it on purpose. The strip answers
        "what's left today" and empties every midnight; this answers "how long
        have I kept this up", which is the thing the whole app is actually
        about. It is a title, not a level — `state.level` is the cafe's, and is
        what the greenhouse gates read — so this one wears a name and keeps its
        number small.
      */}
      <PixelPanel material={m} behind={m.bg} style={pixel.rank}>
        <View style={pixel.rankHead}>
          <PixelText size="small" color={m.inkDim}>
            {state.userName ? state.userName.toUpperCase() : 'YOU'}
          </PixelText>
          <PixelText size="small" color={m.inkDim}>
            {`${rank.rank} / ${TOTAL_RANKS}`}
          </PixelText>
        </View>

        <PixelText size="title" color={m.ink} style={pixel.rankTitle}>
          {rank.title}
        </PixelText>

        <PixelProgress
          value={rank.fraction}
          material={m}
          fill={RANK_ACCENT}
          style={pixel.rankBar}
        />

        {/*
          Said in pearls rather than in "XP". The rank is earned pearls and
          nothing else, so naming the currency explains the mechanic without a
          tutorial — and keeps the word XP free for a cat's bond, which is a
          different number entirely.
        */}
        <PixelText size="small" color={m.inkDim} plain>
          {rank.maxed
            ? `${state.userXp} pearls earned, all told.`
            : `${rank.remaining} more pearls to ${rank.nextTitle}`}
        </PixelText>
      </PixelPanel>

      {/*
        The today strip leads. The hub's first job is to answer "what is left
        today"; the hero card it replaces answered nothing and still took the
        top of the screen.
      */}
      <PixelPanel material={m} behind={m.bg} style={pixel.today}>
        <PixelText size="small" color={m.inkDim}>
          TODAY
        </PixelText>
        <PixelText size="title" color={m.ink} style={pixel.todayTitle}>
          {habitTotal === 0
            ? 'Nothing tracked yet'
            : `${doneToday} of ${habitTotal} habits done`}
        </PixelText>
        <PixelProgress
          value={habitTotal === 0 ? 0 : doneToday / habitTotal}
          material={m}
          fill={ACCENTS.habits}
          style={pixel.todayBar}
        />

        <View style={pixel.todayRows}>
          {todayRows.map((row) => (
            <PixelButton
              key={row.key}
              material={m}
              behind={m.face}
              dimmed={row.done}
              onPress={() => setSection(row.key)}
              contentStyle={pixel.todayRow}
            >
              <PixelIcon name={row.key} size={24} />
              <PixelText size="body" color={m.ink} style={pixel.todayRowLabel}>
                {row.label}
              </PixelText>
            </PixelButton>
          ))}
        </View>
      </PixelPanel>

      <View style={pixel.grid}>
        {HUB_TILES.map((tile) => {
          const spent =
            (tile.key === 'reflection' && reflectedToday) ||
            (tile.key === 'review' && weekClosed);
          return (
            <PixelButton
              key={tile.key}
              material={m}
              behind={m.bg}
              accent={ACCENTS[tile.key]}
              dimmed={spent}
              onPress={() => setSection(tile.key)}
              style={pixel.tile}
              contentStyle={pixel.tileFace}
            >
              <View style={pixel.tileInner}>
                <PixelIcon name={tile.key} size={36} style={pixel.tileIcon} />
                <PixelText size="label" color={m.ink}>
                  {tile.title}
                </PixelText>
                <PixelText size="small" color={m.inkDim} plain>
                  {spent
                    ? tile.key === 'review'
                      ? 'Closed this week'
                      : 'Done for today'
                    : tile.sub}
                </PixelText>
              </View>
            </PixelButton>
          );
        })}
      </View>
    </>
  );

  /**
   * A section's title block. A plain function rather than a component so it
   * can close over the material without remounting the whole section every
   * time the material object changes at dusk.
   */
  const sectionHead = (title: string, sub?: string) => (
    <View style={pixel.head}>
      <PixelText size="title" color={m.ink}>
        {title}
      </PixelText>
      {sub ? (
        <PixelText size="small" color={m.inkDim} plain style={pixel.headSub}>
          {sub}
        </PixelText>
      ) : null}
    </View>
  );

  const renderHabitTile = (
    habit: (typeof state.habits)[number],
    wide: boolean
  ) => {
    const reps = todayLog[habit.id] ?? 0;
    const cap = habit.timesPerDay;
    const full = reps >= cap;
    const streak = getHabitStreak(habit.id);

    return (
      <PixelButton
        key={habit.id}
        material={m}
        behind={m.bg}
        // The habit keeps its own colour, but only as the accent edge — filling
        // the whole tile with it, as the old one did, meant a logged habit and
        // an unlogged one differed by their entire surface, and a wall of them
        // read as confetti rather than as progress.
        accent={habit.color}
        dimmed={full}
        onPress={() => handleLogRep(habit)}
        onLongPress={() => router.push(`/habit-form?id=${habit.id}`)}
        delayLongPress={300}
        style={wide ? pixel.habitWide : pixel.habitHalf}
        contentStyle={pixel.habitFace}
      >
        <View style={pixel.habitInner}>
          <PixelText size="label" color={m.ink} numberOfLines={1}>
            {habit.name || 'Untitled'}
          </PixelText>

          <View style={pixel.habitBottom}>
            <View style={pixel.dots}>
              {Array.from({ length: cap }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    pixel.dot,
                    { backgroundColor: index < reps ? habit.color : m.track },
                  ]}
                />
              ))}
              {cap > 1 ? (
                <PixelText size="small" color={m.inkDim} style={pixel.dotCount}>
                  {reps}/{cap}
                </PixelText>
              ) : null}
            </View>

            <View style={pixel.habitMeta}>
              <PixelText size="small" color={m.inkDim}>
                {streak > 0
                  ? `${streak}d`
                  : `+${pearlsForRep(habit.tier, habit.timesPerDay, reps + 1)}`}
              </PixelText>
              {reps > 0 ? (
                // The take-one-back button — a mis-tap used to be permanent
                // because `unlogHabitRep` existed in state with no UI calling
                // it. Nested inside the tile's pressable; the inner one wins
                // the touch, so tapping the minus never also logs a rep.
                <Pressable
                  onPress={() => handleUnlogRep(habit)}
                  hitSlop={PX * 3}
                  accessibilityLabel={`Remove a ${habit.name} rep`}
                  style={[pixel.unlog, { backgroundColor: m.sunk }]}
                >
                  <PixelText size="small" color={m.inkDim}>
                    -
                  </PixelText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </PixelButton>
    );
  };

  const renderHabits = () => (
    <>
      {sectionHead('Habits', 'Tap a tile to log a rep. Hold to edit. The - takes one back.')}

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <View style={pixel.rowBetween}>
          <PixelText size="label" color={m.ink}>
            Today
          </PixelText>
          <PixelText size="small" color={m.inkDim}>
            {doneToday} of {state.habits.length} done
          </PixelText>
        </View>

        <PixelProgress
          value={state.habits.length ? doneToday / state.habits.length : 0}
          material={m}
          fill={ACCENTS.habits}
          style={pixel.cardBar}
        />

        <PixelButton
          material={m}
          behind={m.face}
          onPress={() => setPartialCountsAsDone(!state.preferences.partialCountsAsDone)}
          contentStyle={pixel.prefRow}
        >
          {/* A filled well rather than a tick glyph — the pixel font has no
              checkmark, and a drawn one at this size is four pixels of mush. */}
          <PixelPanel
            material={m}
            sunken
            inset
            bevel={BEVEL_THIN}
            style={pixel.checkBox}
          >
            {state.preferences.partialCountsAsDone ? (
              <View style={[pixel.checkFill, { backgroundColor: ACCENTS.habits }]} />
            ) : null}
          </PixelPanel>
          <PixelText size="small" color={m.ink} style={pixel.prefLabel}>
            Count partial progress as done
          </PixelText>
        </PixelButton>
      </PixelPanel>

      {state.habits.length === 0 && (
        <PixelPanel material={m} behind={m.bg} style={pixel.card}>
          <PixelText size="label" color={m.ink}>
            Start with one
          </PixelText>
          <PixelText size="small" color={m.inkDim} plain style={pixel.cardBody}>
            Pick the single habit that would change the most if you actually did it
            every day. You can add more later.
          </PixelText>
        </PixelPanel>
      )}

      {habitsByTier.map((group) => (
        <View key={group.tier} style={pixel.tierSection}>
          <View style={pixel.rowBetween}>
            <PixelText size="small" color={m.ink}>
              {group.def.label}
            </PixelText>
            <PixelText size="small" color={m.inkDim}>
              {group.def.pearls} pearls
              {group.def.rewardModel === 'budget' ? '/day' : ' each'}
            </PixelText>
          </View>

          <View style={pixel.habitGrid}>
            {group.habits.map((habit) =>
              renderHabitTile(habit, group.tier === 'keystone')
            )}
          </View>
        </View>
      ))}

      <PixelButton
        material={m}
        behind={m.bg}
        accent={ACCENTS.habits}
        onPress={() => router.push('/habit-form')}
        style={pixel.wideAction}
        contentStyle={pixel.wideActionFace}
      >
        <PixelText size="label" color={m.ink}>
          + New habit
        </PixelText>
      </PixelButton>
    </>
  );

  const renderMission = () => (
    <>
      {sectionHead('Mission', 'Come back here daily and check in with your direction.')}

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        {/* The input is a sunken well: text you type into should look like a
            hole in the surface, not another raised panel. */}
        <PixelPanel material={m} inset sunken bevel={BEVEL_THIN} style={pixel.inputWell}>
          <TextInput
            value={missionDraft}
            onChangeText={setMissionDraft}
            placeholder="Write your mission statement..."
            placeholderTextColor={m.inkDim}
            multiline
            numberOfLines={5}
            style={[pixel.input, { color: m.ink }]}
          />
        </PixelPanel>

        <PixelButton
          material={m}
          behind={m.face}
          accent={ACCENTS.mission}
          onPress={handleSaveMission}
          disabled={!hasPendingMissionEdit}
          dimmed={!hasPendingMissionEdit}
          style={pixel.wideAction}
          contentStyle={pixel.wideActionFace}
        >
          <PixelText size="label" color={m.ink}>
            Save Mission
          </PixelText>
        </PixelButton>

        <PixelButton
          material={m}
          behind={m.face}
          onPress={handleMissionCheckIn}
          disabled={!canCheckInMissionToday}
          dimmed={!canCheckInMissionToday}
          style={pixel.wideActionLast}
          contentStyle={pixel.wideActionFace}
        >
          <PixelText size="label" color={m.ink}>
            {missionCheckedInToday
              ? 'Already checked in today'
              : 'Daily Check-In (+25 pearls)'}
          </PixelText>
        </PixelButton>
      </PixelPanel>
    </>
  );

  const renderReflection = () => (
    <>
      {sectionHead(
        'Daily Reflection',
        'One honest question a day. It changes every morning, and answering pays out once.'
      )}

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <PixelText size="label" color={m.ink} style={pixel.question}>
          {reflectionPrompt.question}
        </PixelText>

        <View style={pixel.optionList}>
          {reflectionPrompt.options.map((option) => (
            <PixelButton
              key={option.id}
              material={m}
              behind={m.face}
              onPress={() => handleReflectionAnswer(option)}
              disabled={reflectedToday}
              dimmed={reflectedToday}
              contentStyle={pixel.option}
            >
              <PixelText size="small" color={m.ink} style={pixel.optionLabel}>
                {option.label}
              </PixelText>
              <PixelText size="small" color={m.inkDim}>
                +{option.pearls}
              </PixelText>
            </PixelButton>
          ))}
        </View>

        <PixelText size="small" color={m.inkDim} plain style={pixel.cardBody}>
          {reflectedToday
            ? 'Already reflected today — a new question lands tomorrow.'
            : 'Every answer pays the same. Pick the true one.'}
        </PixelText>
      </PixelPanel>
    </>
  );

  const renderReview = () => {
    const weekKey = getWeekKey(todayKey);
    const thisWeek = state.weeklyReviews.find((r) => r.weekKey === weekKey);
    const history = [...state.weeklyReviews]
      .filter((r) => r.weekKey !== weekKey)
      .reverse()
      .slice(0, 8);

    const handleClaimReview = () => {
      if (!reviewRating) return;
      const success = claimWeeklyReview({
        weekKey,
        rating: reviewRating,
        highlight: reviewHighlight,
        intention: reviewIntention,
      });
      if (!success) return;

      showToast(`Week closed · +${WEEKLY_REVIEW_PEARLS} pearls`, ACCENTS.review);
      setReviewRating(null);
      setReviewHighlight('');
      setReviewIntention('');
    };

    const reviewEntry = (review: (typeof state.weeklyReviews)[number]) => (
      <PixelPanel
        key={review.weekKey}
        material={m}
        inset
        bevel={BEVEL_THIN}
        style={pixel.reviewEntry}
      >
        <View style={pixel.rowBetween}>
          <PixelText size="small" color={m.ink}>
            Week of {review.weekKey}
          </PixelText>
          <PixelText size="small" color={m.inkDim}>
            {RATING_LABELS[review.rating] ?? review.rating}
          </PixelText>
        </View>
        {review.highlight ? (
          <PixelText size="small" color={m.inkDim} plain style={pixel.reviewLine}>
            Kept: {review.highlight}
          </PixelText>
        ) : null}
        {review.intention ? (
          <PixelText size="small" color={m.inkDim} plain style={pixel.reviewLine}>
            Next: {review.intention}
          </PixelText>
        ) : null}
      </PixelPanel>
    );

    return (
      <>
        {sectionHead(
          'Weekly Review',
          'Once a week, look back on purpose. The daily reflection closes a day; this closes the arc.'
        )}

        {thisWeek ? (
          <PixelPanel material={m} behind={m.bg} style={pixel.card}>
            <PixelText size="label" color={m.ink}>
              This week is closed
            </PixelText>
            <PixelText size="small" color={m.inkDim} plain style={pixel.cardBody}>
              You called it: {RATING_LABELS[thisWeek.rating] ?? thisWeek.rating}.
              A fresh review opens on Monday.
            </PixelText>
            {reviewEntry(thisWeek)}
          </PixelPanel>
        ) : (
          <PixelPanel material={m} behind={m.bg} style={pixel.card}>
            <PixelText size="label" color={m.ink}>
              How was the week?
            </PixelText>

            <View style={pixel.ratingGrid}>
              {REVIEW_RATINGS.map((option) => (
                <PixelButton
                  key={option.id}
                  material={m}
                  behind={m.face}
                  accent={reviewRating === option.id ? ACCENTS.review : undefined}
                  dimmed={reviewRating !== null && reviewRating !== option.id}
                  onPress={() => setReviewRating(option.id)}
                  style={pixel.ratingTile}
                  contentStyle={pixel.ratingFace}
                >
                  <PixelText size="small" color={m.ink}>
                    {option.label}
                  </PixelText>
                </PixelButton>
              ))}
            </View>

            <PixelText size="small" color={m.inkDim} style={pixel.listHead}>
              One thing worth keeping
            </PixelText>
            <PixelPanel material={m} inset sunken bevel={BEVEL_THIN} style={pixel.inputWell}>
              <TextInput
                value={reviewHighlight}
                onChangeText={setReviewHighlight}
                placeholder="What actually worked this week?"
                placeholderTextColor={m.inkDim}
                style={[pixel.input, { color: m.ink }]}
              />
            </PixelPanel>

            <PixelText size="small" color={m.inkDim} style={pixel.listHead}>
              One intention for next week
            </PixelText>
            <PixelPanel material={m} inset sunken bevel={BEVEL_THIN} style={pixel.inputWell}>
              <TextInput
                value={reviewIntention}
                onChangeText={setReviewIntention}
                placeholder="What gets more of you next week?"
                placeholderTextColor={m.inkDim}
                style={[pixel.input, { color: m.ink }]}
              />
            </PixelPanel>

            <PixelButton
              material={m}
              behind={m.face}
              accent={ACCENTS.review}
              onPress={handleClaimReview}
              disabled={!reviewRating}
              dimmed={!reviewRating}
              style={pixel.wideAction}
              contentStyle={pixel.wideActionFace}
            >
              <PixelText size="label" color={m.ink}>
                Close the week (+{WEEKLY_REVIEW_PEARLS} pearls)
              </PixelText>
            </PixelButton>

            <PixelText size="small" color={m.inkDim} plain style={pixel.cardBody}>
              The rating is the only required part. The two lines are for
              future-you, who reads this list more often than you'd think.
            </PixelText>
          </PixelPanel>
        )}

        {history.length > 0 && (
          <PixelPanel material={m} behind={m.bg} style={pixel.card}>
            <PixelText size="label" color={m.ink}>
              Past weeks
            </PixelText>
            {history.map(reviewEntry)}
          </PixelPanel>
        )}
      </>
    );
  };

  const renderCalendarStat = (label: string, value: string | number) => (
    <PixelPanel material={m} inset sunken bevel={BEVEL_THIN} style={pixel.statCell}>
      <PixelText size="small" color={m.inkDim}>
        {label}
      </PixelText>
      <PixelText size="title" color={m.ink}>
        {value}
      </PixelText>
    </PixelPanel>
  );

  const renderCalendar = () => (
    <>
      <View style={pixel.monthBar}>
        {/* ASCII chevrons, not arrow glyphs: the pixel face covers Latin and
            punctuation, and a missing glyph falls back to the system font
            mid-line, which is more obvious than a plainer arrow. */}
        <PixelButton
          material={m}
          behind={m.bg}
          onPress={handlePrevMonth}
          contentStyle={pixel.monthArrow}
        >
          <PixelText size="label" color={m.ink}>
            {'<'}
          </PixelText>
        </PixelButton>

        <PixelText size="title" color={m.ink}>
          {monthName}
        </PixelText>

        <PixelButton
          material={m}
          behind={m.bg}
          onPress={handleNextMonth}
          contentStyle={pixel.monthArrow}
        >
          <PixelText size="label" color={m.ink}>
            {'>'}
          </PixelText>
        </PixelButton>
      </View>

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <View style={pixel.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <PixelText
              key={`${day}-${index}`}
              size="small"
              color={m.inkDim}
              style={pixel.weekday}
            >
              {day}
            </PixelText>
          ))}
        </View>

        <View style={pixel.daysGrid}>
          {calendarDays.map((day, index) => {
            const selected = !!day && selectedDateKey === day.dateKey;
            const logged = !!day && day.completedHabitIds.length > 0;
            // Days that haven't happened have no stats to drill into —
            // date keys compare lexicographically, so > is "after today".
            const future = !!day && day.dateKey > todayKey;
            return (
              <Pressable
                key={index}
                disabled={future}
                onPress={() => day && setSelectedDateKey(day.dateKey)}
                style={[pixel.dayCell, future && { opacity: 0.35 }]}
              >
                {day ? (
                  <View
                    style={[
                      pixel.dayFace,
                      {
                        backgroundColor: selected
                          ? ACCENTS.calendar
                          : logged
                            ? m.face
                            : m.sunk,
                      },
                      // Today is marked by an edge, not a fill, so it survives
                      // being selected and being logged at the same time.
                      day.isToday && { borderWidth: PX, borderColor: m.ink },
                    ]}
                  >
                    <PixelText size="small" color={selected ? m.faceLt : m.ink}>
                      {day.date}
                    </PixelText>
                    {logged ? (
                      <View
                        style={[
                          pixel.dayBar,
                          { backgroundColor: selected ? m.faceLt : ACCENTS.calendar },
                        ]}
                      />
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </PixelPanel>

      {selectedDayData && (
        <PixelPanel material={m} behind={m.bg} style={pixel.card}>
          <PixelText size="label" color={m.ink} style={pixel.question}>
            {selectedDayData.dateKey}
          </PixelText>

          <View style={pixel.statGrid}>
            {renderCalendarStat('Habits', selectedDayData.completedHabitIds.length)}
            {renderCalendarStat(
              'Mission',
              state.dailyStats[selectedDayData.dateKey]?.missionCheckedIn ? 'Yes' : 'No'
            )}
            {renderCalendarStat(
              'Coins',
              state.dailyStats[selectedDayData.dateKey]?.coinsEarned ?? 0
            )}
            {/* Replaced the boba-brewed count ("Made") — this calendar is the
                Growth Hub's history, and whether you reflected is a habit
                fact; how many cups the café brewed is café trivia. */}
            {renderCalendarStat(
              'Reflected',
              state.dailyStats[selectedDayData.dateKey]?.reflected ? 'Yes' : 'No'
            )}
            {renderCalendarStat(
              'Served',
              state.dailyStats[selectedDayData.dateKey]?.drinksServed ?? 0
            )}
            {renderCalendarStat(
              'Pearls',
              state.dailyStats[selectedDayData.dateKey]?.pearlsEarned ?? 0
            )}
          </View>

          <PixelText size="small" color={m.inkDim} style={pixel.listHead}>
            Completed habits that day
          </PixelText>

          {state.habits
            .filter((habit) => selectedDayData.completedHabitIds.includes(habit.id))
            .map((habit) => {
              const reps =
                state.habitLogs[selectedDayData.dateKey]?.[habit.id] ?? 0;
              return (
                <PixelPanel
                  key={habit.id}
                  material={m}
                  inset
                  sunken
                  bevel={BEVEL_THIN}
                  style={pixel.listRow}
                >
                  <PixelText size="small" color={m.ink} style={pixel.optionLabel}>
                    {habit.name}
                  </PixelText>
                  <PixelText size="small" color={m.inkDim}>
                    {reps}/{habit.timesPerDay} · {HABIT_TIERS[habit.tier].label}
                  </PixelText>
                </PixelPanel>
              );
            })}
        </PixelPanel>
      )}
    </>
  );

  const renderTodo = () => {
    const doneCount = state.todos.filter((todo) => todo.done).length;
    const total = state.todos.length;

    return (
    <>
      {sectionHead(
        'To-Do List',
        'A soft place for quick tasks that do not need to become full habits.'
      )}

      {total > 0 ? (
        <PixelPanel material={m} behind={m.bg} style={pixel.card}>
          <View style={pixel.rowBetween}>
            <PixelText size="label" color={m.ink}>
              {doneCount} of {total} done
            </PixelText>
            <PixelChip
              material={m}
              tint={doneCount > 0 ? ACCENTS.todo : undefined}
              color={doneCount > 0 ? ACCENT_INKS.todo : m.inkDim}
              label={pearlLabel(doneCount * TODO_PEARL_REWARD)}
            />
          </View>

          <PixelProgress
            value={total === 0 ? 0 : doneCount / total}
            material={m}
            fill={ACCENTS.todo}
            style={pixel.todoProgress}
          />
        </PixelPanel>
      ) : null}

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <View style={pixel.composer}>
          <PixelPanel
            material={m}
            inset
            sunken
            bevel={BEVEL_THIN}
            style={pixel.composerWell}
          >
            <TextInput
              value={todoInput}
              onChangeText={setTodoInput}
              placeholder="Add a to-do..."
              placeholderTextColor={m.inkDim}
              onSubmitEditing={() => {
                addTodo(todoInput);
                setTodoInput('');
              }}
              style={[pixel.inputLine, { color: m.ink }]}
            />
          </PixelPanel>

          <PixelButton
            material={m}
            behind={m.face}
            accent={ACCENTS.todo}
            onPress={() => {
              addTodo(todoInput);
              setTodoInput('');
            }}
            contentStyle={pixel.addButton}
          >
            <PixelText size="label" color={m.ink}>
              Add
            </PixelText>
          </PixelButton>
        </View>

        {state.todos.length === 0 ? (
          <PixelText size="small" color={m.inkDim} plain style={pixel.todoEmpty}>
            Nothing on the list. Add a task above — each one you check off pays{' '}
            {TODO_PEARL_REWARD} pearl.
          </PixelText>
        ) : (
          state.todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              material={m}
              onToggle={() => toggleTodo(todo.id)}
              onRemove={() => removeTodo(todo.id)}
            />
          ))
        )}
      </PixelPanel>
    </>
    );
  };

  const achievementCheckState = useMemo((): AchievementCheckState => {
    const stats = state.dailyStats;
    let totalDrinksServed = 0;
    let totalCoinsEarned = 0;
    let totalPearlsEarned = 0;
    let totalReflections = 0;
    let totalMissionCheckIns = 0;

    Object.values(stats).forEach((day) => {
      totalDrinksServed += day.drinksServed ?? 0;
      totalCoinsEarned += day.coinsEarned ?? 0;
      totalPearlsEarned += day.pearlsEarned ?? 0;
      if (day.missionCheckedIn) totalMissionCheckIns++;
      if (day.reflected) totalReflections++;
    });

    // Day records written before `reflected` existed can't be counted, but a
    // save with a claim date on file has reflected at least once.
    if (state.reflectionLastClaimedDate && totalReflections === 0) totalReflections = 1;

    let longestStreak = 0;
    let habitsWithStreak3 = 0;
    let habitsWithStreak7 = 0;
    let habitsWithStreak14 = 0;
    let habitsWithStreak30 = 0;

    state.habits.forEach((habit) => {
      const streak = getHabitStreak(habit.id);
      if (streak > longestStreak) longestStreak = streak;
      if (streak >= 3) habitsWithStreak3++;
      if (streak >= 7) habitsWithStreak7++;
      if (streak >= 14) habitsWithStreak14++;
      if (streak >= 30) habitsWithStreak30++;
    });

    return {
      totalHabits: state.habits.length,
      totalFocusMinutes: state.totalFocusMinutes,
      totalDrinksServed,
      totalCoinsEarned,
      coins: state.coins,
      pearls: state.pearls,
      level: state.level,
      popularity: state.popularity,
      unlockedItems: state.unlockedItems,
      longestStreak,
      habitsWithStreak3,
      habitsWithStreak7,
      habitsWithStreak14,
      habitsWithStreak30,
      totalPearlsEarned,
      missionSet: !!state.mission.trim(),
      totalReflections,
      totalMissionCheckIns,
      totalWeeklyReviews: state.weeklyReviews.length,
      // Filtered against the live catalogue: old saves still carry the retired
      // `cat-*` Market items, and counting those would hand out "Collector"
      // for a set the Market no longer sells.
      shopItemsOwned: state.unlockedItems.filter((id) => SHOP_ITEM_IDS.has(id)).length,
      catsOwned: state.ownedCats.length,
      legendaryCatsOwned: state.ownedCats.filter((id) => {
        const rarity = getCat(id)?.rarity;
        return rarity === 'legendary' || rarity === 'ultra';
      }).length,
    };
  }, [state, getHabitStreak]);

  const [achFilter, setAchFilter] = useState<AchievementCategory | 'all'>('all');

  // Every achievement resolved once, then grouped the way habits group by
  // tier — a section header per category with its own earned count.
  const achievementState = useMemo(() => {
    const resolved = ACHIEVEMENTS.map((ach) => ({
      ...ach,
      earned: ach.check(achievementCheckState),
      claimed: state.claimedAchievements.includes(ach.id),
    }));

    const totalEarned = resolved.filter((a) => a.earned).length;
    const readyToClaim = resolved.filter((a) => a.earned && !a.claimed).length;

    const groups = ACHIEVEMENT_CATEGORIES.map((cat) => {
      const items = resolved.filter((a) => a.category === cat.id);
      return {
        cat,
        items,
        earned: items.filter((a) => a.earned).length,
      };
    })
      .filter((g) => g.items.length > 0)
      .filter((g) => achFilter === 'all' || g.cat.id === achFilter);

    return { groups, totalEarned, readyToClaim, total: resolved.length };
  }, [achievementCheckState, state.claimedAchievements, achFilter]);

  const handleClaimAchievement = (id: string, pearls: number) => {
    if (claimAchievement(id, pearls)) {
      showToast(`Achievement claimed · ${pearlLabel(pearls)}`, ACCENTS.achievements);
    }
  };

  const renderAchievementRow = (
    ach: (typeof achievementState.groups)[number]['items'][number]
  ) => {
    const theme = CATEGORY_BY_ID[ach.category];
    const claimable = ach.earned && !ach.claimed;

    return (
      <PixelButton
        key={ach.id}
        material={m}
        behind={m.bg}
        // Earned badges take their category's edge as the accent; locked ones
        // get no stripe at all, so a category reads as a run of colour that
        // fills in as you earn it.
        accent={ach.earned ? theme.edge : undefined}
        dimmed={!ach.earned}
        onPress={
          claimable
            ? () => handleClaimAchievement(ach.id, ach.pearlReward)
            : undefined
        }
        disabled={!claimable}
        style={pixel.achRow}
        contentStyle={pixel.achFace}
      >
        <View style={pixel.achInner}>
          <PixelPanel
            material={m}
            inset
            sunken
            bevel={BEVEL_THIN}
            style={pixel.achIconWell}
          >
            {/* A ghosted version of the real icon reads better than a padlock —
                it shows what you're working toward instead of hiding it. */}
            <Text style={[pixel.achEmoji, !ach.earned && pixel.achEmojiLocked]}>
              {ach.emoji}
            </Text>
          </PixelPanel>

          <View style={pixel.achInfo}>
            <PixelText
              size="small"
              color={ach.earned ? m.ink : m.inkDim}
              numberOfLines={1}
            >
              {ach.title}
            </PixelText>
            <PixelText size="small" color={m.inkDim} plain numberOfLines={2}>
              {ach.description}
            </PixelText>
          </View>

          {claimable ? (
            <PixelChip
              label={`+${ach.pearlReward}`}
              material={m}
              tint={ACCENTS.calendar}
              color={m.faceLt}
            />
          ) : (
            <PixelText size="small" color={m.inkDim}>
              +{ach.pearlReward}
            </PixelText>
          )}
        </View>
      </PixelButton>
    );
  };

  const renderAchievements = () => (
    <>
      {sectionHead(
        'Achievements',
        achievementState.readyToClaim > 0
          ? `${achievementState.readyToClaim} ready to claim — tap to collect.`
          : 'Earned badges pay out pearls. Keep showing up.'
      )}

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <View style={pixel.rowBetween}>
          <PixelText size="label" color={m.ink}>
            Earned
          </PixelText>
          <PixelText size="label" color={m.ink}>
            {achievementState.totalEarned}
            <PixelText size="label" color={m.inkDim}>
              /{achievementState.total}
            </PixelText>
          </PixelText>
        </View>

        <PixelProgress
          value={achievementState.totalEarned / achievementState.total}
          material={m}
          fill={ACCENTS.achievements}
          style={pixel.cardBar}
        />
      </PixelPanel>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={pixel.filterScroll}
        contentContainerStyle={pixel.filterRow}
      >
        <PixelButton
          material={m}
          behind={m.bg}
          onPress={() => setAchFilter('all')}
          contentStyle={pixel.filterChip}
          dimmed={achFilter !== 'all'}
        >
          <PixelText size="small" color={m.ink}>
            All
          </PixelText>
        </PixelButton>

        {ACHIEVEMENT_CATEGORIES.map((cat) => (
          <PixelButton
            key={cat.id}
            material={m}
            behind={m.bg}
            accent={achFilter === cat.id ? cat.edge : undefined}
            dimmed={achFilter !== cat.id}
            onPress={() => setAchFilter(cat.id)}
            contentStyle={pixel.filterChip}
          >
            <PixelText size="small" color={m.ink}>
              {cat.emoji} {cat.label}
            </PixelText>
          </PixelButton>
        ))}
      </ScrollView>

      {achievementState.groups.map((group) => (
        <View key={group.cat.id} style={pixel.tierSection}>
          <View style={pixel.rowBetween}>
            <PixelText size="small" color={m.ink}>
              {group.cat.label}
            </PixelText>
            <PixelText size="small" color={m.inkDim}>
              {group.earned} of {group.items.length}
            </PixelText>
          </View>

          <View style={pixel.achList}>{group.items.map(renderAchievementRow)}</View>
        </View>
      ))}
    </>
  );

  const renderResources = () => {
    const daily = principleForDate(todayKey);
    const dailySource = sourceOf(daily);

    // A principle card, shared between the daily pick and the shelves. The
    // "try it" button jumps into the section where the idea can actually be
    // practised — a principle two taps from its practice is trivia.
    const principleCard = (p: Principle, highlight = false) => (
      <PixelPanel key={p.id} material={m} behind={m.bg} style={pixel.card}>
        {highlight ? (
          <PixelText size="small" color={ACCENT_INKS[p.accent]}>
            TODAY'S PRINCIPLE
          </PixelText>
        ) : null}
        <PixelText size="label" color={m.ink} style={highlight ? pixel.libTitle : undefined}>
          {p.title}
        </PixelText>
        <PixelText size="small" color={m.inkDim} plain style={pixel.cardBody}>
          {p.body}
        </PixelText>
        {highlight ? (
          <PixelText size="small" color={m.inkDim} plain style={pixel.libSource}>
            — {dailySource.book}, {dailySource.author}
          </PixelText>
        ) : null}
        {SECTION_KEYS.has(p.section) ? (
          <PixelButton
            material={m}
            behind={m.face}
            accent={ACCENTS[p.accent]}
            onPress={() => setSection(p.section as HubSection)}
            style={pixel.libTry}
            contentStyle={pixel.libTryFace}
          >
            <PixelText size="small" color={m.ink}>
              {p.tryIt} {'>'}
            </PixelText>
          </PixelButton>
        ) : null}
      </PixelPanel>
    );

    return (
      <>
        {sectionHead(
          'Library',
          'Borrowed ideas, kept because they work. Reading pays no pearls — the payout is leverage.'
        )}

        {principleCard(daily, true)}

        {LIBRARY.map((shelf) => (
          <View key={shelf.book} style={pixel.tierSection}>
            <View style={pixel.rowBetween}>
              <PixelText size="small" color={m.ink}>
                {shelf.book}
              </PixelText>
              <PixelText size="small" color={m.inkDim}>
                {shelf.author}
              </PixelText>
            </View>
            {shelf.principles.map((p) => principleCard(p))}
          </View>
        ))}
      </>
    );
  };

  // Held until the pixel font is in: swapping it in late reflows every label
  // and the numbers visibly jump, which on a screen this text-dense reads as a
  // glitch rather than as loading.
  if (!fontLoaded) {
    return <SafeAreaView style={[styles.container, { backgroundColor: m.bg }]} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m.bg }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {section !== 'hub' && (
          <PixelButton
            material={m}
            behind={m.bg}
            onPress={() => setSection('hub')}
            style={pixel.back}
            contentStyle={pixel.backFace}
          >
            <PixelText size="small" color={m.inkDim}>
              {'< Back to Hub'}
            </PixelText>
          </PixelButton>
        )}

        {section === 'hub' && renderHub()}
        {section === 'habits' && renderHabits()}
        {section === 'mission' && renderMission()}
        {section === 'reflection' && renderReflection()}
        {section === 'review' && renderReview()}
        {section === 'focus' && <FocusSection />}
        {section === 'calendar' && renderCalendar()}
        {section === 'todo' && renderTodo()}
        {section === 'achievements' && renderAchievements()}
        {section === 'resources' && renderResources()}

        <View style={{ height: 30 }} />
      </ScrollView>

      <PixelToast toast={toast} material={m} style={pixel.toast} />
    </SafeAreaView>
  );
}

/**
 * Layout for the pixel hub. Colour lives on the material, not in here — it
 * changes at dusk, and a StyleSheet is frozen at module load.
 *
 * Every measurement is a multiple of `PX` so nothing lands on a half art pixel.
 */
const pixel = StyleSheet.create({
  rank: {
    padding: PX * 5,
    marginBottom: PX * 6,
  },
  rankHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankTitle: {
    marginTop: PX,
    marginBottom: PX * 3,
  },
  rankBar: {
    marginBottom: PX * 3,
  },

  today: {
    padding: PX * 5,
    marginBottom: PX * 6,
  },
  todayTitle: {
    marginBottom: PX * 3,
  },
  todayBar: {
    marginBottom: PX * 4,
  },
  todayRows: {
    gap: PX * 2,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PX * 2,
  },
  todayRowLabel: {
    marginLeft: PX * 3,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PX * 5,
    justifyContent: 'space-between',
  },
  // Two across with the gap between them. Not a third column: the titles are
  // set in a pixel font that cannot hyphenate, so "Achievements" needs room.
  tile: {
    width: '47%',
  },
  tileFace: {
    minHeight: 128,
  },
  tileInner: {
    padding: PX * 4,
  },
  tileIcon: {
    marginBottom: PX * 3,
  },

  head: {
    marginBottom: PX * 4,
  },
  headSub: {
    marginTop: PX,
  },

  card: {
    padding: PX * 5,
    marginBottom: PX * 5,
  },
  cardBar: {
    marginTop: PX * 3,
  },
  cardBody: {
    marginTop: PX * 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PX * 2,
    marginTop: PX * 4,
  },
  prefLabel: {
    marginLeft: PX * 3,
  },
  checkBox: {
    width: PX * 7,
    height: PX * 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkFill: {
    width: PX * 3,
    height: PX * 3,
  },

  tierSection: {
    marginBottom: PX * 5,
  },
  habitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PX * 3,
    marginTop: PX * 3,
  },
  habitHalf: {
    width: '48.5%',
  },
  habitWide: {
    width: '100%',
  },
  habitFace: {
    minHeight: PX * 34,
  },
  habitInner: {
    padding: PX * 3,
    flex: 1,
    justifyContent: 'space-between',
  },
  habitBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: PX * 3,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PX,
  },
  dot: {
    width: PX * 3,
    height: PX * 3,
  },
  dotCount: {
    marginLeft: PX * 2,
  },
  habitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PX * 2,
  },
  toast: {
    position: 'absolute',
    top: PX * 6,
    left: 0,
    right: 0,
  },
  libTitle: {
    marginTop: PX * 2,
  },
  libSource: {
    marginBottom: PX * 2,
  },
  libTry: {
    alignSelf: 'flex-start',
    marginTop: PX * 2,
  },
  libTryFace: {
    paddingVertical: PX * 2,
    paddingHorizontal: PX * 4,
  },
  ratingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PX * 3,
    marginTop: PX * 3,
    marginBottom: PX * 2,
  },
  ratingTile: {
    width: '48%',
  },
  ratingFace: {
    paddingVertical: PX * 3,
    alignItems: 'center',
  },
  reviewEntry: {
    padding: PX * 4,
    marginTop: PX * 3,
  },
  reviewLine: {
    marginTop: PX * 2,
    lineHeight: 17,
  },
  unlog: {
    width: PX * 8,
    height: PX * 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  wideAction: {
    alignSelf: 'stretch',
    marginBottom: PX * 4,
  },
  wideActionFace: {
    alignItems: 'center',
    paddingVertical: PX * 4,
  },

  inputWell: {
    padding: PX * 2,
    marginBottom: PX * 5,
  },
  input: {
    minHeight: PX * 40,
    fontSize: 15,
    lineHeight: 21,
    padding: PX * 2,
    textAlignVertical: 'top',
    // The mission is prose the user writes, so it stays in the system font —
    // the pixel face is for labels and numbers, not paragraphs.
    outlineStyle: 'none',
  } as any,

  question: {
    marginBottom: PX * 4,
  },
  optionList: {
    gap: PX * 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: PX * 3,
  },
  optionLabel: {
    flex: 1,
    marginRight: PX * 3,
  },
  wideActionLast: {
    alignSelf: 'stretch',
  },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: PX * 4,
  },
  monthArrow: {
    paddingHorizontal: PX * 4,
    paddingVertical: PX * 2,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: PX * 2,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: PX,
  },
  dayFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A bar under the number, not a count: at this cell size a second numeral
  // competed with the date and neither could be read at a glance.
  dayBar: {
    height: PX * 2,
    width: '55%',
    marginTop: PX,
  },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PX * 2,
    marginBottom: PX * 4,
  },
  statCell: {
    width: '31.5%',
    padding: PX * 2,
  },
  listHead: {
    marginBottom: PX * 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: PX * 2,
    marginBottom: PX * 2,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: PX * 2,
    marginBottom: PX * 4,
  },
  composerWell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: PX * 2,
  },
  inputLine: {
    fontSize: 15,
    paddingVertical: PX * 3,
    outlineStyle: 'none',
  } as any,
  addButton: {
    paddingHorizontal: PX * 5,
    justifyContent: 'center',
  },

  todoProgress: {
    marginTop: PX * 3,
  },
  todoEmpty: {
    paddingVertical: PX * 2,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PX * 3,
    marginBottom: PX * 3,
  },
  todoCheck: {
    width: PX * 13,
    height: PX * 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The label is its own press target, so the whole row toggles rather than
  // only the 22px square — the list is read left to right and tapping the
  // words is the obvious gesture.
  todoBody: {
    flex: 1,
    paddingVertical: PX * 2,
  },
  todoTextDone: {
    textDecorationLine: 'line-through',
  },
  // Anchors the floating "+1" that rises out of the row on completion.
  todoReward: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // Starts clear of the label rather than on top of it. Anchored at `top: 0` the
  // "+1" spent its first frames sitting across the "+1 pearl" chip, which read as
  // a rendering fault; `bottom: '100%'` puts it just above the row so the whole
  // rise is in clean space.
  todoFloat: {
    position: 'absolute',
    right: 0,
    bottom: '100%',
  },
  todoDelete: {
    paddingHorizontal: PX * 4,
    paddingVertical: PX * 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterScroll: {
    marginBottom: PX * 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: PX * 2,
    paddingRight: PX * 4,
  },
  filterChip: {
    paddingHorizontal: PX * 4,
    paddingVertical: PX * 2,
    justifyContent: 'center',
  },

  achList: {
    marginTop: PX * 3,
    gap: PX * 2,
  },
  achRow: {
    alignSelf: 'stretch',
  },
  achFace: {
    minHeight: PX * 22,
  },
  achInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PX * 3,
    gap: PX * 3,
  },
  achIconWell: {
    width: PX * 16,
    height: PX * 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achEmoji: {
    fontSize: 18,
  },
  achEmojiLocked: {
    opacity: 0.28,
  },
  achInfo: {
    flex: 1,
  },

  back: {
    alignSelf: 'flex-start',
    marginBottom: PX * 3,
  },
  backFace: {
    paddingHorizontal: PX * 4,
    paddingVertical: PX * 2,
  },
});

/**
 * What survives of the old sheet. Everything else — eight tile fills, the
 * rounded cards, the pill buttons, the gloss — was replaced by the pixel kit
 * and `pixel` above; the container keeps only what the material doesn't set.
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
});
