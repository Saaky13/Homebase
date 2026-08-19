import type { CafeState } from '../hooks/useCafeState';
import { pullCost } from './gacha';
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

/**
 * What a beat *is*, which decides when it's allowed to interrupt.
 *
 * - `moment` — a celebration of something that just happened. These are the
 *   beats whose match conditions stay true forever afterwards ("you have a
 *   habit", "you served a cat"), so an existing save that has never run the
 *   guide would fire every one of them in a row. `catchUpSeenIds` backfills
 *   them at load instead: a moment only ever announces itself to someone who
 *   was there when it happened.
 * - `orientation` — "here's what this screen is". Fires while you're standing
 *   on the thing it describes, and outranks moments for exactly that reason:
 *   being told what an unfamiliar room does beats being congratulated for
 *   something you did in another one.
 * - `nudge` — a recurring reminder. Only ever fires in town (see `inTown`),
 *   because a reminder is an interruption and the map is the one screen where
 *   you aren't already mid-task.
 */
export type GuideKind = 'moment' | 'orientation' | 'nudge';

export interface GuideBeat {
  id: string;
  icon: string;
  title: string;
  kind: GuideKind;
  /**
   * Higher wins when several beats are eligible at once. The bands:
   * 85–100 the big moments · 60–79 orientation · 40–59 ordinary moments ·
   * 1–35 nudges. On-demand beats (the Focus break buttons) sit at 80 so a
   * button press always beats whatever else happens to be eligible.
   */
  priority: number;
  // one-time beats (the default) never resurface once seen; repeatable
  // beats can come back after their cooldown, subject to daily/hour gating
  // baked into their own `match` function
  repeatable?: boolean;
  // minimum hours between two showings of a repeatable beat
  cooldownHours?: number;
  /**
   * Beats summoned by a button press match on a one-shot `guideContext`.
   * Dismissing clears that context, or the beat re-fires the moment the
   * 4s anti-flicker gap lapses and the user can never get rid of it.
   */
  consumesContext?: boolean;
  message: (ctx: GuideContext) => string;
  actions: GuideAction[];
  match: (ctx: GuideContext) => boolean;
}

function onHabitsSection(ctx: GuideContext, section: string): boolean {
  return ctx.pathname.includes('/habits') && ctx.state.guideContext === `habits:${section}`;
}

/** The town map — the only screen where a nudge isn't interrupting something. */
function inTown(ctx: GuideContext): boolean {
  return ctx.pathname === '/' || ctx.pathname === '/index';
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

function bobaOnHand(ctx: GuideContext): number {
  const { classic, matcha, strawberry } = ctx.state.bobaInventory;
  return classic + matcha + strawberry;
}

/** Live plants that haven't been watered today. These are the ones that can die. */
function thirstyPlants(ctx: GuideContext): number {
  return ctx.state.greenhouse.plants.filter(
    (plant) => !plant.dead && plant.lastWateredDate !== ctx.todayKey
  ).length;
}

const GOT_IT: GuideAction = { label: 'got it', kind: 'dismiss' };

/**
 * The guide has a face, and it's a cat off the roster rather than a mascot
 * drawn for the job. Sage stays adoptable in the shelter — she's the one who
 * shows you around and one of the thirty-six you can take home, which is why
 * every line below is written as her talking rather than the game narrating.
 *
 * Keep it a real roster id: the overlay renders this through `CatSprite`, so
 * an unknown id draws nothing at all.
 */
export const GUIDE_CAT_ID = 'sage';

export const GUIDE_SCRIPT: GuideBeat[] = [
  // ---- big moments -------------------------------------------------
  {
    id: 'welcome-first-open',
    icon: '✨',
    title: 'let me show you around',
    // Orientation, not a moment, despite sitting in this block. Its match
    // reads the guide's own bookkeeping — "you have never been told anything"
    // — which is a first-visit condition, not something that happened to you.
    // Classifying it as a moment would let the catch-up backfill swallow the
    // one beat every save is entitled to see.
    kind: 'orientation',
    priority: 100,
    actions: [{ label: "let's go", kind: 'dismiss' }],
    message: (ctx) =>
      `okay ${ctx.name}, short version: every minute you actually focus becomes a pearl, pearls become boba, and boba is what keeps the cats coming back. I'll turn up whenever there's something new. let's open.`,
    match: (ctx) => ctx.state.guide.seenMessageIds.length === 0,
  },
  {
    id: 'welcome-back',
    icon: '👋',
    title: "look who's back",
    kind: 'moment',
    priority: 92,
    repeatable: true,
    cooldownHours: 12,
    actions: [{ label: "let's go", kind: 'dismiss' }],
    message: (ctx) =>
      `${ctx.daysSinceLastOpen} day${ctx.daysSinceLastOpen === 1 ? '' : 's'}, ${ctx.name}. I kept an eye on the place — nothing moved, cats included. want to pick it back up?`,
    match: (ctx) => (ctx.daysSinceLastOpen ?? 0) >= 2,
  },
  {
    id: 'level-up',
    icon: '🎉',
    title: 'café leveled up',
    kind: 'moment',
    priority: 88,
    repeatable: true,
    actions: [{ label: 'nice', kind: 'dismiss' }],
    message: (ctx) =>
      `level ${ctx.state.level}. I've watched a lot of cafés open around here and most of them never got this far.`,
    match: (ctx) => ctx.state.level > ctx.state.guide.lastAcknowledgedLevel,
  },

  // ---- summoned by a button, so they outrank everything ambient -------
  {
    id: 'focus-why-breaks',
    icon: '🫧',
    title: 'why breaks matter',
    kind: 'orientation',
    priority: 80,
    repeatable: true,
    cooldownHours: 0,
    consumesContext: true,
    actions: [GOT_IT],
    message: () =>
      `here's the thing nobody tells you: attention is a battery, not a switch. a short break lets what you just learned settle instead of getting shoved aside by the next thing. stopping on purpose is how you get a second session out of the same day.`,
    match: (ctx) => ctx.state.guideContext === 'focus:breaks',
  },
  {
    id: 'focus-good-break',
    icon: '🌿',
    title: 'how to take a good break',
    kind: 'orientation',
    priority: 80,
    repeatable: true,
    cooldownHours: 0,
    consumesContext: true,
    actions: [GOT_IT],
    message: () =>
      `stand up, look at something far away, drink water, let your brain wander. I nap — you do whatever your version of that is. what doesn't work is handing your attention straight to another bright rectangle. that's not a break, that's a change of subject.`,
    match: (ctx) => ctx.state.guideContext === 'focus:goodBreak',
  },

  {
    id: 'focus-session-complete',
    icon: '🧋',
    title: 'session done',
    kind: 'orientation',
    priority: 82,
    repeatable: true,
    cooldownHours: 0,
    consumesContext: true,
    actions: [
      { label: 'go serve it', kind: 'navigate', path: '/cafe' },
      { label: 'take a break', kind: 'dismiss' },
    ],
    message: (ctx) =>
      `${bobaOnHand(ctx)} cup${bobaOnHand(ctx) === 1 ? '' : 's'} on the counter and pearls in the jar — real minutes, real boba. go stand up for a bit, I'll watch the place.`,
    match: (ctx) => ctx.state.guideContext === 'focus:complete',
  },

  // ---- orientation: what is this screen -------------------------------
  {
    id: 'habits-first-visit',
    icon: '🌱',
    title: 'growth hub',
    kind: 'orientation',
    priority: 72,
    actions: [GOT_IT],
    message: (ctx) =>
      `this is your growth hub, ${ctx.name}. habits, mission, focus, reflection, calendar, to-dos — everything that isn't the café lives in here. my advice: start with one habit. just the one.`,
    match: (ctx) => onHabitsSection(ctx, 'hub'),
  },
  {
    id: 'cafe-first-visit',
    icon: '☕',
    title: 'the floor is yours',
    kind: 'orientation',
    priority: 71,
    actions: [GOT_IT],
    message: (ctx) =>
      `here's the floor, ${ctx.name}. cats queue up, you drag a cup off the counter and set it down in front of them, they pay in coins. serving costs pearls, so if the line's empty go focus first.`,
    match: (ctx) => ctx.pathname.includes('/cafe'),
  },
  {
    id: 'mission-first-visit',
    icon: '🧭',
    title: 'pick a direction',
    kind: 'orientation',
    priority: 70,
    actions: [GOT_IT],
    message: (ctx) =>
      `every café that lasts has a reason it opens in the morning. write me one sentence about why you're doing this, ${ctx.name} — you can change it whenever you like.`,
    match: (ctx) => onHabitsSection(ctx, 'mission') && !ctx.state.mission.trim(),
  },
  {
    id: 'focus-first-visit',
    icon: '⏱️',
    title: 'the brew starts here',
    kind: 'orientation',
    priority: 69,
    actions: [GOT_IT],
    message: (ctx) =>
      `every minute you focus becomes boba out there, ${ctx.name}. start small — five minutes counts, and I've never once seen anyone regret picking the short one.`,
    // Focus used to be its own tab; it's a Growth Hub section now, so this
    // keys off the section rather than the route.
    match: (ctx) => onHabitsSection(ctx, 'focus'),
  },
  {
    id: 'shelter-first-visit',
    icon: '🐾',
    title: 'thirty-six cats out there',
    kind: 'orientation',
    priority: 68,
    actions: [GOT_IT],
    // Priced off the real ladder rather than a number in a string: the shelter
    // opens at 10 coins and climbs to a 100 ceiling, and this copy claimed a
    // flat 100 long after that stopped being true.
    message: (ctx) =>
      `${pullCost(ctx.state.ownedCats.length, ctx.state.recipes?.length ?? 0)} coins turns the crank, and you'll never pull a cat — or a recipe — you already have. everyone you adopt moves in — wandering the town, dropping by the café. and yes, I'm somewhere on that list. no pressure.`,
    match: (ctx) => ctx.pathname.includes('/cats'),
  },
  {
    id: 'greenhouse-first-visit',
    icon: '🪴',
    title: 'plants that pay rent',
    kind: 'orientation',
    priority: 67,
    actions: [GOT_IT],
    message: () =>
      `buy a seed, drag it onto a bench, water it once a day. it pays coins back every watering — and it dies if you disappear long enough. this is the one corner of your café that can go backwards, so I'd start small.`,
    match: (ctx) => ctx.pathname.includes('/greenhouse'),
  },
  {
    id: 'shop-first-visit',
    icon: '🛍️',
    title: 'spend it well',
    kind: 'orientation',
    priority: 66,
    actions: [GOT_IT],
    message: () =>
      `coins turn into flavors and decor here. decor isn't just paint — a nicer café earns more popularity per thing you do, and popularity is what decides how many of us come by.`,
    match: (ctx) => ctx.pathname.includes('/shop'),
  },
  {
    id: 'calendar-first-visit',
    icon: '🗓️',
    title: 'your trail',
    kind: 'orientation',
    priority: 65,
    actions: [GOT_IT],
    message: () =>
      `this remembers everything — habits done, coins earned, boba served. tap any day and I'll tell you what kind of day it was.`,
    match: (ctx) => onHabitsSection(ctx, 'calendar'),
  },
  {
    id: 'todo-first-visit',
    icon: '📝',
    title: 'the quick list',
    kind: 'orientation',
    priority: 64,
    actions: [GOT_IT],
    message: () =>
      `not everything deserves to be a habit. small one-off things go here instead, so your habit list doesn't quietly turn into clutter.`,
    match: (ctx) => onHabitsSection(ctx, 'todo'),
  },
  {
    id: 'reflection-first-visit',
    icon: '🌙',
    title: 'close the day out',
    kind: 'orientation',
    priority: 63,
    actions: [GOT_IT],
    message: () =>
      `one question a day, different one every morning. answer it honestly rather than generously — the pearls land either way, and I'm not grading you.`,
    match: (ctx) => onHabitsSection(ctx, 'reflection'),
  },
  {
    id: 'achievements-first-visit',
    icon: '🏅',
    title: 'nothing to grind',
    kind: 'orientation',
    priority: 62,
    actions: [GOT_IT],
    message: () =>
      `these check themselves against what you've already done, so anything you earned before today is sitting here unclaimed. go on, tap them.`,
    match: (ctx) => onHabitsSection(ctx, 'achievements'),
  },
  {
    id: 'resources-first-visit',
    icon: '📚',
    title: 'still brewing',
    kind: 'orientation',
    priority: 61,
    actions: [GOT_IT],
    message: () =>
      `nothing here yet. guides and articles will live here eventually — for now, focus is still the best resource you've got, and I'd know.`,
    match: (ctx) => onHabitsSection(ctx, 'resources'),
  },

  // ---- ordinary moments (one-time, backfilled for existing saves) ------
  {
    id: 'habit-streak-7',
    icon: '🏆',
    title: 'one full week',
    kind: 'moment',
    priority: 52,
    actions: [{ label: 'love that', kind: 'dismiss' }],
    message: () =>
      `seven days straight on the same habit. I've stopped calling that a streak — it's just what you do now.`,
    match: (ctx) => anyHabitStreakAtLeast(ctx, 7),
  },
  {
    id: 'habit-streak-3',
    icon: '🔥',
    title: '3 days strong',
    kind: 'moment',
    priority: 51,
    actions: [{ label: 'keep going', kind: 'dismiss' }],
    message: () =>
      `three days in a row on the same habit. that's not luck anymore, that's a pattern. I'd protect it.`,
    match: (ctx) => anyHabitStreakAtLeast(ctx, 3),
  },
  {
    id: 'first-cat-served',
    icon: '🐱',
    title: 'first customer',
    kind: 'moment',
    priority: 48,
    actions: [GOT_IT],
    message: () =>
      `first customer served. coins in your pocket, and one regular in the making — we remember who pours.`,
    match: (ctx) => totalDrinksServed(ctx) > 0,
  },
  {
    id: 'first-habit-completed',
    icon: '✅',
    title: 'logged one',
    kind: 'moment',
    priority: 47,
    actions: [GOT_IT],
    message: () =>
      `first one logged. pearls are pearls, and every one of them ends up as something out there in the café.`,
    match: (ctx) =>
      Object.values(ctx.state.habitLogs).some((day) =>
        Object.values(day).some((reps) => reps > 0)
      ),
  },
  {
    id: 'first-habit-created',
    icon: '🌟',
    title: 'first habit down',
    kind: 'moment',
    priority: 46,
    actions: [GOT_IT],
    message: () =>
      `there's one. tap it whenever you actually do the thing today — I'll keep count, you just do the thing.`,
    match: (ctx) => ctx.state.habits.length > 0,
  },
  {
    id: 'first-mission-checkin',
    icon: '🧭',
    title: 'direction confirmed',
    kind: 'moment',
    priority: 45,
    actions: [GOT_IT],
    message: () =>
      `you checked in with your mission. come back tomorrow and do it again — that is genuinely the entire trick.`,
    match: (ctx) => !!ctx.state.missionLastClaimedDate,
  },
  {
    id: 'first-focus-session',
    icon: '☁️',
    title: 'first brew complete',
    kind: 'moment',
    priority: 44,
    actions: [GOT_IT],
    message: () =>
      `you just turned real minutes into something in here. that loop only works because you showed up, not because I asked.`,
    match: (ctx) => ctx.state.totalFocusMinutes >= 1,
  },

  // ---- nudges: town map only, lowest priority tier ---------------------
  {
    id: 'greenhouse-thirsty',
    icon: '🥀',
    title: 'the greenhouse is dry',
    kind: 'nudge',
    priority: 30,
    repeatable: true,
    cooldownHours: 10,
    actions: [
      { label: 'go water them', kind: 'navigate', path: '/greenhouse' },
      { label: 'later', kind: 'dismiss' },
    ],
    message: (ctx) => {
      const n = thirstyPlants(ctx);
      return `${n} plant${n === 1 ? '' : 's'} haven't been watered today. one tap each, and enough dry days in a row kills them for good. I'd go now.`;
    },
    match: (ctx) => inTown(ctx) && thirstyPlants(ctx) > 0,
  },
  {
    id: 'boba-waiting-to-serve',
    icon: '🧋',
    title: 'boba going warm',
    kind: 'nudge',
    priority: 26,
    repeatable: true,
    cooldownHours: 6,
    actions: [
      { label: 'go serve', kind: 'navigate', path: '/cafe' },
      { label: 'in a bit', kind: 'dismiss' },
    ],
    message: (ctx) =>
      `${bobaOnHand(ctx)} cups brewed and nobody pouring them. that's coins you already earned the hard way, sitting on a counter going warm.`,
    // The old version of this beat read `state.queue`, the legacy field the
    // café canvas stopped using — it kept its own array — so it could never
    // fire. Stock on hand and nothing served today is the condition that
    // actually means "there is money sitting on your counter".
    match: (ctx) =>
      inTown(ctx) &&
      bobaOnHand(ctx) >= 3 &&
      (ctx.state.dailyStats[ctx.todayKey]?.drinksServed ?? 0) === 0,
  },
  {
    id: 'mission-unclaimed-today',
    icon: '🧭',
    title: 'direction check',
    kind: 'nudge',
    priority: 22,
    repeatable: true,
    cooldownHours: 20,
    actions: [
      // Deep-linked to the section, not just the hub. The Growth Hub keeps its
      // section in local state, so `/habits` alone always lands on the grid
      // and "check in now" used to drop you a tap short of the thing.
      { label: 'check in now', kind: 'navigate', path: '/habits?section=mission' },
      { label: 'later', kind: 'dismiss' },
    ],
    message: () =>
      `you set a mission and haven't checked in today. thirty seconds, twenty-five pearls. I'll wait.`,
    match: (ctx) =>
      inTown(ctx) &&
      !!ctx.state.mission.trim() &&
      ctx.state.missionLastClaimedDate !== ctx.todayKey,
  },
  {
    id: 'no-focus-yet-today',
    icon: '🌤️',
    title: 'quiet café today',
    kind: 'nudge',
    priority: 18,
    repeatable: true,
    cooldownHours: 20,
    actions: [
      { label: 'start focusing', kind: 'navigate', path: '/habits?section=focus' },
      { label: 'not yet', kind: 'dismiss' },
    ],
    message: () =>
      `no focus logged yet today. five minutes keeps it alive and gets one cat through the door — that's all I'm asking for.`,
    match: (ctx) => inTown(ctx) && ctx.hour >= 13 && todayFocusMinutes(ctx) === 0,
  },
  {
    id: 'mission-empty-nudge',
    icon: '🧭',
    title: 'still no direction set',
    kind: 'nudge',
    priority: 14,
    repeatable: true,
    cooldownHours: 48,
    actions: [
      { label: 'write it', kind: 'navigate', path: '/habits?section=mission' },
      { label: 'later', kind: 'dismiss' },
    ],
    message: () =>
      `still no mission. it doesn't have to be profound — one honest sentence about why you're building this, and I'll hold onto it for you.`,
    match: (ctx) => inTown(ctx) && !ctx.state.mission.trim(),
  },
  {
    id: 'time-of-day-greeting',
    icon: '🕰️',
    title: 'a little nudge',
    kind: 'nudge',
    priority: 1,
    repeatable: true,
    cooldownHours: 20,
    actions: [GOT_IT],
    message: (ctx) => {
      if (ctx.hour >= 5 && ctx.hour < 12) {
        return `morning, ${ctx.name}. slow starts are fine — one small habit before noon still counts as a win.`;
      }
      if (ctx.hour >= 12 && ctx.hour < 18) {
        return `halfway through. what's one thing you could knock out in the next 25 minutes?`;
      }
      if (ctx.hour >= 18 && ctx.hour < 22) {
        return `evening's good for closing a loop — log a habit, check your mission, or squeeze in one more block.`;
      }
      return `still up, ${ctx.name}? admirable. just don't let this place run you into the ground — rest counts too, and I'd know.`;
    },
    // The fallback when nothing more relevant matched — but still only in
    // town. A generic greeting that interrupts a focus session or a café
    // shift is the purest form of noise this system can make.
    match: (ctx) => inTown(ctx),
  },
];
