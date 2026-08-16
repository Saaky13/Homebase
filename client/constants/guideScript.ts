import { CafeState } from '../hooks/useCafeState';
import { computeHabitStreak } from '../utils/date';

export interface GuideContext {
  state: CafeState;
  pathname: string;
  todayKey: string;
  hour: number;
  name: string;
  daysSinceLastOpen: number | null;
}

export type GuideActionKind = 'navigate' | 'dismiss';

export interface GuideAction {
  label: string;
  kind: GuideActionKind;
  path?: string;
}

export interface GuideBeat {
  id: string;
  icon: string;
  title: string;
  // higher wins when several beats are eligible at once
  priority: number;
  // one-time beats (the default) never resurface once seen; repeatable
  // beats can come back after their cooldown, subject to daily/hour gating
  // baked into their own `match` function
  repeatable?: boolean;
  // minimum hours between two showings of a repeatable beat
  cooldownHours?: number;
  message: (ctx: GuideContext) => string;
  actions: GuideAction[];
  match: (ctx: GuideContext) => boolean;
}

function onHabitsSection(ctx: GuideContext, section: string): boolean {
  return ctx.pathname.includes('/habits') && ctx.state.guideContext === `habits:${section}`;
}

function anyHabitStreakAtLeast(ctx: GuideContext, days: number): boolean {
  return ctx.state.habits.some(
    (habit) =>
      computeHabitStreak(ctx.state.habitLogs, habit.id, ctx.todayKey, habit.timesPerDay) >=
      days
  );
}

function totalDrinksServed(ctx: GuideContext): number {
  return Object.values(ctx.state.dailyStats).reduce((sum, day) => sum + day.drinksServed, 0);
}

function todayFocusMinutes(ctx: GuideContext): number {
  return ctx.state.dailyStats[ctx.todayKey]?.drinksMade ?? 0;
}

const GOT_IT: GuideAction = { label: 'got it', kind: 'dismiss' };

export const GUIDE_SCRIPT: GuideBeat[] = [
  // ---- big moments -------------------------------------------------
  {
    id: 'welcome-first-open',
    icon: '✨',
    title: 'welcome in',
    priority: 100,
    actions: [{ label: "let's go", kind: 'dismiss' }],
    message: (ctx) =>
      `${ctx.name}, this whole place runs on your focus. every minute you lock in becomes a pearl, every pearl becomes boba, and every cup you serve keeps this café alive. let's open up.`,
    match: (ctx) => ctx.state.guide.seenMessageIds.length === 0,
  },
  {
    id: 'welcome-back',
    icon: '👋',
    title: 'look who is back',
    priority: 90,
    repeatable: true,
    cooldownHours: 12,
    actions: [{ label: "let's go", kind: 'dismiss' }],
    message: (ctx) =>
      `it's been ${ctx.daysSinceLastOpen} day${ctx.daysSinceLastOpen === 1 ? '' : 's'}, ${ctx.name}. the café's exactly how you left it — cats included. let's pick it back up.`,
    match: (ctx) => (ctx.daysSinceLastOpen ?? 0) >= 2,
  },
  {
    id: 'level-up',
    icon: '🎉',
    title: 'café leveled up',
    priority: 85,
    repeatable: true,
    actions: [{ label: 'nice', kind: 'dismiss' }],
    message: (ctx) => `level ${ctx.state.level} now. this place is turning into something.`,
    match: (ctx) => ctx.state.level > ctx.state.guide.lastAcknowledgedLevel,
  },

  // ---- time-sensitive nudges ----------------------------------------
  {
    id: 'focus-queue-waiting',
    icon: '😾',
    title: "the line's getting long",
    priority: 55,
    repeatable: true,
    cooldownHours: 2,
    actions: [
      { label: 'go serve them', kind: 'navigate', path: '/cafe' },
      { label: 'in a bit', kind: 'dismiss' },
    ],
    message: () =>
      `cats have been waiting a while out there. serve them before they leave grumpy and coinless.`,
    match: (ctx) => ctx.state.queue.some((cat) => cat.waitTime >= 10),
  },

  // ---- milestones (one-time) -----------------------------------------
  {
    id: 'habit-streak-7',
    icon: '🏆',
    title: 'one full week',
    priority: 48,
    actions: [{ label: 'love that', kind: 'dismiss' }],
    message: () => `seven days straight on the same habit. that's officially part of your routine now.`,
    match: (ctx) => anyHabitStreakAtLeast(ctx, 7),
  },
  {
    id: 'habit-streak-3',
    icon: '🔥',
    title: '3 days strong',
    priority: 47,
    actions: [{ label: 'keep going', kind: 'dismiss' }],
    message: () => `three days in a row on the same habit. that's not luck anymore, that's a pattern.`,
    match: (ctx) => anyHabitStreakAtLeast(ctx, 3),
  },
  {
    id: 'first-habit-completed',
    icon: '✅',
    title: 'logged one',
    priority: 46,
    actions: [GOT_IT],
    message: () =>
      `that's your first completed habit. pearls are pearls — they all count toward something in the café.`,
    match: (ctx) =>
      Object.values(ctx.state.habitLogs).some((day) =>
        Object.values(day).some((reps) => reps > 0)
      ),
  },
  {
    id: 'first-habit-created',
    icon: '🌟',
    title: 'first habit down',
    priority: 45,
    actions: [GOT_IT],
    message: () =>
      `nice — that's one. tap it whenever you actually do the thing today. streaks build fast once you start.`,
    match: (ctx) => ctx.state.habits.length > 0,
  },
  {
    id: 'first-mission-checkin',
    icon: '🧭',
    title: 'direction confirmed',
    priority: 44,
    actions: [GOT_IT],
    message: () =>
      `you checked in with your mission today. come back tomorrow and do it again — that's the whole trick.`,
    match: (ctx) => !!ctx.state.missionLastClaimedDate,
  },
  {
    id: 'first-cat-served',
    icon: '🐱',
    title: 'first customer',
    priority: 43,
    actions: [GOT_IT],
    message: () =>
      `you just served your first cat. that's coins in your pocket and one happy regular in the making.`,
    match: (ctx) => totalDrinksServed(ctx) > 0,
  },
  {
    id: 'first-focus-session',
    icon: '☁️',
    title: 'first brew complete',
    priority: 42,
    actions: [GOT_IT],
    message: () =>
      `you just turned real focus into something in the café. that loop only works because you showed up.`,
    match: (ctx) => ctx.state.totalFocusMinutes >= 1,
  },

  // ---- first-visit orientation, one per section -----------------------
  {
    id: 'mission-first-visit',
    icon: '🧭',
    title: 'pick a direction',
    priority: 41,
    actions: [GOT_IT],
    message: (ctx) =>
      `every strong café needs a reason to open its doors, ${ctx.name}. write one sentence about why you're doing this — you can change it anytime.`,
    match: (ctx) => onHabitsSection(ctx, 'mission') && !ctx.state.mission.trim(),
  },
  {
    id: 'habits-first-visit',
    icon: '🌱',
    title: 'growth hub',
    priority: 40,
    actions: [GOT_IT],
    message: (ctx) =>
      `this is your growth hub, ${ctx.name}. habits, mission, focus, reflection, calendar, to-dos — everything that isn't the café lives here. start with one habit, just one.`,
    match: (ctx) => onHabitsSection(ctx, 'hub'),
  },
  {
    id: 'calendar-first-visit',
    icon: '🗓️',
    title: 'your trail',
    priority: 39,
    actions: [GOT_IT],
    message: () =>
      `this calendar remembers everything — habits done, coins earned, boba served. tap any day to see what kind of day it was.`,
    match: (ctx) => onHabitsSection(ctx, 'calendar'),
  },
  {
    id: 'todo-first-visit',
    icon: '📝',
    title: 'the quick list',
    priority: 38,
    actions: [GOT_IT],
    message: () =>
      `not everything deserves to be a habit. small one-off tasks belong here instead — keeps your habit list from turning into clutter.`,
    match: (ctx) => onHabitsSection(ctx, 'todo'),
  },
  {
    id: 'reflection-first-visit',
    icon: '🌙',
    title: 'close the day out',
    priority: 37,
    actions: [GOT_IT],
    message: () =>
      `one question, once a day, and it's a different one every morning. answer it honestly rather than generously — the pearls land either way.`,
    match: (ctx) => onHabitsSection(ctx, 'reflection'),
  },
  {
    id: 'resources-first-visit',
    icon: '📚',
    title: 'still brewing',
    priority: 36,
    actions: [GOT_IT],
    message: () =>
      `nothing here yet, but this is where guides, articles, and frameworks will eventually live. for now, focus is still the best resource you've got.`,
    match: (ctx) => onHabitsSection(ctx, 'resources'),
  },
  {
    id: 'focus-first-visit',
    icon: '⏱️',
    title: 'the brew starts here',
    priority: 35,
    actions: [GOT_IT],
    message: (ctx) =>
      `every minute you focus becomes boba in your café, ${ctx.name}. start with something small — 5 minutes counts. cats are already lining up outside.`,
    // Focus used to be its own tab; it's a Growth Hub section now, so this
    // keys off the section rather than the route.
    match: (ctx) => onHabitsSection(ctx, 'focus'),
  },
  {
    id: 'cafe-first-visit',
    icon: '☕',
    title: 'the floor is yours',
    priority: 34,
    actions: [GOT_IT],
    message: (ctx) =>
      `this is the café floor, ${ctx.name}. cats queue up, you serve them, they pay in coins. no pearls, no boba — so if the line's empty, go focus first.`,
    match: (ctx) => ctx.pathname.includes('/cafe'),
  },
  {
    id: 'shop-first-visit',
    icon: '🛍️',
    title: 'spend it well',
    priority: 33,
    actions: [GOT_IT],
    message: () =>
      `coins turn into new flavors and decor here. everything you unlock sticks around and changes how your café looks.`,
    match: (ctx) => ctx.pathname.includes('/shop'),
  },
  {
    id: 'shelter-first-visit',
    icon: '🐾',
    title: 'thirty-six cats out there',
    priority: 32,
    actions: [GOT_IT],
    message: () =>
      `a hundred coins turns the crank, and you'll never pull one you already have. every cat you adopt moves in — wandering the town and dropping by the café.`,
    match: (ctx) => ctx.pathname.includes('/cats'),
  },

  // ---- gentle recurring reminders, lowest priority tier ----------------
  {
    id: 'mission-unclaimed-today',
    icon: '🧭',
    title: 'direction check',
    priority: 20,
    repeatable: true,
    cooldownHours: 20,
    actions: [
      { label: 'check in now', kind: 'navigate', path: '/habits' },
      { label: 'later', kind: 'dismiss' },
    ],
    message: () => `you've got a mission set but haven't checked in today. thirty seconds, twenty-five pearls.`,
    match: (ctx) =>
      !!ctx.state.mission.trim() && ctx.state.missionLastClaimedDate !== ctx.todayKey,
  },
  {
    id: 'no-focus-yet-today',
    icon: '🌤️',
    title: 'quiet café today',
    priority: 18,
    repeatable: true,
    cooldownHours: 20,
    actions: [
      { label: 'start focusing', kind: 'navigate', path: '/habits' },
      { label: 'not yet', kind: 'dismiss' },
    ],
    message: () =>
      `no focus logged yet today. even five minutes keeps the streak alive and gets one cat through the door.`,
    match: (ctx) => ctx.hour >= 13 && todayFocusMinutes(ctx) === 0,
  },
  {
    id: 'mission-empty-nudge',
    icon: '🧭',
    title: 'still no direction set',
    priority: 15,
    repeatable: true,
    cooldownHours: 48,
    actions: [
      { label: 'write it', kind: 'navigate', path: '/habits' },
      { label: 'later', kind: 'dismiss' },
    ],
    message: () =>
      `no mission yet. doesn't need to be profound — just one honest sentence about why you're building this routine.`,
    match: (ctx) => !ctx.state.mission.trim(),
  },
  {
    id: 'time-of-day-greeting',
    icon: '🕰️',
    title: 'a little nudge',
    priority: 1,
    repeatable: true,
    cooldownHours: 20,
    actions: [GOT_IT],
    message: (ctx) => {
      if (ctx.hour >= 5 && ctx.hour < 12) {
        return `morning, ${ctx.name}. slow starts are fine — even one small habit checked off counts as a win before noon.`;
      }
      if (ctx.hour >= 12 && ctx.hour < 18) {
        return `halfway through the day. what's one thing you can knock out in the next 25 minutes?`;
      }
      if (ctx.hour >= 18 && ctx.hour < 22) {
        return `evening's a good time to close a loop — log a habit, check your mission, or squeeze in one more focus block.`;
      }
      return `still up, ${ctx.name}? that's dedication. just don't let the café run you into the ground — rest counts too.`;
    },
    // always eligible; only ever wins when nothing more relevant matched
    match: () => true,
  },
];
