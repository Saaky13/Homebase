import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCafeState } from '../../../hooks/useCafeState';
import { colors } from '../../../constants/colors';
import { getReflectionPromptForDate } from '../../../constants/cafeData';
import FocusSection from '../../../components/FocusSection';
import { getDateKey } from '../../../utils/date';
import {
  dailyPearlTotal,
  HABIT_TIERS,
  pearlsForRep,
  TIER_ORDER,
} from '../../../constants/habitTiers';

type HubSection =
  | 'hub'
  | 'habits'
  | 'mission'
  | 'reflection'
  | 'focus'
  | 'calendar'
  | 'resources'
  | 'todo';

interface CalendarDay {
  date: number;
  dateKey: string;
  completedHabitIds: string[];
  isToday: boolean;
}

function ThreeDButton({
  title,
  subtitle,
  emoji,
  colorStyle,
  onPress,
  dimmed,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  colorStyle: any;
  onPress: () => void;
  // a dimmed tile still opens its section — it just signals "nothing left to
  // do here today", the way a completed habit tile fades out
  dimmed?: boolean;
}) {
  const pressedY = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.timing(pressedY, {
      toValue: 5,
      duration: 70,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(pressedY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
  };

  return (
    <View style={styles.tileShadowLayer}>
      <Animated.View style={{ transform: [{ translateY: pressedY }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={[styles.tileFace, colorStyle, dimmed && styles.tileDimmed]}
        >
          <View style={styles.tileGloss} />
          <Text style={styles.tileEmoji}>{emoji}</Text>
          <Text style={styles.tileTitle}>{title}</Text>
          <Text style={styles.tileSubtitle}>{subtitle}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function HabitsTab() {
  const router = useRouter();
  const {
    state,
    isLoading,
    setMission,
    claimMissionPearlsForToday,
    claimReflectionForToday,
    logHabitRep,
    unlogHabitRep,
    setPartialCountsAsDone,
    getHabitStreak,
    setGuideContext,
    addTodo,
    toggleTodo,
    removeTodo,
  } = useCafeState();

  const [section, setSection] = useState<HubSection>('hub');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [missionDraft, setMissionDraft] = useState(state.mission);
  const [todoInput, setTodoInput] = useState('');

  useEffect(() => {
    setGuideContext(`habits:${section}`);
  }, [section, setGuideContext]);

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
    Alert.alert('Saved', 'Your mission statement was updated.');
  };

  const handleMissionCheckIn = () => {
    if (!canCheckInMissionToday) return;
    const success = claimMissionPearlsForToday(todayKey);

    if (!success) {
      Alert.alert(
        'Not available',
        state.mission.trim()
          ? 'You already claimed your mission pearls today.'
          : 'Write your mission statement first.'
      );
      return;
    }

    Alert.alert('Mission check-in complete', '+25 pearls');
  };

  const handleLogRep = (habit: (typeof state.habits)[number]) => {
    const reps = todayLog[habit.id] ?? 0;
    if (reps >= habit.timesPerDay) return;
    logHabitRep(todayKey, habit.id);
  };

  const reflectionPrompt = getReflectionPromptForDate(todayKey);
  const reflectedToday = state.reflectionLastClaimedDate === todayKey;

  const handleReflectionAnswer = (option: { pearls: number }) => {
    if (reflectedToday) return;

    const success = claimReflectionForToday(todayKey, option.pearls);

    if (!success) {
      Alert.alert('Not available', 'You already reflected today.');
      return;
    }

    Alert.alert('Reflection logged', `+${option.pearls} pearls`);
  };

  const renderHub = () => (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Growth Space</Text>
        <Text style={styles.heroTitle}>Hub</Text>
        <Text style={styles.heroText}>
          Tap a button and explore. Everything here is meant to help you organize your life gently.
        </Text>
      </View>

      <View style={styles.hubGrid}>
        <ThreeDButton
          title="Habits"
          subtitle="Build routines"
          emoji="✓"
          colorStyle={styles.tilePink}
          onPress={() => setSection('habits')}
        />
        <ThreeDButton
          title="Mission"
          subtitle="Your direction"
          emoji="✦"
          colorStyle={styles.tileBlue}
          onPress={() => setSection('mission')}
        />
        <ThreeDButton
          title="Reflection"
          subtitle={reflectedToday ? 'Done for today' : 'Close the day'}
          emoji="☾"
          colorStyle={styles.tileButter}
          dimmed={reflectedToday}
          onPress={() => setSection('reflection')}
        />
        <ThreeDButton
          title="Calendar"
          subtitle="Track days"
          emoji="☷"
          colorStyle={styles.tileLavender}
          onPress={() => setSection('calendar')}
        />
        <ThreeDButton
          title="To-Do"
          subtitle="Quick list"
          emoji="☑"
          colorStyle={styles.tilePeach}
          onPress={() => setSection('todo')}
        />
        <ThreeDButton
          title="Focus"
          subtitle="Start a session"
          emoji="⏱"
          colorStyle={styles.tileMint}
          onPress={() => setSection('focus')}
        />
        <ThreeDButton
          title="Resources"
          subtitle="Guides later"
          emoji="☰"
          colorStyle={styles.tileMintAlt}
          onPress={() => setSection('resources')}
        />
      </View>
    </>
  );

  const renderHabitTile = (
    habit: (typeof state.habits)[number],
    wide: boolean
  ) => {
    const reps = todayLog[habit.id] ?? 0;
    const cap = habit.timesPerDay;
    const full = reps >= cap;
    const streak = getHabitStreak(habit.id);
    const def = HABIT_TIERS[habit.tier];

    return (
      <Pressable
        key={habit.id}
        onPress={() => handleLogRep(habit)}
        onLongPress={() => router.push(`/habit-form?id=${habit.id}`)}
        delayLongPress={300}
        style={({ pressed }) => [
          styles.habitTile,
          wide ? styles.habitTileWide : styles.habitTileHalf,
          { borderColor: habit.color },
          reps > 0 && { backgroundColor: habit.color },
          full && styles.habitTileFull,
          pressed && !full && styles.smallPressed,
        ]}
      >
        <View style={styles.habitTileTop}>
          <Text style={styles.habitTileName} numberOfLines={1}>
            {habit.name || 'Untitled'}
          </Text>
          {full && <Text style={styles.habitTileCheck}>✓</Text>}
        </View>

        <View style={styles.habitTileBottom}>
          <View style={styles.repDots}>
            {Array.from({ length: cap }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.repDot,
                  index < reps ? styles.repDotOn : styles.repDotOff,
                ]}
              />
            ))}
            {cap > 1 && (
              <Text style={styles.repCount}>
                {reps}/{cap}
              </Text>
            )}
          </View>

          <Text style={styles.habitTileMeta}>
            {streak > 0
              ? `${streak}d`
              : `+${pearlsForRep(habit.tier, habit.timesPerDay, reps + 1)}`}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderHabits = () => (
    <>
      <View style={styles.todayCard}>
        <View style={styles.todayTopRow}>
          <Text style={styles.todayTitle}>Today</Text>
          <Text style={styles.todayCount}>
            {doneToday} of {state.habits.length} done
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  state.habits.length
                    ? Math.round((doneToday / state.habits.length) * 100)
                    : 0
                }%`,
              },
            ]}
          />
        </View>

        <Pressable
          onPress={() => setPartialCountsAsDone(!state.preferences.partialCountsAsDone)}
          style={({ pressed }) => [styles.prefRow, pressed && styles.smallPressed]}
        >
          <View
            style={[
              styles.prefCheck,
              state.preferences.partialCountsAsDone && styles.prefCheckOn,
            ]}
          >
            {state.preferences.partialCountsAsDone && (
              <Text style={styles.prefCheckMark}>✓</Text>
            )}
          </View>
          <Text style={styles.prefLabel}>
            Count partial progress as done
          </Text>
        </Pressable>
      </View>

      {state.habits.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Start with one</Text>
          <Text style={styles.emptyBody}>
            Pick the single habit that would change the most if you actually did it
            every day. You can add more later.
          </Text>
        </View>
      )}

      {habitsByTier.map((group) => (
        <View key={group.tier} style={styles.tierSection}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierHeaderLabel}>{group.def.label}</Text>
            <Text style={styles.tierHeaderPearls}>
              {group.def.pearls} pearls
              {group.def.rewardModel === 'budget' ? '/day' : ' each'}
            </Text>
          </View>

          <View style={styles.tileGrid}>
            {group.habits.map((habit) =>
              renderHabitTile(habit, group.tier === 'keystone')
            )}
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => router.push('/habit-form')}
        style={({ pressed }) => [styles.createHabitButton, pressed && styles.bigPressed]}
      >
        <Text style={styles.createHabitButtonText}>+ New habit</Text>
      </Pressable>

      <Text style={styles.hintText}>
        Tap a tile to log a rep. Hold to edit.
      </Text>
    </>
  );

  const renderMission = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionHeader}>Mission</Text>
      <Text style={styles.sectionSubheader}>
        Come back here daily and check in with your direction.
      </Text>

      <TextInput
        value={missionDraft}
        onChangeText={setMissionDraft}
        placeholder="Write your mission statement..."
        placeholderTextColor="#9A8D95"
        multiline
        numberOfLines={5}
        style={styles.missionInput}
      />

      <Pressable
        onPress={handleSaveMission}
        disabled={!hasPendingMissionEdit}
        style={({ pressed }) => [
          styles.primaryBigButton,
          !hasPendingMissionEdit && styles.dimmedButton,
          pressed && styles.bigPressed,
        ]}
      >
        <Text style={styles.primaryBigButtonText}>Save Mission</Text>
      </Pressable>

      <Pressable
        onPress={handleMissionCheckIn}
        disabled={!canCheckInMissionToday}
        style={({ pressed }) => [
          styles.secondaryBigButton,
          !canCheckInMissionToday && styles.dimmedButton,
          pressed && styles.bigPressed,
        ]}
      >
        <Text style={styles.secondaryBigButtonText}>
          {missionCheckedInToday
            ? 'Already checked in today'
            : 'Daily Check-In (+25 pearls)'}
        </Text>
      </Pressable>
    </View>
  );

  const renderReflection = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionHeader}>Daily Reflection</Text>
      <Text style={styles.sectionSubheader}>
        One honest question a day. It changes every morning, and answering pays
        out once.
      </Text>

      <View style={[styles.reflectionPromptCard, reflectedToday && styles.dimmedButton]}>
        <Text style={styles.reflectionQuestion}>{reflectionPrompt.question}</Text>

        {reflectionPrompt.options.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => handleReflectionAnswer(option)}
            disabled={reflectedToday}
            style={({ pressed }) => [
              styles.reflectionOption,
              pressed && !reflectedToday && styles.smallPressed,
            ]}
          >
            <Text style={styles.reflectionOptionText}>{option.label}</Text>
            <Text style={styles.reflectionOptionPearls}>+{option.pearls}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.reflectionFootnote}>
        {reflectedToday
          ? 'Already reflected today — a new question lands tomorrow.'
          : 'Pick the one that is true, not the one worth the most.'}
      </Text>
    </View>
  );

  const renderCalendar = () => (
    <>
      <View style={styles.calendarTopBar}>
        <Pressable
          onPress={handlePrevMonth}
          style={({ pressed }) => [styles.monthArrow, pressed && styles.smallPressed]}
        >
          <Text style={styles.monthArrowText}>←</Text>
        </Pressable>

        <Text style={styles.monthTitle}>{monthName}</Text>

        <Pressable
          onPress={handleNextMonth}
          style={({ pressed }) => [styles.monthArrow, pressed && styles.smallPressed]}
        >
          <Text style={styles.monthArrowText}>→</Text>
        </Pressable>
      </View>

      <View style={styles.calendarShell}>
        <View style={styles.weekdayHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Text key={day} style={styles.weekdayText}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((day, index) => (
            <Pressable
              key={index}
              onPress={() => day && setSelectedDateKey(day.dateKey)}
              style={({ pressed }) => [
                styles.dayCell,
                day && day.isToday && styles.todayCell,
                day && selectedDateKey === day.dateKey && styles.selectedCell,
                !day && styles.emptyCell,
                pressed && day && styles.smallPressed,
              ]}
            >
              {day ? (
                <>
                  <Text
                    style={[
                      styles.dayNumber,
                      day.isToday && styles.todayNumber,
                    ]}
                  >
                    {day.date}
                  </Text>

                  {day.completedHabitIds.length > 0 && (
                    <Text style={styles.dayCount}>
                      {day.completedHabitIds.length}
                    </Text>
                  )}
                </>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      {selectedDayData && (
        <View style={styles.detailsCard}>
          <Text style={styles.sectionHeader}>{selectedDayData.dateKey}</Text>

          <View style={styles.calendarStatGrid}>
            <View style={styles.calendarStatCard}>
              <Text style={styles.calendarStatLabel}>Habits</Text>
              <Text style={styles.calendarStatValue}>
                {selectedDayData.completedHabitIds.length}
              </Text>
            </View>

            <View style={styles.calendarStatCard}>
              <Text style={styles.calendarStatLabel}>Mission</Text>
              <Text style={styles.calendarStatValue}>
                {state.dailyStats[selectedDayData.dateKey]?.missionCheckedIn ? 'Yes' : 'No'}
              </Text>
            </View>

            <View style={styles.calendarStatCard}>
              <Text style={styles.calendarStatLabel}>Coins</Text>
              <Text style={styles.calendarStatValue}>
                {state.dailyStats[selectedDayData.dateKey]?.coinsEarned ?? 0}
              </Text>
            </View>

            <View style={styles.calendarStatCard}>
              <Text style={styles.calendarStatLabel}>Drinks Made</Text>
              <Text style={styles.calendarStatValue}>
                {state.dailyStats[selectedDayData.dateKey]?.drinksMade ?? 0}
              </Text>
            </View>

            <View style={styles.calendarStatCard}>
              <Text style={styles.calendarStatLabel}>Drinks Served</Text>
              <Text style={styles.calendarStatValue}>
                {state.dailyStats[selectedDayData.dateKey]?.drinksServed ?? 0}
              </Text>
            </View>

            <View style={styles.calendarStatCard}>
              <Text style={styles.calendarStatLabel}>Pearls</Text>
              <Text style={styles.calendarStatValue}>
                {state.dailyStats[selectedDayData.dateKey]?.pearlsEarned ?? 0}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionSubheader}>Completed habits that day</Text>

          {state.habits
            .filter((habit) => selectedDayData.completedHabitIds.includes(habit.id))
            .map((habit) => {
              const reps =
                state.habitLogs[selectedDayData.dateKey]?.[habit.id] ?? 0;
              return (
                <View key={habit.id} style={styles.calendarHabitRow}>
                  <Text style={styles.calendarHabitName}>{habit.name}</Text>
                  <Text style={styles.calendarHabitTag}>
                    {reps}/{habit.timesPerDay} · {HABIT_TIERS[habit.tier].label}
                  </Text>
                </View>
              );
            })}
        </View>
      )}
    </>
  );

  const renderTodo = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionHeader}>To-Do List</Text>
      <Text style={styles.sectionSubheader}>
        A soft place for quick tasks that do not need to become full habits.
      </Text>

      <View style={styles.todoComposer}>
        <TextInput
          value={todoInput}
          onChangeText={setTodoInput}
          placeholder="Add a to-do..."
          placeholderTextColor="#9A8D95"
          style={styles.todoInput}
        />
        <Pressable
          onPress={() => {
            addTodo(todoInput);
            setTodoInput('');
          }}
          style={({ pressed }) => [styles.todoAddButton, pressed && styles.smallPressed]}
        >
          <Text style={styles.todoAddText}>Add</Text>
        </Pressable>
      </View>

      {state.todos.map((todo) => (
        <View key={todo.id} style={styles.todoRow}>
          <Pressable
            onPress={() => toggleTodo(todo.id)}
            style={({ pressed }) => [styles.todoCheckWrap, pressed && styles.smallPressed]}
          >
            <Text style={[styles.todoCheck, todo.done && styles.todoCheckDone]}>
              {todo.done ? '✓' : '○'}
            </Text>
          </Pressable>

          <Text style={[styles.todoText, todo.done && styles.todoTextDone]}>
            {todo.text}
          </Text>

          <Pressable
            onPress={() => removeTodo(todo.id)}
            style={({ pressed }) => [styles.todoDeleteChip, pressed && styles.smallPressed]}
          >
            <Text style={styles.todoDeleteText}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );

  const renderResources = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionHeader}>Resources</Text>
      <Text style={styles.sectionSubheader}>
        This page will hold self-help content later.
      </Text>

      <View style={styles.resourceCard}>
        <Text style={styles.resourceTitle}>Books</Text>
        <Text style={styles.resourceBody}>Coming soon</Text>
      </View>

      <View style={styles.resourceCard}>
        <Text style={styles.resourceTitle}>Articles</Text>
        <Text style={styles.resourceBody}>Coming soon</Text>
      </View>

      <View style={styles.resourceCard}>
        <Text style={styles.resourceTitle}>Frameworks</Text>
        <Text style={styles.resourceBody}>Coming soon</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {section !== 'hub' && (
          <Pressable
            onPress={() => setSection('hub')}
            style={({ pressed }) => [styles.backPill, pressed && styles.smallPressed]}
          >
            <Text style={styles.backPillText}>← Back to Hub</Text>
          </Pressable>
        )}

        {section === 'hub' && renderHub()}
        {section === 'habits' && renderHabits()}
        {section === 'mission' && renderMission()}
        {section === 'reflection' && renderReflection()}
        {section === 'focus' && <FocusSection />}
        {section === 'calendar' && renderCalendar()}
        {section === 'todo' && renderTodo()}
        {section === 'resources' && renderResources()}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF6FB',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  backPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E6D8F3',
    marginBottom: 12,
    shadowColor: '#B9A6F3',
    shadowOpacity: 0.3,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  backPillText: {
    color: '#6D5A7B',
    fontSize: 13,
    fontWeight: '700',
  },

  heroCard: {
    backgroundColor: '#FFFDFE',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F4D7E9',
    marginBottom: 14,
  },
  heroEyebrow: {
    fontSize: 11,
    color: '#B58CAD',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#5B4A63',
    marginBottom: 8,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7A6876',
  },

  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  tileShadowLayer: {
    width: '48%',
    marginBottom: 4,
  },
  tileFace: {
    minHeight: 142,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1.2,
    justifyContent: 'space-between',
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
    overflow: 'hidden',
  },
  tileGloss: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tilePink: {
    backgroundColor: '#FFD7EA',
    borderColor: '#E7A9C8',
    shadowColor: '#D98FB4',
  },
  tileBlue: {
    backgroundColor: '#CFEAFF',
    borderColor: '#8FC2E1',
    shadowColor: '#7DB3D4',
  },
  tileLavender: {
    backgroundColor: '#DDD2FF',
    borderColor: '#B8A5EF',
    shadowColor: '#B39CE9',
  },
  tilePeach: {
    backgroundColor: '#FFDDBF',
    borderColor: '#E8B38E',
    shadowColor: '#E8B38E',
  },
  tileMint: {
    backgroundColor: '#D9F5EA',
    borderColor: '#9FD5BF',
    shadowColor: '#7FC8AB',
  },
  tileMintAlt: {
    backgroundColor: '#DDF8F2',
    borderColor: '#9FDCCB',
    shadowColor: '#8ED4BE',
  },
  tileButter: {
    backgroundColor: '#FFF0BE',
    borderColor: '#E4C983',
    shadowColor: '#DDBE72',
  },
  tileDimmed: {
    opacity: 0.55,
  },
  tileEmoji: {
    fontSize: 22,
    color: '#6A596D',
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#584B5B',
    marginBottom: 6,
  },
  tileSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: '#7C6A76',
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F1D6E6',
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: '#5A4C60',
    marginBottom: 8,
  },
  sectionSubheader: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7F6C79',
    marginBottom: 14,
  },

  todayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1D6E6',
    padding: 16,
    marginBottom: 14,
  },
  todayTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  todayTitle: { fontSize: 20, fontWeight: '800', color: '#5A4C60' },
  todayCount: { fontSize: 12, color: '#8B7682', fontWeight: '700' },
  progressTrack: {
    height: 8,
    backgroundColor: '#F6E7F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ED93B1',
    borderRadius: 999,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  prefCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D8CBF8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefCheckOn: { backgroundColor: '#C8B6F2', borderColor: '#8B73CC' },
  prefCheckMark: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  prefLabel: { fontSize: 12, color: '#8B7682', fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#FFF9FC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F3D9E8',
    padding: 18,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#5D4E5D',
    marginBottom: 6,
  },
  emptyBody: { fontSize: 13, color: '#8B7682', lineHeight: 19 },

  tierSection: { marginBottom: 16 },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tierHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B58CAD',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  tierHeaderPearls: { fontSize: 11, color: '#B58CAD', fontWeight: '700' },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  habitTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 66,
    justifyContent: 'space-between',
  },
  habitTileWide: { width: '100%' },
  habitTileHalf: { width: '48.4%' },
  habitTileFull: { opacity: 0.72 },
  habitTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  habitTileName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4E3226',
    flex: 1,
  },
  habitTileCheck: { fontSize: 14, fontWeight: '900', color: '#4E3226' },
  habitTileBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  repDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  repDot: { width: 8, height: 8, borderRadius: 4 },
  repDotOn: { backgroundColor: '#4E3226' },
  repDotOff: { backgroundColor: 'rgba(78,50,38,0.16)' },
  repCount: {
    fontSize: 11,
    color: '#6F5D67',
    fontWeight: '700',
    marginLeft: 2,
  },
  habitTileMeta: { fontSize: 11, color: '#6F5D67', fontWeight: '700' },
  hintText: {
    fontSize: 11,
    color: '#B58CAD',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '700',
  },

  createHabitButton: {
    backgroundColor: '#BFE3F8',
    borderColor: '#8FC2E1',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#7DB3D4',
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  createHabitButtonText: {
    color: '#456173',
    fontWeight: '800',
    fontSize: 13,
  },

  creatorInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECD8E6',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    color: '#5D4E5D',
    marginBottom: 10,
  },

  habitCard: {
    backgroundColor: '#FFF9FC',
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3D9E8',
  },
  habitTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  habitLabel: {
    fontSize: 12,
    color: '#9A7E91',
    fontWeight: '700',
  },
  menuChip: {
    backgroundColor: '#EEE7FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CBF8',
    shadowColor: '#B39CE9',
    shadowOpacity: 0.3,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  menuChipText: {
    color: '#6C5A92',
    fontSize: 11,
    fontWeight: '700',
  },
  habitMainSurface: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECD8E6',
    padding: 12,
  },
  habitCheck: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.2,
    borderColor: '#A8D7C4',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7FC8AB',
    shadowOpacity: 0.32,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  habitCheckText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#78B89A',
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5D4E5D',
    marginBottom: 4,
  },
  habitMeta: {
    fontSize: 12,
    color: '#8B7682',
    marginBottom: 2,
  },
  habitReward: {
    fontSize: 12,
    color: '#B0608B',
    fontWeight: '700',
    marginTop: 4,
  },

  miniMenu: {
    marginTop: 10,
    gap: 8,
  },
  menuButton: {
    backgroundColor: '#F4F0FF',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8CBF8',
    shadowColor: '#B39CE9',
    shadowOpacity: 0.3,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  menuButtonText: {
    color: '#6C5A92',
    fontWeight: '700',
  },
  menuDeleteButton: {
    backgroundColor: '#FFE5EA',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0B7C8',
    shadowColor: '#D67F99',
    shadowOpacity: 0.3,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  menuDeleteButtonText: {
    color: '#B25570',
    fontWeight: '700',
  },

  missionInput: {
    backgroundColor: '#FFFDFE',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F4D7E9',
    minHeight: 130,
    paddingHorizontal: 14,
    paddingVertical: 14,
    textAlignVertical: 'top',
    color: '#5D4E5D',
    fontSize: 13,
    marginBottom: 12,
  },
  primaryBigButton: {
    backgroundColor: '#F0B9D7',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DB8FB9',
    shadowColor: '#D98FB4',
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryBigButtonText: {
    color: '#5F3F56',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryBigButton: {
    backgroundColor: '#BFE3F8',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#8FC2E1',
    shadowColor: '#7DB3D4',
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  secondaryBigButtonText: {
    color: '#456173',
    fontSize: 13,
    fontWeight: '800',
  },

  addHabitButton: {
    backgroundColor: '#F4C7DE',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E1AFCB',
    shadowColor: '#D98FB4',
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  addHabitButtonText: {
    color: '#6A4560',
    fontWeight: '800',
    fontSize: 13,
  },

  reflectionPromptCard: {
    backgroundColor: '#FFFCF2',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F0E0BB',
    padding: 14,
  },
  reflectionQuestion: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5D4E5D',
    lineHeight: 21,
    marginBottom: 12,
  },
  reflectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBD9AF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
    shadowColor: '#DDBE72',
    shadowOpacity: 0.3,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  reflectionOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5D4E5D',
    flex: 1,
  },
  reflectionOptionPearls: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A98A3F',
  },
  reflectionFootnote: {
    fontSize: 11,
    color: '#B58CAD',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },

  calendarTopBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8EAF8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F2FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBE2F0',
    shadowColor: '#97C2E7',
    shadowOpacity: 0.3,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  monthArrowText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#6C8AA0',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5A4D60',
  },
  calendarShell: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D8EAF8',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  weekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B96A3',
    width: '14.28%',
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#E2EFF9',
  },
  emptyCell: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  todayCell: {
    backgroundColor: '#BFE3F8',
    borderColor: '#BFE3F8',
  },
  selectedCell: {
    backgroundColor: '#F7C9DE',
    borderColor: '#F7C9DE',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5D4E5C',
  },
  todayNumber: {
    color: '#345164',
  },
  dayCount: {
    fontSize: 9,
    position: 'absolute',
    bottom: 2,
    color: '#6A6373',
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: '#FFF9FC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F3D9E8',
    padding: 16,
    marginBottom: 12,
  },
  calendarStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  calendarStatCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECD8E6',
    padding: 12,
  },
  calendarStatLabel: {
    fontSize: 11,
    color: '#8B7682',
    marginBottom: 4,
    fontWeight: '700',
  },
  calendarStatValue: {
    fontSize: 16,
    color: '#5D4E5D',
    fontWeight: '800',
  },
  calendarHabitRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECD8E6',
    padding: 12,
    marginBottom: 8,
  },
  calendarHabitName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5D4E5D',
    marginBottom: 4,
  },
  calendarHabitTag: {
    fontSize: 12,
    color: '#8B7682',
  },

  todoComposer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  todoInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECD8E6',
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#5D4E5D',
  },
  todoAddButton: {
    backgroundColor: '#CFEAFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#8FC2E1',
    shadowColor: '#7DB3D4',
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  todoAddText: {
    color: '#456173',
    fontWeight: '800',
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF9FC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3D9E8',
  },
  todoCheckWrap: {
    paddingHorizontal: 2,
  },
  todoCheck: {
    fontSize: 16,
    color: '#B0608B',
    fontWeight: '800',
  },
  todoCheckDone: {
    color: '#68A98D',
  },
  todoText: {
    fontSize: 13,
    color: '#5D4E5D',
    flex: 1,
  },
  todoTextDone: {
    textDecorationLine: 'line-through',
  },
  todoDeleteChip: {
    backgroundColor: '#FFE5EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F0B7C8',
  },
  todoDeleteText: {
    color: '#B25570',
    fontSize: 11,
    fontWeight: '700',
  },

  resourceCard: {
    backgroundColor: '#F6FBFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DDECF7',
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4C5E6A',
    marginBottom: 4,
  },
  resourceBody: {
    fontSize: 12,
    color: '#80919D',
  },

  smallPressed: {
    transform: [{ translateY: 3 }],
  },
  bigPressed: {
    transform: [{ translateY: 5 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dimmedButton: {
    opacity: 0.45,
  },
});