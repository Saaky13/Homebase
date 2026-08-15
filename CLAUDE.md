# CLAUDE.md — Homebase (Cat Café)

> A personal-development app disguised as a cat café game. Users build real habits,
> do real focus sessions, and the café responds: cats show up, boba gets brewed,
> coins flow. The game is the reward loop; the work is real.

---

## Quick start

```bash
cd client
npm install          # if fresh clone
npm run web -- --port 8090
```

The dev server preview is configured in `.claude/launch.json` under the name
`cat-cafe-web` on port 8090. Use that to launch in the Browser pane.

Platform: **web only** right now. The app runs via Expo on `react-native-web`.
No native iOS/Android builds have been done yet.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo 54) with expo-router 6 |
| Language | TypeScript 5.9, React 19.1 |
| Rendering | HTML5 Canvas (café floor 390×844, town map 384×736, cat sprites 28px) |
| State | React Context + AsyncStorage (`@focus_cafe_state_v2` key) |
| Styling | React Native `StyleSheet` — no CSS-in-JS libs, no Tailwind |
| Animation | `requestAnimationFrame` game loop (café), `Animated` API (UI) |
| Navigation | expo-router file-based routing (Stack, not tabs) |

No backend. All data lives in AsyncStorage on-device.

---

## Project structure

```
cat cafe/
├── .claude/
│   └── launch.json          # dev server config for Browser pane
├── README.md                # design doc — popularity system, economic loop, etc.
├── CLAUDE.md                # ← you are here
└── client/
    ├── app/                 # expo-router pages
    │   ├── _layout.tsx      # root layout (CafeProvider, TopBar, GuideOverlay, Stack)
    │   ├── index.tsx        # TownScreen — the home screen (pixel-art town map)
    │   ├── cafe/index.tsx   # CafeTab — canvas café floor with cats, queue, serve button
    │   ├── habits/index.tsx # HabitsTab — the "Growth Hub" (~1630 lines, all 7 sections + hub grid)
    │   ├── shop/index.tsx   # ShopTab — coin-based shop (cats, flavors, decor, upgrades)
    │   └── habit-form.tsx   # modal form for creating/editing habits
    │
    ├── components/
    │   ├── CafeCanvas.tsx   # Canvas game loop — cat spawning, queuing, seating, serving
    │   ├── Cat.tsx          # Cat entity model — state machine, movement, drawing
    │   ├── CurrencyBar.tsx  # Coins + Pearls bar (unused — replaced by TopBar pills)
    │   ├── FocusSection.tsx # Focus timer UI — rendered as a Growth Hub section
    │   ├── GuideOverlay.tsx # Animated bottom sheet — name prompt + contextual guide beats
    │   ├── Icons.tsx        # SVG icon components
    │   ├── PopularityMeter.tsx  # Popularity bar shown on the café screen
    │   ├── TopBar.tsx       # Persistent top bar — brand, back button, coin/pearl/level pills
    │   ├── TownMap.tsx      # Pixel-art town map component (canvas-rendered)
    │   ├── cafeConfig.ts    # Café layout constants — 10 table center coordinates
    │   ├── cafeRender.ts    # Canvas drawing helpers — background, tables, counter, floor tiles
    │   └── images/          # App icons, splash screen
    │
    ├── constants/
    │   ├── cafeData.ts      # Cat roster (7 cats), shop items (10), reflection prompts (4), café levels (5)
    │   ├── catSprites.ts    # Procedural pixel-art cat system — 36 palettes, 9 patterns, grid assembly, roster of 36 cats
    │   ├── colors.ts        # Shared colour palette (cream, brown, gold, pastels, etc.)
    │   ├── guideScript.ts   # All guide beats — 20+ contextual messages with priority/match/cooldown
    │   ├── habitTiers.ts    # Keystone/Anchor/Quick tier definitions, pearl math functions
    │   └── popularity.ts    # Popularity system — decay, gains, café multiplier, spawn pacing
    │
    ├── hooks/
    │   ├── guideEngine.ts   # Guide resolution engine — picks highest-priority eligible beat
    │   ├── useCafeState.tsx  # THE state file (~1360 lines) — CafeProvider, all actions, persistence, migrations
    │   └── use-color-scheme.ts/web.ts
    │
    ├── town/
    │   ├── map.ts           # Town grid layout (48×92 tiles, 8px each), 26 building specs, 4 empty plots
    │   ├── draw.ts          # Town rendering — buildings, roads, trees, cats, fountain
    │   ├── palette.ts       # Day/night colour palettes (night 7pm–6am, navy-tinted)
    │   └── canvasPainter.ts # Canvas abstraction (web path; native would swap in Skia)
    │
    ├── utils/
    │   └── date.ts          # Date key helpers, streak computation, habit log types
    │
    ├── public/
    │   └── cat_pics/        # 8 directional cat sprite PNGs (legacy, before procedural system)
    │
    └── web/
        └── globals.css      # Minimal global CSS reset
```

---

## Navigation model

The app uses a **Stack navigator** (no tab bar). The town map is the home screen.

| Route | Screen | Entry point |
|---|---|---|
| `/` (index) | Town Map | App opens here |
| `/cafe` | Café Floor | Tap the café building on the town map |
| `/habits` | Growth Hub | Tap the fountain, library, mission hall, or archive on the town map |
| `/shop` | Market | Tap the market building on the town map |
| `/habit-form` | Habit Form | From Growth Hub → Habits → "+ New habit" or long-press a habit tile |

The **TopBar** (`components/TopBar.tsx`) is rendered outside the Stack in `_layout.tsx`
so it persists across all screens. It shows:
- "Homebase" brand text on the map, "‹ Town" back button on sub-screens
- The current screen title (Café, Market, Growth Hub)
- Three pills: coins (gold), pearls (purple), level (pink)

The **GuideOverlay** (`components/GuideOverlay.tsx`) also lives outside the Stack —
an animated bottom-sheet that delivers contextual messages, first-visit orientations,
milestone celebrations, and gentle nudges. It hides itself when `focusSessionActive`
is true.

---

## State architecture

### Full CafeState interface (hooks/useCafeState.tsx)

All app state lives in a single `CafeState` object managed by a React Context
(`CafeProvider`). The provider wraps the entire app in `_layout.tsx`.

```typescript
interface CafeState {
  userName: string;                          // prompted on first launch
  mission: string;                           // free-text mission statement
  missionLastClaimedDate: string | null;     // dateKey of last mission check-in
  reflectionLastClaimedDate: string | null;  // dateKey of last reflection answer
  pearls: number;                            // earned from habits, focus, mission, reflection
  coins: number;                             // earned from serving cats; spent in shop
  popularity: number;                        // 0–100 float, decays daily, drives spawn rate
  popularityLastDecayedDate: string | null;  // dateKey through which decay was applied
  level: number;                             // auto-increments when coins reach level×100
  bobaInventory: {
    classic: number;
    matcha: number;
    strawberry: number;
  };
  unlockedItems: string[];                   // shop item IDs the user has purchased
  queue: QueueCat[];                         // legacy queue field (café canvas has its own array)
  totalFocusMinutes: number;                 // lifetime total
  upgrades: {
    counter: number;
    seating: number;
    decor: number;
    outdoor: number;
  };
  visuals: CafeVisuals;                      // {tableStyle, counterStyle, rugStyle} — each 1 or 2
  habits: Habit[];                           // user's habit list
  habitLogs: HabitLogs;                      // Record<dateKey, Record<habitId, repCount>>
  preferences: {
    partialCountsAsDone: boolean;            // any progress counts toward day's ring vs full cap only
  };
  dailyStats: Record<string, DailyStat>;     // per-day aggregates
  guideContext: string;                      // current screen context for guide matching (e.g. 'habits:hub')
  todos: TodoItem[];                         // simple todo list
  guide: GuideState;                         // guide system state (seen/muted beats, cooldowns, snooze)
  focusSessionActive: boolean;               // hides guide overlay during focus
  focusTimer: FocusTimer;                    // focus session state
}
```

**Supporting interfaces:**

```typescript
interface Habit {
  id: string;             // `habit-${Date.now()}`
  name: string;
  description: string;
  color: string;          // auto-assigned from HABIT_COLORS cycle
  tier: 'quick' | 'anchor' | 'keystone';
  timesPerDay: number;    // capped per tier (keystone: 1, anchor: 3, quick: 4)
  reminderEnabled: boolean;
  reminderText: string;
}

interface DailyStat {
  missionCheckedIn: boolean;
  coinsEarned: number;
  drinksMade: number;     // focus minutes → boba count
  drinksServed: number;   // cats served
  pearlsEarned: number;
}

interface GuideState {
  seenMessageIds: string[];              // ids of guide beats shown at least once
  mutedMessageIds: string[];             // ids user opted out of ("don't show again")
  lastSeenAt: Record<string, number>;    // per-id timestamp for cooldown checks
  lastShownAt: number;                   // timestamp of any beat, for anti-flicker spacing
  snoozedUntil: number | null;           // if set and in the future, guide stays silent
  lastOpenedDate: string | null;         // dateKey of most recent open, for "welcome back" gap
  lastAcknowledgedLevel: number;         // highest level already congratulated
}

interface FocusTimer {
  durationSeconds: number;      // length of session the user selected
  remainingSeconds: number;     // authoritative while paused; while running, derived from endsAt
  endsAt: number | null;        // ms epoch when session finishes; null when not running
  isRunning: boolean;
  creditedSeconds: number;      // already paid out, so reloads never double-credit
}

interface TodoItem { id: string; text: string; done: boolean; }

interface CafeVisuals { tableStyle: number; counterStyle: number; rugStyle: number; }
```

**Persistence:** Debounced writes to AsyncStorage (250ms delay). Storage key:
`@focus_cafe_state_v2`. On load, the provider runs migrations for legacy habit
formats (old array-based logs → Record-based, old habits without tiers → anchor
default) and recomputes popularity decay.

**Initial state:** 100 pearls, 0 coins, level 1, popularity 0, empty habits/logs/todos.

**State mutation pattern:** All mutations go through the `commit()` helper which
calls `setState` + schedules a debounced save. Individual actions (e.g. `logHabitRep`,
`addCoins`, `settleFocusTimer`) are `useCallback` functions that call `commit` with
an updater. This keeps mutations atomic and prevents stale-closure bugs.

### All exported actions from CafeProvider

These are the functions available on the context object returned by `useCafeState()`:

| Action | Signature | What it does |
|---|---|---|
| `updateState` | `(updates: Partial<CafeState>) => void` | Generic partial state update |
| `resetCafe` | `() => Promise<void>` | Wipes all state and AsyncStorage |
| `setUserName` | `(name: string) => void` | Sets the player name |
| `setGuideContext` | `(context: string) => void` | Sets the guide match context (e.g. `'habits:mission'`) |
| `setMission` | `(mission: string) => void` | Updates mission statement |
| `claimMissionPearlsForToday` | `(dateKey: string) => boolean` | +25 pearls, once per day |
| `claimReflectionForToday` | `(dateKey: string, pearls: number) => boolean` | +N pearls from reflection, once per day |
| `setFocusDuration` | `(minutes: number) => void` | Changes focus timer length |
| `startFocusTimer` | `() => void` | Starts the focus countdown |
| `pauseFocusTimer` | `() => void` | Pauses focus countdown |
| `resetFocusTimer` | `() => void` | Resets focus timer to idle |
| `settleFocusTimer` | `() => boolean` | Tick: awards boba (1/min) + pearls (1/5min) + popularity; returns `true` on the finishing tick |
| `addPearl` | `(amount?: number) => void` | +pearls |
| `spendPearls` | `(amount: number) => boolean` | −pearls, returns success |
| `addCoins` | `(amount: number) => void` | +coins, auto-levels if coins ≥ level×100 |
| `spendCoins` | `(amount: number) => boolean` | −coins, returns success |
| `addPopularity` | `(amount: number) => void` | Settles decay first, then adds base×caféMultiplier |
| `addDrinkServed` | `(amount?: number) => void` | +popularity for cat served, updates dailyStats |
| `addBoba` | `(type, amount?) => void` | Adds to bobaInventory |
| `addCatToQueue` | `(cat) => void` | Legacy queue cat addition |
| `updateQueueWaitTimes` | `() => void` | Legacy queue time update |
| `unlockItem` | `(itemId: string) => boolean` | Adds to unlockedItems array |
| `applyVisualUpgrade` | `(type, styleValue, itemId?) => void` | Changes café visual variant + unlocks item |
| `addHabit` | `(habit: Omit<Habit, 'id' \| 'color'>) => void` | Creates new habit with auto-id and auto-color |
| `updateHabit` | `(habitId, updates) => void` | Partial update to an existing habit |
| `removeHabit` | `(habitId: string) => void` | Deletes a habit |
| `logHabitRep` | `(dateKey, habitId) => number` | +1 rep, awards pearls + popularity + streak bonus; returns new rep count |
| `unlogHabitRep` | `(dateKey, habitId) => number` | −1 rep, refunds pearls + popularity; returns new rep count |
| `setPartialCountsAsDone` | `(value: boolean) => void` | Toggle partial-credit preference |
| `getHabitStreak` | `(habitId, dateKey?) => number` | Computes consecutive fully-completed days |
| `addTodo` | `(text: string) => void` | Adds a todo item |
| `toggleTodo` | `(todoId: string) => void` | Toggles todo done/not-done |
| `removeTodo` | `(todoId: string) => void` | Deletes a todo item |
| `recordGuideShown` | `(id: string) => void` | Marks a guide beat as seen |
| `snoozeGuideMessages` | `(minutes: number) => void` | Silences guide for N minutes |
| `muteGuideMessage` | `(id: string) => void` | Permanently mutes a repeatable beat |
| `setFocusSessionActive` | `(active: boolean) => void` | Tells guide overlay to hide during focus |

**Derived values on the context (not actions):**

| Field | Type | Purpose |
|---|---|---|
| `isLoading` | boolean | True until AsyncStorage load completes |
| `daysSinceLastOpen` | number \| null | Gap between previous and current app open |
| `popularityLostWhileAway` | number \| null | Decay that occurred while app was closed |
| `cafeMultiplier` | number | Current café quality multiplier (1.0–2.0) |

---

## The economic loop

```
Focus (real minutes) → Boba (1/min) + Pearls (1/5min) + Popularity (0.05/min)
         ↓
Habits (logged reps) → Pearls (tier-based) + Popularity (tier-based)
         ↓
Mission check-in → 25 Pearls/day
         ↓
Reflection answer → 2–5 Pearls/day
         ↓
Pearls → Spent to serve cats (5 pearls per cat)
         ↓
Serving cats → Coins (25 per cat) + Popularity (0.1 per cat)
         ↓
Coins → Shop upgrades (decor, cats, flavors)
         ↓
Upgrades → Café quality multiplier (1.0×–2.0×) → More popularity per action
         ↓
Popularity → Cat spawn rate + group size → More cats to serve → More coins
```

**Focus timer rates:** 1 boba per 60 seconds, 1 pearl per 300 seconds.
These constants are `SECONDS_PER_BOBA` and `SECONDS_PER_PEARL` in `useCafeState.tsx`.

---

## Habit system

### Tiers (constants/habitTiers.ts)

| Tier | Pearl model | Daily total | Default reps | Max reps/day | Tint | Ink |
|---|---|---|---|---|---|---|
| **Keystone** | Budget | 100 | 1 | 1 | `#D9F5EA` | `#2F6B54` |
| **Anchor** | Budget | 60 | 1 | 3 | `#CFEAFF` | `#38617D` |
| **Quick** | Per-rep | 10 each | 3 | 4 | `#FFDDBF` | `#8A5A33` |

Display order: `TIER_ORDER = ['keystone', 'anchor', 'quick']` (heaviest first).

**Budget model:** Splits daily total evenly using running floors. 60 pearls ÷ 3 reps
= 20/20/20 exactly. The running floor formula:
`Math.floor(pearls * n / cap) - Math.floor(pearls * (n-1) / cap)`.

**Per-rep model:** Each rep pays a flat amount (10 pearls for Quick).

**Streak bonus:** +1 pearl per consecutive completed day, paid on the rep that
completes the day (hits full `timesPerDay`).

**Key functions:**
- `pearlsForRep(tier, timesPerDay, repNumber)` → pearls for the nth rep (1-indexed)
- `dailyPearlTotal(tier, timesPerDay)` → max pearls a habit pays in one day
- `popularityForRep(tier, timesPerDay)` → popularity gain for one rep

**HABIT_COLORS cycle** (auto-assigned to new habits):
`['#F6C7D5', '#A9D7F3', '#C8B6F2', '#F2AE72', '#B8E1C6', '#EAA4B4']`

---

## Popularity system (constants/popularity.ts)

Popularity is a **standing**, not a score. It moves both ways.

- **Scale:** 0–100, stored as float, displayed with `Math.ceil`
- **Gains** (base, before café multiplier):
  - Keystone complete: 2.0
  - Anchor complete: 1.25
  - Quick win (per rep): 0.25
  - Focus: 0.05/minute
  - Cat served: 0.1
- **Decay:** 10%/day, proportional, applied per calendar day boundary
  - Formula: `popularity × 0.9^daysElapsed`
  - Below 0.5 snaps to 0 (`ZERO_SNAP_THRESHOLD`)
- **Café multiplier:** 1.0×–2.0× based on owned decor/upgrade items from shop
  - Only items in categories `['decor', 'upgrades']` count (5 qualifying items)
  - Progress = owned / total qualifying; multiplier = 1.0 + progress × 1.0
- **Equilibrium:** Daily gain ÷ 0.1 (capped at 100)
  - Bare café, full routine: ~68
  - 1.5× café: ~100
  - 2.0× café: holds 100 comfortably

**What it drives:**
- `spawnIntervalMs(popularity)`: 180,000ms at pop 0, 25,000ms at pop 100 (linear interpolation)
- `maxGroupSize(popularity)`: 1 below 33, 2 at 33–65, 3 at 66+

**Decay settling:** `settlePopularity(state, todayKey)` is called before every gain
and at load time. It's a pure function in `useCafeState.tsx`. First run (no
`popularityLastDecayedDate`) adopts today as baseline rather than retroactively decaying.

---

## Cat sprite system (constants/catSprites.ts)

Procedural pixel-art cats, **not** pre-made images. Each cat is a 28px-wide grid
of colour keys assembled from:

1. **Palette** (36 defined) — body, shade, second coat, chest white, outline, eye, highlight, nose, sparkle
2. **Pattern** (9 types) — solid, tabby, point, spots, socks, patch, patchBR, patch2, bicolor
3. **Eyes** (5 types) — big, tall, sparkle, bigspark, happy
4. **Extras** — tail up/down, white second coat, crown, sparkle particles

**Roster:** 36 cats across 5 rarities:
- Common (12): natural palettes, plain eyes
- Rare (10): pastel palettes, tall eyes
- Epic (8): vivid palettes, sparkle eyes
- Legendary (5): metallic palettes, bigspark eyes, 5 sparkle particles
- Ultra (1 — Prism): crown, 9 sparkles, unique palette

**Facing system:** 5 authored angles (front, front_side, side, back_side, back)
× horizontal mirror = 8 directions. Grids are cached per cat×direction.

The café canvas currently uses the legacy PNG sprites in `public/cat_pics/`.
The procedural system is built and ready but not yet wired to the café renderer.

---

## Café canvas (components/CafeCanvas.tsx + Cat.tsx + cafeRender.ts + cafeConfig.ts)

The café floor is a full-screen `<canvas>` (390×844 logical pixels) with a
`requestAnimationFrame` loop.

### Cat entity (Cat.tsx)

```typescript
interface Cat {
  id: string;
  groupId: string;
  x: number; y: number;
  targetX: number; targetY: number;
  speed: number;           // 3 pixels/frame
  size: number;            // 26 (drawn at size * 1.8 = ~47px)
  state: CatState;         // 'walkingToLine' | 'waiting' | 'walkingToSeat' | 'seated' | 'leaving'
  seatIndex: number | null;
  lineOffsetX: number;
  seatFacing: 'front' | 'left' | 'right' | null;
  seatedAt: number | null; // timestamp when seated
}
```

**Cat functions:** `createCat()`, `updateCat()` (per-frame movement),
`retargetCat()` (reposition in queue), `sendCatToSeat()`, `sendCatOut()`,
`isCatOffscreen()`, `drawCat()` (renders sprite + shadow ellipse).

### Table layout (cafeConfig.ts)

10 tables — 5 on the left, 5 on the right:

| ID | X | Y |
|---|---|---|
| L1 | 70 | 275 |
| L2 | 100 | 360 |
| L3 | 66 | 445 |
| L4 | 104 | 530 |
| L5 | 82 | 615 |
| R1 | 320 | 275 |
| R2 | 290 | 360 |
| R3 | 324 | 445 |
| R4 | 286 | 530 |
| R5 | 308 | 615 |

### Seating (cafeRender.ts)

Each table gets 3 seats: `middle` (y-33), `left` (x-28, y-4), `right` (x+28, y-4).
Total: 30 seats.

### Queue system

Queue spots are vertically spaced at `y = 255 + i*36`, centered at `width/2`.
Up to 10 queue positions.

**Cat state machine:** `walkingToLine → waiting → walkingToSeat → seated → leaving`

**Group behaviour:**
- Cats spawn in groups of 1–3 (based on `maxGroupSize(popularity)`)
- Groups share a `groupId` and stay together through queue → seating
- Auto-spawn interval: `spawnIntervalMs(popularity)`, self-rescheduling

**Seating preferences:**
- Groups prefer empty tables; solo cats 80% prefer empty, 20% join occupied
- Cats leave after 60s seated

**Serving:**
- Costs 5 pearls per cat in the front group
- Awards 25 coins per cat + 1 drink served (→ popularity)
- Sends the group to assigned seats

### Visual styles (cafeRender.ts)

Two style variants each for tables, counter, and rug. Controlled by `visuals.tableStyle`,
`visuals.counterStyle`, `visuals.rugStyle` (each 1 or 2). Upgradeable via the shop.

- **Option 1 tables:** Wooden with green chairs, 24×15px ellipse top
- **Option 2 tables:** Richer brown with cream-cushioned chairs, 28×17px ellipse top
- **Option 1 counter:** Simple wood tones (`#CF9A63`, `#D9A672`, `#B57E43`)
- **Option 2 counter:** Richer/wider counter (`#E39D6B`, `#EDBC85`, `#C77F48`)
- **Option 1 rug:** Narrow terracotta + gold (`#B86B4B`, `#D9A672`)
- **Option 2 rug:** Wider dark red with stripes (`#8E4E47`, `#D5B08D`)

Background: `#DCE8D4` (matcha green), room fill: `#EDF4E7`, border: `#C6D5BC`.
Floor tiles: 32px grid with subtle gridlines.

---

## Guide system (constants/guideScript.ts + hooks/guideEngine.ts + components/GuideOverlay.tsx)

A contextual message system that surfaces the right nudge at the right time.

**How it works:**
1. `GuideOverlay` re-evaluates every 5 seconds and on every state change
2. `resolveGuideMessage()` filters eligible beats (not muted, past cooldown, `match()` passes)
3. Highest priority wins; ties broken by script order
4. Once shown, one-time beats never return; repeatable beats respect `cooldownHours`

### Complete guide beat table

| ID | Priority | Repeatable | Cooldown | Match condition |
|---|---|---|---|---|
| `welcome-first-open` | 100 | no | — | No beats ever seen |
| `welcome-back` | 90 | yes | 12h | 2+ days since last open |
| `level-up` | 85 | yes | — | Level > lastAcknowledgedLevel |
| `focus-queue-waiting` | 55 | yes | 2h | Any queue cat waiting 10+ min |
| `habit-streak-7` | 48 | no | — | Any habit has 7-day streak |
| `habit-streak-3` | 47 | no | — | Any habit has 3-day streak |
| `first-habit-completed` | 46 | no | — | Any habitLog has reps > 0 |
| `first-habit-created` | 45 | no | — | habits.length > 0 |
| `first-mission-checkin` | 44 | no | — | missionLastClaimedDate set |
| `first-cat-served` | 43 | no | — | Total drinks served > 0 |
| `first-focus-session` | 42 | no | — | totalFocusMinutes ≥ 1 |
| `mission-first-visit` | 41 | no | — | On habits:mission, mission empty |
| `habits-first-visit` | 40 | no | — | On habits:hub |
| `calendar-first-visit` | 39 | no | — | On habits:calendar |
| `todo-first-visit` | 38 | no | — | On habits:todo |
| `reflection-first-visit` | 37 | no | — | On habits:reflection |
| `resources-first-visit` | 36 | no | — | On habits:resources |
| `focus-first-visit` | 35 | no | — | On habits:focus |
| `cafe-first-visit` | 34 | no | — | On /cafe route |
| `shop-first-visit` | 33 | no | — | On /shop route |
| `mission-unclaimed-today` | 20 | yes | 20h | Has mission, not checked in today |
| `no-focus-yet-today` | 18 | yes | 20h | After 1pm, no focus today |
| `mission-empty-nudge` | 15 | yes | 48h | No mission set |
| `time-of-day-greeting` | 1 | yes | 20h | Always (lowest priority fallback) |

**GuideContext interface:**
```typescript
interface GuideContext {
  state: CafeState;
  pathname: string;       // current route
  todayKey: string;       // YYYY-MM-DD
  hour: number;           // 0–23
  name: string;           // user's name
  daysSinceLastOpen: number | null;
}
```

**Anti-spam:** 4s minimum gap between any two beats (`lastShownAt` check).
25-minute snooze button. "Don't show again" permanently mutes a repeatable beat.

**Section matching:** `onHabitsSection(ctx, section)` checks both that the route
includes `/habits` AND that `state.guideContext === 'habits:${section}'`.

---

## Growth Hub sections (app/habits/index.tsx)

The Growth Hub is a single screen (~1630 lines) with a local `section` state:

```typescript
type HubSection = 'hub' | 'habits' | 'mission' | 'reflection' | 'focus'
                | 'calendar' | 'resources' | 'todo';
```

### Hub tile grid

Each section has a `ThreeDButton` tile with these colours:

| Tile | Style name | Background | Border | Shadow |
|---|---|---|---|---|
| Habits | `tilePink` | `#FFD7EA` | `#E7A9C8` | `#D98FB4` |
| Mission | `tileBlue` | `#CFEAFF` | `#8FC2E1` | `#7DB3D4` |
| Reflection | `tileButter` | `#FFF0BE` | `#E4C983` | `#DDBE72` |
| Calendar | `tileLavender` | `#DDD2FF` | `#B8A5EF` | `#B39CE9` |
| To-Do | `tilePeach` | `#FFDDBF` | `#E8B38E` | `#E8B38E` |
| Focus | `tileMint` | `#D9F5EA` | `#9FD5BF` | `#7FC8AB` |
| Resources | `tileMintAlt` | `#DDF8F2` | `#9FDCCB` | `#8ED4BE` |

**ThreeDButton component anatomy:**
- Shadow layer: `tileShadowLayer` (48% width, 4px bottom margin)
- Face: `tileFace` (min-height 142, border-radius 24, 1.2px border, 7px shadow offset)
- Gloss overlay: `tileGloss` (25% white, 24px tall, rounded, positioned at top)
- Press animation: `Animated.timing` → translateY 5px on press-in, spring back on release
- Dimming: `tileDimmed` (opacity 0.55) — signals "nothing left to do here today"

### Sections

| Section | Key render function | What it shows |
|---|---|---|
| `hub` | `renderHub()` | Grid of 7 ThreeDButton tiles + hero card |
| `habits` | `renderHabits()` (inline) | Today progress ring, habit tiles grouped by tier (via `TIER_ORDER`), "+ New habit" button |
| `mission` | inline in return | Mission TextInput + save button, daily check-in (+25 pearls) |
| `reflection` | inline in return | `getReflectionPromptForDate(todayKey)` — rotating daily question with 4 multiple-choice answers (2–5 pearls each) |
| `focus` | `<FocusSection />` | Timer presets (5/10/15/25/45/60 min), start/pause/reset, break guidance |
| `calendar` | inline in return | Month view with prev/next, per-day habit count dots, tap-to-drill-down stats |
| `todo` | inline in return | Text input, add button, list with check/delete |
| `resources` | inline in return | "Coming soon" placeholder cards |

**The section state is a `useState`, not a route.** Navigating to `/habits`
always lands on the hub grid first. The "← Back to Hub" button resets to hub.
The `useEffect` calls `setGuideContext('habits:${section}')` whenever section changes.

### How to add a new Growth Hub section (step-by-step)

1. **Add to the type union** in `app/habits/index.tsx`:
   ```typescript
   type HubSection = '...' | 'yourSection';
   ```

2. **Add a ThreeDButton** in `renderHub()` with a new tile color style:
   ```typescript
   <ThreeDButton
     title="Your Section"
     subtitle="Description"
     emoji="🏆"
     colorStyle={styles.tileYourColor}
     onPress={() => setSection('yourSection')}
   />
   ```

3. **Create the tile color style** in the StyleSheet:
   ```typescript
   tileYourColor: {
     backgroundColor: '#...', borderColor: '#...', shadowColor: '#...',
   },
   ```

4. **Add a render function** (or inline JSX) for the section content.

5. **Add the conditional** in the main return block (the pattern is a chain of
   `section === 'x' ? renderX() :` checks).

6. **Destructure any needed actions** from `useCafeState()` at the top of
   `HabitsTab()`.

7. **If adding state fields:** add them to `CafeState` in `useCafeState.tsx`,
   set defaults in `initialState`, add actions, and handle migration from older
   saves in the `loadState` function.

8. **If adding a guide beat:** add to `GUIDE_SCRIPT` in `guideScript.ts` with
   a match condition like `onHabitsSection(ctx, 'yourSection')`.

---

## Town map (town/ directory)

A pixel-art overhead town rendered to canvas. Buildings are tap targets that
navigate to the app's screens.

### Grid dimensions
- **Tile size:** 8px (`TILE`)
- **Map:** 48 × 92 tiles = 384 × 736 pixels
- **Fountain (Growth Hub entry):** tile (16, 15)

### Key buildings with routes

| ID | Position (tile) | Size (tiles) | Label | Route |
|---|---|---|---|---|
| `library` | (6, 9) | 6×5 | Library | `/habits` |
| `mission` | (21, 8) | 5×5 | Mission Hall | `/habits` |
| `archive` | (6, 17) | 5×4 | Archive | `/habits` |
| `cafe` | (4, 27) | 5×5 | Café | `/cafe` |
| `market` | (17, 28) | 5×4 | Market | `/shop` |

Other buildings (inn, bakery, observatory, grocer, workshop, nursery, shrine,
15 houses) are scenery — no route yet. 4 empty plots rendered as dirt rings
with signposts.

### Wandering cats on the town map

6 cats placed at fixed tile positions: mochi, pistachio, indigo, clover, sunbeam, koi.
Each has a direction (front, front_left, left, etc.) for sprite rendering.

### Day/night cycle (palette.ts)

- **Night:** 7pm–6am (`h >= 19 || h < 6`)
- **Night tint:** Navy blue-grey `rgb(58, 72, 112)` at 58% strength
- All palette colors mixed toward the tint; glass colors overridden to warm gold
  (`#FFD98A` / `#FFEEC4` / `#D9A64E`) to simulate lit windows
- `dimForNight(hex)` applies a slightly weaker tint (46%) so cat sprites dim
  but remain readable against terrain

### Rendering files
- `map.ts` — grid layout, `BuildingSpec` interface, `buildTownGrid()`, tree/grove generation
- `draw.ts` — rendering: terrain, roads, buildings, trees, fountain, wandering cats
- `palette.ts` — day/night palettes, `isNightAt()`, `nightPalette()`, `dimForNight()`
- `canvasPainter.ts` — thin canvas abstraction (web path; native would swap in Skia)

---

## Shop data (constants/cafeData.ts)

### Shop items

| ID | Title | Price (coins) | Category |
|---|---|---|---|
| `cat-orange` | Orange Cat | 50 | cats |
| `cat-white` | White Cat | 50 | cats |
| `cat-green` | Green Cat | 50 | cats |
| `flavor-mango` | Mango Boba | 30 | flavors |
| `flavor-taro` | Taro Boba | 30 | flavors |
| `decor-plants` | Plant Decor | 40 | decor |
| `decor-lights` | String Lights | 60 | decor |
| `decor-paintings` | Wall Art | 50 | decor |
| `upgrade-seating` | Better Seating | 100 | upgrades |
| `upgrade-counter` | Modern Counter | 120 | upgrades |

Only `decor` and `upgrades` categories affect the café quality multiplier.

### Legacy cat roster (used by queue system)

7 cats: Luna 🐈‍⬛, Whiskers 🧡, Mittens 🤍, Sage 💚, Jazz 🟠, Shadow ⬛, Sunny 🌟.

### Reflection prompts

4 rotating daily questions, each with 4 options paying 2–5 pearls:
- "How aligned were you with your mission today?"
- "What was your biggest win today?"
- "How did you handle challenges today?"
- "How did your focus sessions go today?"

Selection uses `daysSinceEpoch % 4` so the prompt rotates daily and stays
stable throughout the day.

### Café levels

| Level | Name | Threshold |
|---|---|---|
| 1 | Just Opening | — |
| 2 | Growing | 200 coins |
| 3 | Thriving | 300 coins |
| 4 | Bustling | 400 coins |
| 5 | Legendary | 500 coins |

Level-up formula: `coins >= level * 100`.

---

## Design language

The app uses a **soft, pastel, toybox aesthetic** — no dark mode, no flat design.
Root background: `#FFF7F2`.

### Shared colour palette (constants/colors.ts)

```
cream: '#F8F1E7'    paper: '#FFF9F0'     white: '#FFFDF8'
brown900: '#4E3226'  brown700: '#7B5240'  brown500: '#A36E4F'  brown300: '#D5B08D'
gold: '#E7B85C'      peach: '#F2AE72'     coral: '#E88973'     blush: '#EAA4B4'
pink: '#F6C7D5'      lavender: '#C8B6F2'  sky: '#A9D7F3'       mint: '#B8E1C6'
sage: '#DCE8D4'
accentGold: '#E7B85C'  accentTeal: '#68A594'  accentBlush: '#D87E97'
darkBrown: '#4E3226'   mediumGray: '#8F7C72'  lightGray: '#F3E7D9'  warmTan: '#E9D1B7'
success: '#63B97C'     danger: '#D96C6C'
shadow: 'rgba(92,58,42,0.16)'  outline: 'rgba(92,58,42,0.12)'
```

### UI patterns
- **3D tile buttons** (Growth Hub): raised face with shadow layer, `Animated` press-down
  (translateY 5px → spring back). Min-height 142px, border-radius 24, gloss overlay.
- **Rounded cards** with 1.2px pastel borders and subtle `shadowOffset` for depth
- **Pill chips** for currencies: coins gold, pearls purple, level pink
- **Progress bars** with rounded tracks
- **Retro pixel buttons** (Focus section): outer/inner rounded rects in gold/sky/pink

### Colour families
- **Hub / Growth:** pinks, lavenders, soft whites (`#FFF6FB`, `#F1D6E6`, `#FFD7EA`)
- **Café / retro:** warm creams, browns, golds (`#F8F1E7`, `#4E3226`, `#E7B85C`)
- **Town map:** greens, earth tones (`#A8C98C` grass, `#E0CCAE` road, `#EFE0CA` stone)
- Each hub tile has its own colour set (see tile table above)

### Typography
- System font only (no custom fonts loaded)
- Weights: 700 for labels, 800 for titles/buttons, 900 for large numbers
- Sizes: 9–11 for captions/pills, 12–13 for body, 15–17 for headers, 22 for tile emoji, 26+ for hero

---

## Date system (utils/date.ts)

All daily data keys use **`YYYY-MM-DD` format** (e.g. `"2026-08-13"`).

```typescript
type HabitLogs = Record<string, Record<string, number>>;
// dateKey → habitId → repCount

function getTodayDateKey(): string;
function getDateKey(year: number, month: number, day: number): string;
// month is 0-indexed (JavaScript Date convention)
function getPreviousDateKey(dateKey: string): string;
function daysBetweenDateKeys(from: string, to: string): number;
function repsOn(logs: HabitLogs, dateKey: string, habitId: string): number;
function computeHabitStreak(
  logs: HabitLogs,
  habitId: string,
  fromDateKey: string,
  timesPerDay: number
): number;
// walks backwards from fromDateKey counting consecutive fully-completed days
```

---

## Running the app

```bash
# Dev server (web)
cd client && npm run web -- --port 8090

# Or via the Browser pane launch config:
# preview_start with name "cat-cafe-web"
```

No tests exist yet. No linting is enforced beyond the Expo eslint config.

---

## What exists and what doesn't

### Built and working
- Town map with day/night cycle, 26 buildings, wandering cats
- Full café canvas with cat spawning, queuing, seating, serving (2 visual style variants)
- Growth Hub with all 7 sections (habits, mission, reflection, focus, calendar, todo, resources)
- Three-tier habit system with rep logging, streaks, pearl math (budget + per-rep models)
- Focus timer with boba/pearl payouts and break guidance
- Mission statement with daily check-in (+25 pearls)
- Daily reflection with rotating prompts (4 questions, 2–5 pearls)
- Popularity system (10%/day proportional decay, café multiplier 1.0–2.0×, spawn pacing)
- Shop with 10 items across 4 categories (cats, flavors, decor, upgrades)
- Full guide/tutorial system with 24 contextual beats
- Procedural cat sprite system (36 cats, 5 rarities, 9 patterns, 8 directions)
- Persistent state with migrations (legacy array logs → record-based, old habits → tiered)
- TopBar with currency pills persistent across all screens

### Not yet built
- Achievements / milestones tab (planned for Growth Hub)
- User XP / leveling system (separate from café level)
- Cat chest / gacha system for unlocking cats
- Wiring procedural sprites into the café canvas (still using legacy PNGs)
- Native iOS/Android builds
- Sound design
- Notifications / reminders
- Backend / cloud sync
- Onboarding flow beyond name entry
- Settings screen

---

## Conventions for contributors

1. **State changes go through `useCafeState` actions.** Never mutate state directly
   or write to AsyncStorage outside the provider. All mutations use the `commit()`
   helper which calls `setState` + schedules a debounced save.
2. **Popularity is always settled before gains.** Call `settlePopularity(prev, todayKey)`
   inside any commit that touches popularity. This is what keeps today's gains from
   being eroded by yesterday's decay.
3. **Pearls and popularity are computed from tier definitions, not hardcoded.**
   Use `pearlsForRep()` and `popularityForRep()` — never inline the numbers.
4. **Date keys, not timestamps, for daily data.** Everything keyed by day uses
   `YYYY-MM-DD` strings via the `utils/date.ts` helpers. Month is 0-indexed in
   `getDateKey()`.
5. **The Growth Hub uses local section state, not routes.** Adding a new section
   means: add to `HubSection` type → add tile in `renderHub()` → add render
   function → add conditional in JSX return → set `guideContext` in `useEffect`.
6. **Canvas rendering is imperative.** The café and town map draw to `<canvas>`
   elements directly. Don't try to use React components inside them.
7. **The guide system is data-driven.** Add new beats to `GUIDE_SCRIPT` in
   `guideScript.ts` — the engine picks them up automatically based on priority
   and match conditions. Section matching uses `onHabitsSection(ctx, sectionName)`.
8. **No dark mode.** The app has a fixed warm-light palette. `useColorScheme`
   exists but the root layout sets a fixed background (`#FFF7F2`).
9. **New state fields need migration.** When adding fields to `CafeState`, add
   defaults in `initialState` and handle the case where older saves don't have
   the field (the spread `...initialState, ...parsed` covers simple cases).
10. **Focus timer uses `endsAt` (absolute timestamp), not a decrementing counter.**
    This survives unmounts, app restarts, and throttled intervals. Pausing stores
    `remainingSeconds`; running derives remaining from `endsAt - Date.now()`.
    Offline time is never credited — a session mid-run at close comes back paused.
