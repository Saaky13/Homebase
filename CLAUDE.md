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

Platform: **web is the verified target.** The app runs via Expo on
`react-native-web`. A native path exists — `app.json` carries iOS/Android
config (`com.saaky13.homebase`, new architecture on), the café renders through
Skia which is linked into a native binary, and `CafeCanvasHost.native.tsx`
skips the web-only CanvasKit loader — but **no native build has been run or
verified end to end.** Treat native as wired, not working.

`npm install` runs a `postinstall` hook (`scripts/copy-canvaskit.js`) that
stages the CanvasKit WASM payload for web. A fresh clone that skips postinstall
will fail on the café screen.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo 54) with expo-router 6 |
| Language | TypeScript 5.9, React 19.1 |
| Rendering | Skia via `@shopify/react-native-skia` for the café floor (authored 390 wide, uniformly scaled, height flows — through the Canvas2D-shaped shim in `components/skiaCanvas2d.ts`); HTML5 Canvas for the town map (384×736); cat sprites 28×37 |
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
    │   ├── _layout.tsx      # root layout (CafeProvider, TopBar, GuideOverlay, FocusOverlay, Stack)
    │   ├── index.tsx        # TownScreen — the home screen (pixel-art town map)
    │   ├── cafe/index.tsx   # CafeTab — Skia café floor with cats, queue, drag-to-serve
    │   ├── habits/index.tsx # HabitsTab — the "Growth Hub" (~2170 lines, all 9 sections + hub grid)
    │   ├── shop/index.tsx   # ShopTab — coin-based shop (flavors, decor, upgrades)
    │   ├── cats/index.tsx   # CatsTab — the Cat Shelter (Adopt + Collection tabs)
    │   └── habit-form.tsx   # modal form for creating/editing habits — on the pixel kit, two-step delete
    │
    ├── components/
    │   ├── CafeCanvas.tsx   # Skia game loop — mirrors cafeVisit: arrivals, queue, seating, serving
    │   ├── CafeCanvasHost.tsx        # web entry — defers CafeCanvas until CanvasKit loads
    │   ├── CafeCanvasHost.native.tsx # native entry — re-exports CafeCanvas directly
    │   ├── skiaCanvas2d.ts  # Canvas2D-shaped facade over Skia's imperative canvas
    │   ├── Cat.tsx          # Cat entity model — state machine, movement, drawing
    │   ├── pixelImage.ts    # Shared grid → cached SkImage rasteriser
    │   ├── catImageCache.ts # Caches each cat×direction as an SkImage
    │   ├── bobaImageCache.ts # Caches the carried cup — 3 flavours × 4 fill levels
    │   ├── BobaCupSprite.tsx # The draggable counter cup — SVG data-URI <Image>
    │   ├── CatSprite.tsx    # React cat sprite — SVG data-URI <Image>, no canvas
    │   ├── GachaMachine.tsx # Pixel capsule machine with animated crank + drop
    │   ├── GreenhouseCanvas.tsx # The greenhouse — Skia, but NO render loop
    │   ├── GreenhouseCanvasHost.tsx / .native.tsx # the WithSkiaWeb seam
    │   ├── greenhouseConfig.ts  # Greenhouse geometry — sockets, benches, stations
    │   ├── greenhouseRender.ts  # The room — glass, limewash wall, benches, potting bench
    │   ├── plantImageCache.ts   # Caches species x stage x wet/dry as SkImages
    │   ├── SeedRackSheet.tsx    # Bottom sheet — the seed packets you buy from
    │   ├── AdoptionReveal.tsx  # Full-screen reveal after an adoption
    │   ├── CurrencyBar.tsx  # Coins + Pearls bar (unused — replaced by TopBar pills)
    │   ├── FocusSection.tsx # Focus timer UI — a Growth Hub section, on the pixel kit
    │   ├── FocusOverlay.tsx # The focus curtain — full-screen night sky while a session runs; owns the settle tick
    │   ├── GuideOverlay.tsx # Animated bottom sheet — name prompt + contextual guide beats
    │   ├── Icons.tsx        # Coin / Pearl / Popularity pixel icons as SVG data-URIs
    │   ├── PopularityMeter.tsx  # Popularity bar shown on the café screen
    │   ├── TopBar.tsx       # Persistent top bar — brand, back button, coin/pearl/level pills
    │   ├── TownMap.tsx      # Pixel-art town map component (canvas-rendered)
    │   ├── pixel/           # The Growth Hub pixel UI kit — panel, button, icon, text,
    │   │                    #   progress, chip, toggle, toast, and the day/night material hook
    │   ├── cafeConfig.ts    # Café layout constants — 10 table center coordinates
    │   ├── cafePixel.ts     # PixelPainter — the café's rect-only pixel-art primitives
    │   └── cafeRender.ts    # The room — floor, rug, wall, windows, counter, tables, door
    │
    ├── constants/
    │   ├── achievements.ts  # 32 achievements across 6 categories + category colour defs
    │   ├── affinity.ts      # What each cat thinks of each drink — serveOutcome's coins/popularity/XP
    │   ├── bobaCup.ts       # Generated 20×30 boba cup grid — 3 flavours, variable fill
    │   ├── bonds.ts         # Cat bonds — XP curve per rarity, derived level, coin tip
    │   ├── cafeData.ts      # Legacy cat roster (7), shop items (7), reflection prompts (12, flat 4 pearls), café levels (5)
    │   ├── cafePalette.ts   # Café interior palette + its night variant
    │   ├── cafeVisit.ts     # Café visits as state — two timestamps per customer, phases derived from the clock
    │   ├── catLore.ts       # Per-cat record — adoption/serve dates, day parts, bondXp; odds and bios
    │   ├── catSprites.ts    # Procedural pixel-art cat system — 36 palettes, 9 patterns, grid assembly, roster of 36 cats
    │   ├── colors.ts        # Shared colour palette (cream, brown, gold, pastels, etc.)
    │   ├── drinks.ts        # The menu — every drink's rarity, pearl cost, base coins, cup palette
    │   ├── gacha.ts         # Adoption draw — rarity weights, pickCat, starters, save seeding
    │   ├── gachaMachine.ts  # Pixel art for the capsule machine (36×54 grid, crank, capsules)
    │   ├── guideScript.ts   # All guide beats — 27 contextual messages with priority/match/cooldown
    │   ├── habitTiers.ts    # Keystone/Anchor/Quick tier definitions, pearl math functions
    │   ├── library.ts       # The Library — 12 credited principles from real self-help books, daily rotation
    │   ├── popularity.ts    # Popularity system — decay, gains, café multiplier, spawn pacing
    │   └── userRank.ts      # The player's ladder — 10 ranks off pearls *earned*, buys nothing
    │
    ├── hooks/
    │   ├── guideEngine.ts   # Guide resolution engine — picks highest-priority eligible beat
    │   ├── useCafeState.tsx  # THE state file (~2300 lines) — CafeProvider, all actions, persistence, migrations
    │   └── use-color-scheme.ts/web.ts
    │
    ├── town/
    │   ├── map.ts           # Town grid layout (48×92 tiles, 8px each), 28 building specs, 4 empty plots
    │   ├── draw.ts          # Town rendering — buildings, roads, trees, cats, fountain
    │   ├── roam.ts          # Roaming cats — BFS pathing over walkable tiles
    │   ├── palette.ts       # Day/night colour palettes (night 7pm–6am, navy-tinted)
    │   └── canvasPainter.ts # Canvas abstraction (web path; native would swap in Skia)
    │
    ├── utils/
    │   ├── date.ts          # Date + week key helpers, streak computation, habit log types
    │   └── pixelSvg.ts      # Shared grid → SVG data-URI encoder (icons, cats, machine)
    │
    ├── scripts/
    │   └── copy-canvaskit.js  # postinstall — stages the CanvasKit WASM payload for web
    │
    ├── assets/
    │   ├── fonts/           # HandjetBubble.ttf — Handjet baked at ELGR 1 / ELSH 16 / wght 800
    │   ├── cats/            # 8 directional cat PNGs (legacy — no longer referenced)
    │   └── images/          # App icons, splash screen
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
| `/cats` | Cat Shelter | Tap the shelter building on the town map |
| `/greenhouse` | Greenhouse | Tap the greenhouse on the town map |
| `/habit-form` | Habit Form | From Growth Hub → Habits → "+ New habit" or long-press a habit tile |

The **TopBar** (`components/TopBar.tsx`) is rendered outside the Stack in `_layout.tsx`
so it persists across all screens. It shows:
- "Homebase" brand text on the map, "‹ Town" back button on sub-screens
- The current screen title (Café, Market, Growth Hub, Cat Shelter)
- Four pills: coins (gold), pearls (purple), level (pink), rank (lavender)

Coins and pearls carry their icon and no word — a pill wearing both says the
same thing twice, and four pills plus a back button plus a screen title do not
fit a 390-wide phone. The two numbers that *are* words are the two that need
telling apart: `level` is the café's, bought with coins and read by the
greenhouse gates; `rank` is the player's, fed by pearls earned. The rank's
title is too long for a pill and lives on the Growth Hub.

The **GuideOverlay** (`components/GuideOverlay.tsx`) also lives outside the Stack —
an animated bottom-sheet that delivers contextual messages, first-visit orientations,
milestone celebrations, and gentle nudges. It hides itself when `focusSessionActive`
is true.

The **FocusOverlay** (`components/FocusOverlay.tsx`) is mounted last in the root
layout (zIndex 300, above the GuideOverlay's 200 and the TopBar), so a running
focus session covers the whole app — see "The focus curtain" under Growth Hub
sections. It renders null unless `focusTimer.isRunning`.

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
  weeklyReviews: WeeklyReview[];             // every closed week, newest last; weekKey doubles as the claim guard
  pearls: number;                            // earned from habits, focus, mission, reflection, weekly review
  userXp: number;                            // pearls *earned* ever — the player rank ladder
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
  claimedAchievements: string[];             // achievement ids whose pearls were claimed
  ownedCats: string[];                       // roster ids adopted from the shelter
  catStats: Record<string, CatStat>;         // per-cat record — serve dates, day parts, bondXp
  cafeVisit: CafeVisitState;                 // who is at (or heading to) the café — the authority on cat presence
  catsWalkedOut: number;                     // cats who gave up waiting; lifetime, so the guide can explain the loss once
  greenhouse: GreenhouseState;               // plants, benches, seed packets, misting
  revealActive: boolean;                     // adoption reveal on screen; never persisted
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
  reflected: boolean;     // daily reflection answered; old day records lack the key, reads treat missing as false
  coinsEarned: number;
  drinksMade: number;     // focus minutes → boba count
  drinksServed: number;   // cats served
  pearlsEarned: number;
}

interface WeeklyReview {
  weekKey: string;        // Monday of the week reviewed (getWeekKey) — also the once-per-week guard
  rating: string;         // option id from the rating row: 'strong' | 'steady' | 'rough' | 'lost'
  highlight: string;      // "what's worth keeping" — the user's own words, kept forever
  intention: string;      // "one aim for next week"
}

interface GuideState {
  seenMessageIds: string[];              // ids of guide beats shown at least once
  mutedMessageIds: string[];             // ids user opted out of ("don't show again")
  lastSeenAt: Record<string, number>;    // per-id timestamp for cooldown checks
  lastShownAt: number;                   // timestamp of any beat, for anti-flicker spacing
  snoozedUntil: number | null;           // if set and in the future, guide stays silent
  lastOpenedDate: string | null;         // dateKey of most recent open, for "welcome back" gap
  lastAcknowledgedLevel: number;         // highest level already congratulated
  caughtUp: boolean;                     // has this save spent its already-true `moment` beats
}

interface FocusTimer {
  durationSeconds: number;      // length of session the user selected
  remainingSeconds: number;     // authoritative while paused; while running, derived from endsAt
  endsAt: number | null;        // ms epoch when session finishes; null when not running
  isRunning: boolean;
  creditedSeconds: number;      // already paid out, so reloads never double-credit
  deepFocus: boolean;           // 2× pearls; locked while running, sticky across resets — a mode, not a checkbox
}

interface TodoItem { id: string; text: string; done: boolean; }

interface CafeVisuals { tableStyle: number; counterStyle: number; rugStyle: number; }

interface Plant {
  id: string;
  species: string;               // id from constants/plants.ts
  slot: number;                  // 0–11, index into getSockets()
  plantedOn: string;             // dateKey
  waterCount: number;            // watered days so far; drives the growth stage
  lastWateredDate: string | null;// one watering per plant per day
  thirst: number;                // consecutive dry days; > spec.dieAfter kills it
  dead: boolean;                 // a husk, until you clear or compost it
  pendingCoins: number;          // earned but not yet tapped to collect
}

interface GreenhouseState {
  plants: Plant[];
  benches: number;               // unlocked benches; locked ones draw bare
  seeds: Record<string, number>; // packets in hand, by species id
  fertilizer: number;
  misting: boolean;              // reservoir keeps plants alive, never grows them
  reservoir: number;
  lastSettledDate: string | null;// dateKey through which thirst was applied
}

interface CafeCustomer {
  id: string;               // unique per visit — `${groupId}-${i}`; the café's cat entity reuses it
  catId: string;            // roster id — who this is out in the town
  groupId: string;          // `visit-${seq}` — groups arrive together and sit together
  setOffAt: number;         // ms epoch it set off; in line WALK_IN_MS (15s) later
  servedAt: number | null;  // ms epoch it got its cup; null while still in line
  patienceMs: number;       // how long it will stand in line before walking out — the one stored, non-derived thing about a visit
}

interface CafeVisitState {
  customers: CafeCustomer[];   // inside or en route — absent means out in the town
  lastArrivalAt: number;       // ms epoch the arrival clock has been advanced to
  arrivalSeq: number;          // groups ever dispatched — id source + deterministic draw seed
}

type PlantResult =
  | { ok: true; plant: Plant }
  | { ok: false; reason: 'seed' | 'occupied' | 'locked' };

type AdoptResult =
  | { ok: true; cat: CatSpec }
  | { ok: false; reason: 'coins' | 'complete' };
```

**Persistence:** Debounced writes to AsyncStorage (250ms delay). Storage key:
`@focus_cafe_state_v2`. On load, the provider runs migrations for legacy habit
formats (old array-based logs → Record-based, old habits without tiers → anchor
default), seeds `ownedCats` for pre-shelter saves via `seedOwnedCats()` (starters
plus one common per `cat-*` item previously bought in the Market), recomputes
popularity decay, and launders `cafeVisit.customers` through `pruneCustomers()`
— dropping customers whose cat left the collection, duplicate cats, and
malformed timestamps. `catStats` is squared up with `ownedCats` by
`backfillCatStats()`, so no owned cat can lack a record, and a save with no
`userXp` rebuilds it with `backfillUserXp()` from the `dailyStats` pearl
tallies it was already keeping — the check is an explicit `typeof … ===
'number'`, because the `{...initialState, ...parsed}` spread would otherwise
hand a missing key initialState's zero and the backfill would never run.

**Pearls move in exactly one place.** `creditPearls(state, amount, dateKey)` —
an internal helper beside `creditCoins`, not an exported action — is the only
thing that touches `pearls`. It moves `pearls`, `userXp` and
`dailyStats.pearlsEarned` in the same commit, which is what keeps a rebuilt
rank equal to a lived one. Eight sites route through it: `addPearl`, the
mission check-in, the reflection claim, the weekly-review claim, the focus
settle, `logHabitRep`, `unlogHabitRep` (negative, so un-logging takes the rank
back too) and `toggleTodo` (negative on the toggle back). See convention 20.

**Initial state:** 100 pearls, 0 coins, level 1, popularity 0, empty habits/logs/todos,
`ownedCats: [...STARTER_CATS]` (mochi, clover, pebble).

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
| `claimReflectionForToday` | `(dateKey: string, pearls: number) => boolean` | +N pearls from reflection, once per day; also stamps `dailyStats[dateKey].reflected` |
| `claimWeeklyReview` | `(review: WeeklyReview) => boolean` | Files one review + `WEEKLY_REVIEW_PEARLS` (40), once per `weekKey`; refuses an empty rating |
| `setFocusDuration` | `(minutes: number) => void` | Changes focus timer length; refuses while running |
| `setDeepFocus` | `(value: boolean) => void` | Toggles deep focus (2× pearls); refuses while running so the rate can't change mid-session |
| `startFocusTimer` | `() => void` | Starts the focus countdown |
| `pauseFocusTimer` | `() => void` | Pauses focus countdown |
| `resetFocusTimer` | `() => void` | Resets focus timer to idle |
| `settleFocusTimer` | `() => boolean` | Tick: awards boba (1/min) + pearls (1/5min, ×2 in deep focus) + popularity; returns `true` on the finishing tick |
| `addPearl` | `(amount?: number) => void` | +pearls |
| `spendPearls` | `(amount: number) => boolean` | −pearls, returns success |
| `addCoins` | `(amount: number) => void` | +coins, auto-levels if coins ≥ level×100 |
| `spendCoins` | `(amount: number) => boolean` | −coins, returns success |
| `addPopularity` | `(amount: number) => void` | Settles decay first, then adds base×caféMultiplier |
| `addDrinkServed` | `(amount?: number) => void` | +popularity for cat served, updates dailyStats |
| `recordCatsServed` | `(catIds: string[], drink: DrinkId) => void` | Stamps the per-cat record (serve dates, day part) and adds bond XP scored against the drink actually handed over |
| `addBoba` | `(type, amount?) => void` | Adds to bobaInventory |
| `addCatToQueue` | `(cat) => void` | Legacy queue cat addition |
| `updateQueueWaitTimes` | `() => void` | Legacy queue time update |
| `serveCustomers` | `(customerIds: string[]) => void` | Stamps `servedAt` on café customers (`markServed`); they linger `LINGER_MS` then go home |
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
| `claimAchievement` | `(achievementId, pearlReward) => boolean` | Adds id to `claimedAchievements` + pays pearls, once |
| `adoptCat` | `() => AdoptResult` | Spends `adoptionCost(ownedCats.length)`, draws an unowned cat, adds it to `ownedCats` |
| `setRevealActive` | `(active: boolean) => void` | Tells guide overlay to hide during an adoption reveal |
| `buySeed` | `(speciesId: string) => boolean` | Spends coins, adds a packet to `greenhouse.seeds` |
| `plantSeed` | `(speciesId, slot) => PlantResult` | Consumes a packet, puts a plant in a socket |
| `waterPlants` | `(plantIds, dateKey?) => {watered, earned, bloom}` | One watering per plant per day; pays the yield at the moment of watering |
| `harvestPlant` | `(plantId: string) => number` | Collects `pendingCoins`; returns what was paid |
| `clearHusk` | `(plantId, compost: boolean) => boolean` | Removes a dead plant, composting for a partial refund |

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
Reflection answer → 4 Pearls/day
         ↓
Weekly review → 40 Pearls/week
         ↓
Pearls → Spent to serve cats (5 pearls per cat)
         │
         └── (earned, not held) → Player rank — 10 titles, buys nothing
         ↓
Serving cats → Coins (25 × bond tip) + Popularity (0.1 per cat) + Bond XP for that cat
         ↓
Bond level → a standing tip on every future cup that cat buys (up to +35%)
         ↓
Coins → Shop upgrades (decor, flavors) ── or ── Cat Shelter adoption (100/pull)
         ↓                                              ↓
Upgrades → Café quality multiplier (1.0×–2.0×)   Adopted cats roam the town
         → More popularity per action             and visit the café
         ↓
Popularity → Cat spawn rate + group size → More cats to serve → More coins
```

Coins have three sinks: café quality (which compounds, via the multiplier), the
shelter (which doesn't compound — it's the collection reward), and the
greenhouse (which pays coins *back*, but only if you keep showing up).

**The greenhouse loop:** buy a seed → drag the pot onto a bench → water it once
a day → it sprouts, grows, matures → tap to collect the coins it banked. Miss
enough days in a row and it dies. Expensive species pay more per watering and
die faster, so the ceiling is set by how reliably you open the app, not by how
many coins you had on day one. That is the whole point: it is the only part of
the economy that can go backwards through neglect alone.

**Focus timer rates:** 1 boba per 60 seconds, 1 pearl per 300 seconds.
These constants are `SECONDS_PER_BOBA` and `SECONDS_PER_PEARL` in `useCafeState.tsx`.
Deep focus doubles the **pearl** payout only — boba and popularity are
unchanged, so the honor-system toggle can't inflate the coin economy.
`WEEKLY_REVIEW_PEARLS` (40) sits between the daily mission (25) and a full
day's routine, priced as the biggest single thought the app asks for.

Two of the arrows above pay in something that isn't a currency. The player's
rank and a cat's bond are both *records of having kept showing up* — one for
the person, one for a relationship — and neither can be bought.

---

## Player rank (constants/userRank.ts)

The one number in the app that measures the person rather than the café.

**It is a rank, not a level.** The word was already spent twice: `state.level`
is the café's, which coins buy and which the greenhouse gates read, and
`bondLevel` is a single cat's. A third thing called a level would make every
"reach level 5" string in the app ambiguous. This one is mostly worn as a
title; the number beside it is small on purpose.

**It buys nothing.** No gate hangs off it, no multiplier reads it. Giving it a
payout would turn the one measure of the person into a thing to farm.

**XP is exactly the pearls you have earned** — `state.userXp`. Not pearls held,
so spending never costs rank; not coins, cups or minutes open, because pearls
are already the currency the economy pays only for real work. Un-logging a
habit takes back its rank XP the same way it takes back its pearls. That
equivalence is what lets `creditPearls` be the single write site (convention
20) and lets an old save rebuild its rank exactly from `dailyStats`.

**Ten ranks, roughly doubling in width.** A full day of the routine pays around
200–250 pearls, so the first title lands on day one and the last is a couple of
months of showing up.

| # | Title | XP | # | Title | XP |
|---|---|---|---|---|---|
| 1 | New here | 0 | 6 | Reliable | 2400 |
| 2 | Settling in | 150 | 7 | Practised | 3600 |
| 3 | Finding a rhythm | 400 | 8 | Seasoned | 5200 |
| 4 | Steady | 850 | 9 | Rooted | 7200 |
| 5 | Regular | 1500 | 10 | Devoted | 9800 |

The titles say nothing about how *much* you did, only how long you have been at
it, because that is the only thing this ladder measures.

**Exports:** `RANKS`, `TOTAL_RANKS`, `rankAt(xp)`, `rankTitle(xp)`,
`rankProgress(xp)` → `RankProgress` (rank, title, nextTitle, fraction, into,
span, remaining, maxed), `backfillUserXp(dailyStats)`, and `RANK_ACCENT`.
Everything is pure and derived — the rank is never stored beside the XP,
because a stored total and its parts eventually disagree.

`rankProgress` returns the whole band in one pass for the same reason
`bondProgress` does: every caller that wants one of these wants three, and
separate helpers over the same argument are separate chances to walk the ladder
inconsistently.

**Where it shows:** the `rank` pill in the TopBar (the number only), and a
`PixelPanel` at the top of the Growth Hub's `renderHub()` — your name, `n / 10`,
the title, a `PixelProgress` filled with `RANK_ACCENT`, and the remainder said
in *pearls* rather than in "XP", which explains the mechanic without a tutorial
and keeps the word XP free for a cat's bond.

`RANK_ACCENT` is not in `ACCENTS`: that map is keyed by Growth Hub section and
the rank isn't one, so a ninth key would owe every `Record<AccentKey, …>` in
the theme an entry it has no use for.

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
**Patience is not one of them.** It briefly was — 150s at pop 0 tightening to
40s at pop 100, on the argument that a busy café should be a harder one. It
lives in `constants/bonds.ts` now, set by the cat's own bond and rarity, and it
is measured in hours. Popularity was already the difficulty knob twice over,
and at hour scale a fuse that shortens as you get busier moved for reasons a
player could not see. What stays here is the *consequence* of a walk-out, which
is a popularity mechanic and remains one.

**The walk-out loss** is `popularityAfterWalkouts(value, n)` —
`value × (1 − 0.02)^n`, proportional for the same reason `decayPopularity` is:
it makes the loss self-limiting, so you can only lose the standing you built. A
flat penalty would be a death spiral at the bottom of the range. It is **not**
scaled by the café multiplier — a nicer room doesn't make an ignored cat
angrier, and a loss scaled by it would quietly make decor a liability.

**It is charged wherever you are** — see convention 21 for why it no longer
needs a screen gate.

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

**Where the sprites are drawn:**
- **Café floor** — `components/catImageCache.ts` rasterises each cat×direction once
  into an `SkImage` through the shared `pixelImage.rasteriseGrid`, cached
  forever. Painting a ~1,000-cell grid per cat per frame is not viable at 60fps.
  The carried boba cups go through the same path (`bobaImageCache.ts`).
- **Town map** — drawn straight onto the 2D canvas by `town/draw.ts`.
- **React (collection, reveal)** — `components/CatSprite.tsx` renders a grid as an
  SVG data-URI `<Image>` via `utils/pixelSvg.ts`. No canvas, no Skia.

> ⚠️ **Everything drawn through `utils/pixelSvg.ts` is invisible on a phone.**
> React Native's `<Image>` decodes PNG/JPEG/GIF/WebP — not SVG — so an SVG
> data-URI renders nothing on iOS or Android. It works on web only, because
> there `<Image>` becomes a browser `<img>`.
>
> Two components are still affected: `GachaMachine.tsx` (the capsule machine)
> and `BobaCupSprite.tsx` (the legacy three-flavour cup). `Icons.tsx` and
> `CatSprite.tsx` have been ported to `PixelSprite` — the currency marks and
> the shelter's collection grid draw on device now.
>
> **The fix is mechanical:** walk the grid with `gridToPaths` and hand the
> result to `components/PixelSprite.tsx`, which emits real `<Path>` elements
> through `react-native-svg`. `Icons.tsx` and `CatSprite.tsx` are both done and
> are the pattern to copy — cache the walk at module load (icons) or in a `Map`
> keyed by sprite (cats), because these mount and unmount constantly.
>
> **Until then, don't add new `pixelSvg` callers** — every one widens the gap.
> See convention 11.

The legacy PNGs in `client/assets/cats/` are no longer referenced.

---

## Café canvas (CafeCanvas.tsx + Cat.tsx + cafeRender.ts + cafePixel.ts + cafePalette.ts + cafeConfig.ts + skiaCanvas2d.ts)

The café floor is a full-screen Skia `<Canvas>` driven by a
`requestAnimationFrame` loop. Each frame is recorded into an `SkPicture`
published as a reanimated `SharedValue`, so Skia repaints without a React
re-render 60 times a second.

**Sizing.** The room is authored **390 wide** and scaled *uniformly*
(`scale = min(layout.width / 390, MAX_SCALE)`), so the art pixels stay square —
stretching each axis to fit gave a 2px pixel non-square edges and squashed the
cats. Only the width is pinned: the height flows
(`designHeight = layout.height / scale`, floored at `MIN_DESIGN_HEIGHT = 720`),
so the floorboards run to the bottom edge of any screen instead of being
letterboxed or cropped. `MAX_SCALE = 1.35` keeps a phone-shaped café
phone-shaped in a wide browser window, centred via `offsetX`.

Everything that positions against the room — `CUP_STATION`, table centres, queue
spots — is in design units and converted through `scale`/`offsetX`.

**The static room is cached.** `drawCafeScene` is recorded once into an
`SkPicture` (re-recorded only when upgrades, palette or room height change) and
replayed with `drawPicture` each frame; only cats, drinks and the drag target
are painted per frame.

### Pixel art (cafePixel.ts + cafePalette.ts)

The café is drawn in the town's idiom: every mark is a filled axis-aligned rect.
`PixelPainter` wraps `Ctx2D` with `rect`/`ellipse`/`ellipseRing`/`softRect`,
rasterising curves into stepped pixel edges. **`PX = 2`** is the art-pixel size,
chosen to match the cat sprites' density (a 28-wide grid drawn at ~47px);
anything finer shimmers once scaled to a device. `noise(x, y, salt)` is
deterministic — `Math.random()` would make the wood grain crawl every frame.

`cafePalette.ts` holds the interior palette and its night variant. Night here is
the **inverse** of the town's: a café is lit from the inside, so the room warms
slightly toward lamplight (`LAMP_STRENGTH = 0.17`) while only what's visible
*through* the glass drops to navy. Dimming the interior the way `town/palette.ts`
does would read as "the café closed". `isNightAt()` is shared with the town;
`CafeCanvas` re-checks it on a 60s timer so a café left open crosses over
without a reload.

**Platform entrypoints:** screens import `CafeCanvasHost`, never `CafeCanvas`.
On web (`CafeCanvasHost.tsx`) Skia is CanvasKit — a WASM module — and the
`Skia` object is undefined until it loads, so `WithSkiaWeb` defers the import;
importing `CafeCanvas` statically is enough to crash on the first `Skia.*`
call. On native, Metro resolves `CafeCanvasHost.native.tsx`, which re-exports
`CafeCanvas` directly since Skia is linked into the binary. The WASM load is
scoped to this screen so the rest of the app never waits on a payload it
doesn't use.

Drawing code targets `Ctx2D` from `skiaCanvas2d.ts` and stays
platform-agnostic — see convention 6.

### Café visits are state (constants/cafeVisit.ts)

Who is in the café lives in `state.cafeVisit`, not in the canvas. The queue
used to be a `CafeCanvas`-local array rebuilt from nothing on every mount —
the town map couldn't show anyone waiting, and the same cat could roam the
streets while standing in line. Presence is now the **authority on where every
owned cat is**: listed means inside (or walking over), absent means out in the
town. The café renders this list, the town renders its complement, and neither
screen invents a cat of its own.

A visit stores two timestamps and one duration; every phase is derived from
the clock, never stored:

```
sets off ──(WALK_IN_MS 15s)──▶ in line ──served──▶ lingers ──(LINGER_MS 60s)──▶ gone
`setOffAt`                       │        `servedAt`
                                 └──(patienceMs)──▶ walks out unserved
```

`patienceMs` is the one thing about a visit that is **stored rather than
derived**, and for the same reason `recordCatsServed` takes the drink: it
cannot be recovered afterwards. The window comes from the cat's bond at the
moment it set off (`patienceWindowMs` in `bonds.ts`), and a bond moves —
derive it live and serving one cat would retroactively extend the wait of the
cat standing behind it, and a levelling serve would make a cat already out the
door un-leave. Stamped once at the door, `setOffAt + WALK_IN_MS + patienceMs`
is a fixed instant and the phase is still just the clock passing it.

The predicates that read it: `leavesAt`, `hasWalkedOut`, `hasFinished`,
`patienceLeft` (1 → 0 across the wait, and a flat 1 for anyone holding a cup)
and `impatientCustomers`.

**The queue does not empty from the front, and that is the feature.** A window
used to be floored at the deadline of whoever was last to leave, so the line
always drained in order. Per-cat patience makes that floor a contradiction:
flooring Prism's half hour at the four hours a well-bonded common is owed
erases the difference the mechanic exists to express. A cat now leaves on its
own clock, from wherever it is standing, and `CafeCanvas` already draws that
honestly — a departing cat steps sideways into `QUEUE_EXIT_AISLE` before
heading for the door, so the sprite you watch leave is the one that gave up.

**One floor survives, at `now + patience`.** A catch-up admits cats with a
`setOffAt` in the past, so a replay can land one on the mat with a minute left:
you open the app, tap it, and it walks before you can pour anything. Patience
measures being **ignored**, and nobody could have served it while the app was
shut, so a cat that survives the replay has its window measured from the moment
you could first have seen it. The floor is gated on `natural > now` — applying
it to a cat whose replayed window closed mid-catch-up would resurrect one that
came and went, and the sweep is what keeps "you come back to whoever happens to
be there" true.

**Where you read it: the inspect card, not the floor.** Tapping a queueing cat
opens `CatInspectCard` with a `PATIENCE` row directly above its bond — how long
you have to decide, then what the decision is worth. It was briefly a bar drawn over the cat
itself; nine of them at once read as a room full of alarm, where the whole
point is that most of the queue is fine and one cat isn't. It is the same
reason the want bubble went — the floor is not where per-cat detail belongs. The row
ticks itself on an interval it owns (the card is deliberately never re-rendered
by either canvas's loop) — 10s normally and 250ms inside the last quarter hour,
because four ticks a second across a three-hour window is forty thousand
renders to animate a number that changes once a minute. It is left off the card
entirely for a town cat or one already holding a cup.

- **Arrivals are settled, not scheduled.** `settleCafeVisit(visit, now,
  popularity, ownedCats, catStats)` is pure and idempotent: it sweeps out finished
  lingerers, then walks the arrival clock forward one
  `spawnIntervalMs(popularity)` at a time, admitting a group per tick while
  there's room. The provider runs it every 5s and on load, so the café fills
  at the same rate whether or not anyone is watching.
- **A week away is the same as four hours away, and patience is why.** The
  rewind is capped at `WALK_IN_MS + MAX_PATIENCE_MS + QUEUE_CAPACITY ×
  WALK_STAGGER_MS` — anything called in earlier than the longest window anyone
  has has provably already left, so replaying it would only be a loop iteration
  ending in the sweep. The bound uses the *global* maximum rather than this
  café's typical window, because it has to hold for whichever cat the draw
  picks, and guessing low would silently drop a patient cat still owed its
  spot. This is the visible cost of the rule: leave the café overnight and you
  come back to whoever turned up in the last few hours, not to everyone who
  ever knocked.
- **Group members set off `WALK_STAGGER_MS` (3s) apart**, so every derived
  view is single-file for free: the town badge ticks 1, 2, 3 and the café door
  admits one cat at a time. A tail member's `setOffAt` legitimately sits a few
  seconds in the future; `pruneCustomers` allows up to
  `QUEUE_CAPACITY × WALK_STAGGER_MS`.
- **Caps.** `QUEUE_CAPACITY = 9` (matches the queue spots) and
  `maxInside(owned) = min(9, max(1, ceil(owned / 2)))` — half the collection
  may visit at once, so the town never empties. An unserved customer holds a
  line spot from the moment it sets off. Occupancy inside the arrival loop is
  asked as of `cursor`, not of `now`, so a queue of cats who left hours ago
  can't block a catch-up.
- **Draws are deterministic** — `roll(arrivalSeq)`, no `Math.random()` —
  because the settle runs inside a state updater React may invoke twice per
  commit. Same rule as the gacha (convention 13).
- `markServed` stamps `servedAt` (reached through the `serveCustomers`
  action); `pruneCustomers` launders the list on load.

Both screens animate *against* the shared stamps. The town walks the roamer to
the café door inside the `WALK_IN_MS` window and despawns it when `hasJoined`
flips; the café spawns the cat through its own door on the same flip, so the
handoff needs no event. The badge on the town's café building shows
`countWaiting(visit, now)` — cats who finished the walk and haven't been
served — and hides at zero.

### Cat entity (Cat.tsx)

```typescript
interface Cat {
  id: string;              // the CafeCustomer id this entity mirrors
  catId: string;           // which roster cat this is — from the customer
  groupId: string;
  x: number; y: number;
  targetX: number; targetY: number;
  speed: number;           // 3 pixels/frame
  size: number;            // 30 (width = size * 1.8 * scale; height follows the 28×37 grid)
  state: CatState;         // 'walkingToLine' | 'waiting' | 'walkingToSeat' | 'seated' | 'leaving'
  seatIndex: number | null;
  seatFacing: 'front' | 'left' | 'right' | null;
  seatedAt: number | null; // timestamp when seated
  drink: BobaFlavor | null;// the cup handed over, carried until they leave
  scale: number;           // current draw scale, eased toward targetScale
  targetScale: number;     // 1 standing; SEAT_SCALE once they take a chair
  path: QueueSpot[];       // corners to turn before `target`, consumed one at a time
}
```

**Cat functions:** `createCat()`, `updateCat()` (per-frame movement + scale
easing), `retargetCat()` (reposition in queue), `sendCatToSeat()`,
`sendCatOut(cat, exitX, exitY, via)`, `isCatOffscreen()`, `drawCat(ctx, cat)`
(sprite + contact shadow), `drawCatDrink(ctx, cat)` (the carried cup).

**A cat that gives up leaves by the aisle.** Everything else in the room walks
in a straight line, and only one departure can't: the queue is single-file down
the middle, so a cat walking out from the *front* has the whole rest of the line
between it and the door. Walked straight it passes through every cat behind it,
and the sprite you watch reach the door is the one at the back — the wrong cat
looks like the one that gave up. `sendCatOut` therefore takes `via` corners,
which `syncCustomers` fills in for queue cats only (`QUEUE_EXIT_AISLE`, 66 units
to the left, then down past the last queue spot). A cat going home from a table
already has a clear run and passes none.

`drawCatDrink` runs as a **separate pass** after every cat is drawn: group cats
stand 28 apart and are ~54 wide, so a cup drawn with its own cat disappeared
under the neighbour painted next.

**Seated cats shrink.** `SEAT_SCALE` is `0.86` at the back chair and `0.74` at
the side chairs — a seated cat is further into the room, and at full size it
stood taller than the table. `updateCat` eases `scale` toward `targetScale`
rather than snapping, so they shrink into the chair while walking over.
`sendCatToSeat` aims the cat's **feet** at the chair (deriving the offset from
the sprite's actual height) instead of applying a fixed lift, which is what left
tall cats hovering and short ones sunk into the tabletop. `BACK_SEAT_NUDGE`
offsets the middle chair a few pixels down and right so its occupant tucks in
against the table.

`drawCat` pulls its `SkImage` from `catImageCache.getCatSkImage(cat.catId,
direction)` — it takes no sprite argument. Sprites are **not** square: height is
`width * catAspectRatio(catId)` off the 28×37 grid, and the shadow ellipse is
anchored at the feet rather than the centre.

**Who visits:** whoever `state.cafeVisit` says — the render loop's
`syncCustomers` mirrors the customer list into cat entities. A customer whose
`hasJoined` flip is still pending waits in a spawn queue and walks through the
door the frame it comes due; one whose visit ended (or vanished — a prune, a
reset) is sent out and despawned. On mount, mid-visit customers are rebuilt
already in line — a catch-up arrival from while the app was shut snaps
straight to its spot instead of replaying the walk.

### Table layout (cafeConfig.ts)

10 tables — 5 on the left, 5 on the right. The two columns are deliberately
**out of phase**: with matching rows on both sides the floor read as a
spreadsheet and the eye counted rows instead of seeing a room.

| ID | X | Y |
|---|---|---|
| L1 | 68 | 272 |
| L2 | 102 | 358 |
| L3 | 64 | 446 |
| L4 | 106 | 530 |
| L5 | 80 | 616 |
| R1 | 322 | 300 |
| R2 | 288 | 388 |
| R3 | 326 | 472 |
| R4 | 284 | 556 |
| R5 | 310 | 640 |

### Seating (cafeRender.ts)

Each table gets 3 seats: `middle` (y-36), `left` (x-34, y-6), `right` (x+34, y-6).
Total: 30 seats. These are the exact coordinates `drawTable` paints the chairs
at — when the two drifted apart, every cat sat *beside* its chair.

### Queue system

Queue spots are vertically spaced at `y = 268 + i*46`, centered at `width/2` —
a single-file line, `QUEUE_CAPACITY` (9) positions. A cat is ~71 tall, so at
the old 36 spacing the line stacked into one mound of ears.

**Cat state machine:** `walkingToLine → waiting → walkingToSeat → seated → leaving`

**Group behaviour:**
- Group size rolls against `maxGroupSize(popularity)` inside `settleCafeVisit`
  — the canvas no longer runs a spawn timer of its own
- Groups share a `groupId` and file in `WALK_STAGGER_MS` apart, single-file

**Seating preferences:**
- Served one at a time, seated one at a time: 80% of first-seaters want an
  empty table, the rest join an occupied one — but a cat whose groupmate
  already holds a chair takes an open seat at *that* table
- A served cat sits with its drink for `LINGER_MS` (60s); the settle then
  sweeps the visit and `syncCustomers` sends the cat out

### Serving is a gesture, not a button

You drag the boba cup off the counter and hand it to the cat at the front of
the line. There is no Serve button.

- The cup lives at `CUP_STATION` and is a React `Animated.View` over the canvas
  (`BobaCupSprite` → `gridToSvgUri`), not something the canvas draws
- Drop test: the front cat against the cup's vertical centre line (top → base)
  within `DROP_RADIUS` — any visible cup-over-cat overlap counts. Testing only
  the cup's base point missed whenever the cup's body covered the cat
- **One cat per drag.** Costs `PEARLS_PER_CAT` (5); awards 25 coins + 1 drink
  served (→ popularity), stamps the customer via `serveCustomers([id])`, and
  sends that cat to a seat. The line steps forward for the next drag
- The hint pill is honest: "Drag to serve ◆5" when the front cat is servable,
  "Need ◆5 to serve" when a cat is waiting but pearls are short — a mute
  refusal reads as broken, not idle
- Each served cat keeps `drink`, the flavour you actually handed over, and sips
  it down through four fill levels over the minute it sits
- The cup is **always** draggable. Gating the gesture on "is anyone waiting"
  meant it silently refused to move, which reads as broken rather than idle — it
  now lifts, finds nobody, and springs back
- The `PanResponder` is built **once** in a ref and reads `canServe`, the serve
  function and the view transform through refs. Rebuilding it per render hands
  it a stale `serveFrontGroup` mid-drag, and the drag pays pearls against a
  snapshot of the queue. Both `pan` and `bob` run with `useNativeDriver: false`:
  `setValue` during a drag can't share a transform with a native-driven spring

### Visual styles (cafeRender.ts)

Two style variants each for tables, counter, and rug. Controlled by `visuals.tableStyle`,
`visuals.counterStyle`, `visuals.rugStyle` (each 1 or 2). Upgradeable via the shop.

- **Option 1 tables:** mint-cushioned chairs
- **Option 2 tables:** gold-rimmed marble top, rose-cushioned chairs. Cream
  cushions sat at the tabletop's own value and read as blank discs, so the
  upgraded seats separate by hue instead of brightness
- **Option 1 rug:** sage runner with diamond motifs — the room's only cool hue,
  which is what stops the floor reading as one monotone tan band
- **Option 2 rug:** terracotta, banded at the two ends. Stripes repeated the
  whole way down turned the runner into a ladder
- Both rugs sit just *above* the floor's value, never well above it: as the
  palest thing in the room the runner stopped being a rug and became a stripe of
  light down the middle

Shop decor is wired into the room: `decor-lights` hangs string lights,
`decor-plants` puts potted plants at the counter ends, `decor-paintings` hangs
frames on the wall.

---

## Guide system (constants/guideScript.ts + hooks/guideEngine.ts + components/GuideOverlay.tsx)

Sage — the rare sage-green cat from the roster — is the one talking. Every line
in `guideScript.ts` is written as her speaking, and `GUIDE_CAT_ID` names her so
the overlay can draw her portrait. She stays adoptable in the shelter: the point
is that the tips come from a cat you can go and take home, not from the game.

**How it works:**
1. `GuideOverlay` re-evaluates every 5 seconds and on every state change
2. `resolveGuideMessage()` filters eligible beats (not muted, past cooldown, `match()` passes)
3. Highest priority wins; ties broken by script order
4. Once shown, one-time beats never return; repeatable beats respect `cooldownHours`
5. A beat belongs to the screen it resolved on — changing route or `guideContext`
   clears it rather than letting it ride along into the next room

### `GuideKind` — what a beat is, which decides when it may interrupt

| Kind | Band | Behaviour |
|---|---|---|
| `moment` | 40–59, big ones 85–100 | Celebrates something that just happened. Its match stays true forever after, so `catchUpSeenIds` spends these silently on any save that already satisfies them (see below) |
| `orientation` | 60–79, on-demand 80–82 | "Here's what this screen is." Fires while you stand on the thing it describes, and outranks moments for exactly that reason |
| `nudge` | 1–35 | A recurring reminder. Gated on `inTown(ctx)` — the map is the only screen where a reminder isn't interrupting something |

`catchUpSeenIds(state)` (in `guideEngine.ts`) runs **once per save**, guarded by
`guide.caughtUp`. It marks every already-true one-time `moment` as seen without
showing it, and rolls `lastAcknowledgedLevel` to the current level. Without it,
any save older than a beat fires a queue of congratulations for things it did
weeks ago, four seconds apart, on whatever screen happens to be open. A fresh
save matches none of them and loses nothing.

`consumesContext: true` marks beats summoned by a button press (they match on a
one-shot `guideContext`). Dismissing clears that context, or the beat re-fires
the moment the 4s anti-flicker gap lapses and can never be got rid of.

### Complete guide beat table

| ID | Kind | Priority | Repeatable | Cooldown | Match condition |
|---|---|---|---|---|---|
| `welcome-first-open` | orientation | 100 | no | — | No beats ever seen |
| `welcome-back` | moment | 92 | yes | 12h | 2+ days since last open |
| `level-up` | moment | 88 | yes | — | Level > lastAcknowledgedLevel |
| `focus-session-complete` | orientation | 82 | yes | 0h | `guideContext === 'focus:complete'` |
| `focus-why-breaks` | orientation | 80 | yes | 0h | `guideContext === 'focus:breaks'` |
| `focus-good-break` | orientation | 80 | yes | 0h | `guideContext === 'focus:goodBreak'` |
| `habits-first-visit` | orientation | 72 | no | — | On habits:hub |
| `cafe-first-visit` | orientation | 71 | no | — | On /cafe route |
| `mission-first-visit` | orientation | 70 | no | — | On habits:mission, mission empty |
| `focus-first-visit` | orientation | 69 | no | — | On habits:focus |
| `shelter-first-visit` | orientation | 68 | no | — | On /cats route |
| `greenhouse-first-visit` | orientation | 67 | no | — | On /greenhouse route |
| `shop-first-visit` | orientation | 66 | no | — | On /shop route |
| `calendar-first-visit` | orientation | 65 | no | — | On habits:calendar |
| `todo-first-visit` | orientation | 64 | no | — | On habits:todo |
| `reflection-first-visit` | orientation | 63 | no | — | On habits:reflection |
| `achievements-first-visit` | orientation | 62 | no | — | On habits:achievements |
| `resources-first-visit` | orientation | 61 | no | — | On habits:resources (the Library) |
| `review-first-visit` | orientation | 60 | no | — | On habits:review |
| `habit-streak-7` | moment | 52 | no | — | Any habit has 7-day streak |
| `habit-streak-3` | moment | 51 | no | — | Any habit has 3-day streak |
| `first-cat-walked-out` | moment | 49 | no | — | `catsWalkedOut > 0` |
| `first-cat-served` | moment | 48 | no | — | Total drinks served > 0 |
| `first-habit-completed` | moment | 47 | no | — | Any habitLog has reps > 0 |
| `first-habit-created` | moment | 46 | no | — | habits.length > 0 |
| `first-mission-checkin` | moment | 45 | no | — | missionLastClaimedDate set |
| `first-focus-session` | moment | 44 | no | — | totalFocusMinutes ≥ 1 |
| `greenhouse-thirsty` | nudge | 30 | yes | 10h | In town, a live plant unwatered today |
| `boba-waiting-to-serve` | nudge | 26 | yes | 6h | In town, 3+ boba on hand, nothing served today |
| `weekly-review-due` | nudge | 24 | yes | 20h | In town, it's Sunday, current `weekKey` unreviewed |
| `mission-unclaimed-today` | nudge | 22 | yes | 20h | In town, has mission, not checked in today |
| `no-focus-yet-today` | nudge | 18 | yes | 20h | In town, after 1pm, no focus today |
| `mission-empty-nudge` | nudge | 14 | yes | 48h | In town, no mission set |
| `time-of-day-greeting` | nudge | 1 | yes | 20h | In town (lowest-priority fallback) |

Nudges that navigate deep-link into a Growth Hub section
(`/habits?section=mission`), because the hub keeps its section in local state
and `/habits` alone always lands on the grid — "check in now" used to drop you a
tap short of the thing it named.

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

The Growth Hub is a single screen (~2170 lines) with a local `section` state:

```typescript
type HubSection = 'hub' | 'habits' | 'mission' | 'reflection' | 'review' | 'focus'
                | 'calendar' | 'resources' | 'todo' | 'achievements';
```

(`resources` is the Library's internal key — the tile says "Library", but the
key stays because the accent, icon and guide context all hang off the name.)

### The pixel UI kit (components/pixel/ + constants/pixelTheme.ts + constants/pixelIcons.ts)

The hub is drawn in the same idiom as the café and the town: hard edges, flat
fills, bevels instead of shadows. It used to be a pastel settings menu with
24–28px radii, translucent gloss bars and Unicode dingbats, which is what made
it look like it belonged to a different app than the pixel cats it rewards you
with.

| Component | What it is |
|---|---|
| `PixelPanel` | The one container. Light edge top/left, dark edge bottom/right, `borderRadius: 0`. `behind` bites four corner pixels in the parent's colour — the pixel-art way to round |
| `PixelButton` | A pressable panel. Presses **instantly** by exactly `BEVEL` and inverts the bevel; no easing, because pixel UI has no sub-pixel positions to ease through. `style` sizes the pressable, `contentStyle` pads the face |
| `PixelText` | Pixel font by default; `plain` drops to the system font for prose. Sizes come from `TYPE` and are quantised to multiples of 4 — a pixel face blurs off-grid |
| `PixelIcon` | A 12×12 grid through `utils/pixelSvg.ts`, coloured per section accent — **web-only, see convention 12** |
| `PixelProgress` | Sunken well, flat fill, snapped to whole percent |
| `PixelChip` | A bevelled square label — replaces the `borderRadius: 999` pills |
| `PixelToggle` | A sliding switch: sunken track, square knob that **jumps** (no easing), accent-coloured when on |
| `PixelToast` | Transient confirmation bar — parent owns the `ToastValue`, component owns the 2.2s hold. The `Alert.alert` replacement (convention 22) |
| `usePixelMaterial` | The day/dusk material, re-checked on a 60s timer |

**One material, nine accents.** `PixelMaterial` carries the whole surface
(`face`, `faceLt`, `faceDk`, `sunk`, `ink`, `inkDim`, `track`, `trackEdge`).
The material is **sky paper** — light blue (`#EFF5FB` ground, `#D8E7F4` face,
`#2F4C68` ink). It was matcha green for a while; the blue reads calmer next to
the pastel accents and stops the hub competing with the town's grass for the
same hue. Sections identify themselves with an accent stripe and an icon, not
a fill: pastel fills all at the same value read as equally important things,
which is the flatness this replaced.

| Section | Accent | Ink |
|---|---|---|
| Habits | `#E7A9C8` | `#8A4A67` |
| Mission | `#74A8DC` | `#38617D` |
| Reflection | `#E4C983` | `#7A6230` |
| Review | `#E89F9F` | `#8A4444` |
| Calendar | `#B8A5EF` | `#4C3A7A` |
| To-Do | `#E8B38E` | `#8A5A33` |
| Focus | `#9FD5BF` | `#2F6B54` |
| Achievements | `#E3C26B` | `#7A6230` |
| Resources (Library) | `#9FDCCB` | `#2F6B54` |

Mission's accent deepened from `#8FC2E1` when the material went blue — a pale
blue stripe on a blue face sat within a step of it and the tile lost its
identity.

`ACCENT_FILLS` is a third set — each accent pushed a third toward its ink.
Accents sit about one value step from the face, so an accent-on-face fill
(the icons' interiors) disappeared entirely without it.

`PixelIcon` goes through `utils/pixelSvg.ts`, which convention 12 warns is
web-only. It is on that path deliberately, alongside `Icons.tsx`, `CatSprite`
and `GachaMachine`: moving one call site to `react-native-svg` would add a
dependency and leave three others broken. The migration wants to take all four
together.

**Typography.** `assets/fonts/HandjetBubble.ttf` is Handjet baked at
`ELGR 1 / ELSH 16 / wght 800` — a static instance, because variable-font axes
aren't reliable on native. Headings, labels and numbers are set in it; body
prose stays in the system font. The font is loaded by `useFonts` **inside
`app/habits/index.tsx`**, not the root layout, and the screen holds its first
paint until it resolves — swapping it in late reflows every label and the
numbers visibly jump.

The pixel face covers Latin and punctuation but not arrows or checkmarks, so
the hub uses ASCII chevrons (`<` `>`) and draws "done" as a filled well rather
than a tick glyph. A missing glyph falls back to the system font mid-line,
which is louder than the plainer mark.

**Dusk, not dark mode.** `materialAt()` switches to `NIGHT_MATERIAL` on the
same `isNightAt()` clock as the town and café (7pm–6am). It stays dark-ink-on-
light-ground and only deepens toward evening sky — it is not a user-facing
theme switch, so convention 8 still holds. The focus curtain below is the one
deliberate dark surface in the app: it is a curtain, not a theme.

### The today strip

The hub leads with a "today" panel above the destinations: habits done out of
total, a progress well, and three rows — habits, mission, reflection. Each row
is itself a `PixelButton` that jumps into its section, and dims when that
thing is finished for the day. The hero card it replaced answered nothing and
still took the top of the screen.

### Sections

| Section | Key render function | What it shows |
|---|---|---|
| `hub` | `renderHub()` | The today strip + a grid of 9 accented `PixelButton` tiles |
| `habits` | `renderHabits()` (inline) | Today progress ring, habit tiles grouped by tier (via `TIER_ORDER`), a `−` un-log control on logged tiles, "+ New habit" button |
| `mission` | `renderMission()` | Mission TextInput + save button, daily check-in (+25 pearls) |
| `reflection` | `renderReflection()` | `getReflectionPromptForDate(todayKey)` — rotating daily question, 12 prompts, every answer a flat 4 pearls |
| `review` | `renderReview()` | Weekly review — rate the week (2×2 grid), keep one thing, aim one thing; +40 pearls once per `weekKey`; past weeks kept as a journal |
| `focus` | `<FocusSection />` | Timer presets (5/15/25/45 min), the Deep Focus toggle (2× pearls), start/pause/reset, break guidance; dev grants only under `__DEV__` |
| `calendar` | `renderCalendar()` | Month view with prev/next, an accent bar under logged days, tap-to-drill-down stats (Habits / Mission / Reflected / Pearls); future days disabled |
| `todo` | `renderTodo()` | Text input, add button, list with check/delete |
| `resources` | `renderResources()` | The Library — today's principle + shelves of credited ideas from real books (`constants/library.ts`), each with a try-it jump into a section |
| `achievements` | `renderAchievements()` | 32 achievements grouped by category, filter chips, claim pills |

**The section state is a `useState`, not a route.** Navigating to `/habits`
always lands on the hub grid first. The "< Back to Hub" button resets to hub.
The `useEffect` calls `setGuideContext('habits:${section}')` whenever section changes.

Feedback on any action in here is a `PixelToast` — "Mission saved", "Checked
in · +25 pearls", "Week closed · +40 pearls" — never an `Alert.alert`, which
react-native-web renders as nothing at all (convention 22). The habit form's
delete is the same rule in another shape: a two-step confirm on the button
itself (armed for 4 seconds, second tap deletes) instead of a native dialog.

### The focus curtain (components/FocusOverlay.tsx)

Starting a focus session drops a full-screen night sky over the entire app —
stars, the countdown, a daily companion cat "holding your seat", the boba
earned so far, and exactly one button: **Stop focusing**. The root is a
`Pressable` that swallows every touch, so nothing behind it is reachable; the
point is that the phone goes face-down. It uses its own hardcoded `NIGHT_SKY`
material — the deliberate dark exception noted under convention 9.

The overlay also **owns the 1-second settle tick** (plus the finish
vibration and the `'focus:complete'` guide context). It used to live in
`FocusSection`, which unmounts when you leave the hub — a session only paid
out while you stood on the Focus screen. The overlay is mounted in the root
layout and exists exactly while `isRunning`, so the tick and the session now
share a lifetime by construction.

**Deep Focus** is a `PixelToggle` on the Focus section: 2× pearls, locked
while the clock runs (`setDeepFocus` refuses, so the rate can't be flipped
just before a 5-minute boundary), sticky across resets. Today it is an
honor-system promise about attention — the copy says so — with real
app-blocking planned for native.

### How to add a new Growth Hub section (step-by-step)

1. **Add to the type union** in `app/habits/index.tsx`:
   ```typescript
   type HubSection = '...' | 'yourSection';
   ```

2. **Add an entry to `HUB_TILES`** — the key must be both a `HubSection` and a
   `SectionIconKey`, which is what keeps the tile and its icon from drifting:
   ```typescript
   { key: 'yourSection', title: 'Your Section', sub: 'Description' },
   ```

3. **Add an accent and a 12×12 icon grid** — a colour in `ACCENTS` and
   `ACCENT_INKS`/`ACCENT_FILLS` (`constants/pixelTheme.ts`), and a grid in
   `SECTION_ICONS` (`constants/pixelIcons.ts`) keyed by the same name.

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
- **Fountain (Growth Hub entry):** tile (8, 63)

### Every door is in the south

`BUILDINGS` is ordered north to south, and **everything carrying a `route`
lives in the bottom third of the map.** A phone is held low and gripped at the
bottom; the top of a 92-tile map is the hardest part of the screen to reach,
and that is exactly where the civic buildings used to be — the map opened on
the outskirts and you scrolled *up* to reach the app.

| ID | Position (tile) | Size (tiles) | Label | Route |
|---|---|---|---|---|
| `market` | (31, 49) | 5×4 | Market | `/shop` |
| `shelter` | (18, 52) | 5×4 | Cat Shelter | `/cats` |
| `library` | (6, 55) | 6×5 | Library | `/habits` |
| `cafe` | (29, 56) | 5×5 | Café | `/cafe` |
| `mission` | (16, 61) | 5×5 | Mission Hall | `/habits` |
| `archive` | (15, 69) | 5×4 | Archive | `/habits` |

The fountain and the greenhouse (`GREENHOUSE`, tile (28, 67)) share that band —
both are daily visits. The two lowest and most central doors are the ones you
open most: the fountain and the café.

North of it is scenery: inn, shrine, grocer, workshop, bakery, observatory,
nursery and **7** houses. There used to be 15, and a map that is mostly
anonymous cottages reads as a place full of doors that don't open. The paving
blobs and the street spine were re-weighted to match — the town's mass sits
under the thumb rather than trailing off into a narrow southern tail.

`EMPTY_PLOTS` is down to **2**, both in the northern half. The south is spoken
for, and a plot is a promise rather than a destination.

### Wandering cats on the town map (town/roam.ts)

The cast is `state.ownedCats` **minus whoever is inside the café**
(`catsInside(state.cafeVisit, now)`), capped at `MAX_ROAMERS = 16` (the cap
lives in `TownMap.tsx`). There is no fixed list and no separate unlock path —
a cat you haven't adopted exists nowhere in the app, and a cat in the café is
never simultaneously on the streets.

Visits move cats between the two worlds. `syncRoamers` handles state-object
changes — a visit vanishing mid-walk, a finished visitor respawning at the
café door — while the frame loop watches the clock: a customer's `setOffAt`
coming due sends its roamer walking to the café door (`sendRoamerToCafe`), and
`hasJoined` flipping despawns it, its spot remembered. The café building wears
a `countWaiting` badge, hidden at zero, so a full line is visible from the map.

Cats don't step randomly. Each picks a destination across town and follows a
breadth-first route over walkable tiles (`S` stone, `R` road, `o` paved plots),
which is what makes them cover the map — a random walk drifts outward only as
√steps, so half the town never saw one. Positions are floats in **tile units**;
pixels are purely a rendering concern.

Tiles within `HEAD_CLEARANCE = 2` above a building footprint are non-walkable,
because a cat is drawn ~2 tiles tall on a 1-tile footprint and would otherwise
push its head through the brickwork.

Key exports: `Roamer`, `walkableTiles()`, `createRoamers()`, `stepRoamers()`.

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
- `roam.ts` — roamer state, walkable-tile graph, BFS routing, per-frame stepping
- `palette.ts` — day/night palettes, `isNightAt()`, `nightPalette()`, `dimForNight()`
- `canvasPainter.ts` — thin canvas abstraction (web path; native would swap in Skia)

---

## Shop data (constants/cafeData.ts)

### Shop items

| ID | Title | Price (coins) | Category |
|---|---|---|---|
| `flavor-mango` | Mango Boba | 30 | flavors |
| `flavor-taro` | Taro Boba | 30 | flavors |
| `decor-plants` | Plant Decor | 40 | decor |
| `decor-lights` | String Lights | 60 | decor |
| `decor-paintings` | Wall Art | 50 | decor |
| `upgrade-seating` | Better Seating | 100 | upgrades |
| `upgrade-counter` | Modern Counter | 120 | upgrades |

**7 items.** The Market used to sell three `cats` items (`cat-orange`,
`cat-white`, `cat-green`, 50 coins each) that only incremented a counter. Cats
now come from the Cat Shelter as real roster cats you own; existing saves
migrate those purchases into the collection via `seedOwnedCats()`. The
`cats` category no longer exists in the shop.

Only `decor` and `upgrades` affect the café quality multiplier — 5 qualifying
items, unchanged by the cat removal.

### Legacy cat roster (`CATS_DATA`)

7 cats: Luna 🐈‍⬛, Whiskers 🧡, Mittens 🤍, Sage 💚, Jazz 🟠, Shadow ⬛, Sunny 🌟.
Still exported, tied to the legacy `queue` field. The café canvas draws its
visitors from `state.cafeVisit` instead and does not read this.

`state.queue`, `addCatToQueue` and `updateQueueWaitTimes` now have **no callers
at all** — the last one was the focus timer, which used to push a cat onto the
queue and fire an `Alert.alert` that react-native-web never renders. Deleting
them is a separate cleanup.

### Reflection prompts

**12** rotating daily questions, 4 options each — mission alignment, biggest
win, hardest moment, focus, energy, attention, what tomorrow-you needs, what
almost stopped you, what you'd repeat for a year, what you learned about
yourself, which habit felt lightest, what deserves more time.

**Every option pays the same flat `REFLECTION_PEARLS` (4).** The old set paid
2–5 scaled to how well the day went, which bribed the flattering answer on the
one screen whose whole value is honesty. The reward is for reflecting, not for
having had a good day — the section footer says exactly that.

Selection uses `daysSinceEpoch % REFLECTION_PROMPTS.length` so the prompt
rotates daily and stays stable throughout the day.
`claimReflectionForToday` also stamps `dailyStats[dateKey].reflected`, which
the calendar drill-down and the `reflect-7` achievement read.

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

## Cat Shelter / adoption (constants/gacha.ts + app/cats/index.tsx)

The coin sink that turns the 36-cat roster into a collection. Route `/cats`,
two local tabs: `type Tab = 'adopt' | 'collection'`.

### Draw rules

- **Cost:** `adoptionCost(ownedCount)` — a hand-priced ladder of
  `10, 25, 50, 100`, where 100 is a **ceiling**, not a waypoint: every
  adoption from the sixth cat on costs 100. 3,085 coins for the full set. The
  ramp exists to stop the opening cats costing the same as the last legendary;
  once it's done that, climbing further would just tax the players who stuck
  around longest, and the tail of the collection is already the hard part on
  rarity alone. Derived from the collection rather than a stored counter, so
  there's no new state field and existing saves price themselves on load.
- **No duplicates.** `pickCat()` filters to unowned cats before rolling, so a
  pull is never wasted and the collection always completes.
- **Rarity first, then cat.** The rarity bucket is chosen by weight and the cat
  uniformly within it, so the odds describe the rarity you get rather than
  being diluted by how many cats share it.
- **Weights renormalise** over whichever rarities still have unadopted cats —
  once the commons run out, their share redistributes across the rest.

| Rarity | Weight | Cats |
|---|---|---|
| common | 60 | 12 |
| rare | 25 | 10 |
| epic | 11 | 8 |
| legendary | 3.5 | 5 |
| ultra | 0.5 | 1 |

- **Starters:** `STARTER_CATS = ['mochi', 'clover', 'pebble']` — three commons,
  enough that the town isn't empty on day one without gifting anything rare.
- **`AdoptResult`** is `{ok: true, cat}` or `{ok: false, reason: 'coins' | 'complete'}`.

**Everything in `gacha.ts` is pure** — no React, no state, no `Math.random()`.
Rolls arrive as parameters, because `adoptCat` calls the draw from inside a
state updater that React may invoke more than once per commit. `adoptCat` rolls
once outside the updater and the updater re-checks `coins` and ownership before
committing, so a double invocation can't double-charge or double-grant.

### Other exports

- `seedOwnedCats(unlockedItems)` — migration for pre-shelter saves
- `catsOwnedByRarity(ownedIds)` — per-rarity progress for the Collection headers
- `TOTAL_CATS`, `RARITY_WEIGHTS`

### Presentation

- `components/GachaMachine.tsx` — pixel capsule machine (36×54 grid from
  `constants/gachaMachine.ts`), animated crank and capsule drop, `forwardRef` +
  `useImperativeHandle` so the screen triggers the animation
- `components/AdoptionReveal.tsx` — full-screen reveal; sets `revealActive` so
  the guide overlay stays out of the way
- `components/CatSprite.tsx` — collection grid sprites via `utils/pixelSvg.ts`

---

## Cat bonds (constants/bonds.ts)

Serve a cat drinks it actually likes and it warms to you. A cat that has warmed
to you tips, and it waits for you. It is the shelter's answer to "what is this
cat *for*" once it is adopted and roaming: the collection stops being a
checklist and starts being a set of regulars.

The two payouts are the same idea pointed at money and at time, and neither can
be bought — bond XP only moves when you hand a cat a drink it actually wanted.

**One number per cat.** `bondXp` lives on `CatStat` in `constants/catLore.ts`,
alongside the serve dates and day-part tallies, and is written in exactly one
place — `recordCatsServed`. Level and tip are **derived** from it, never
stored, for the same reason `catLore` refuses to keep a `served` total beside
its `parts`: a stored total and the parts it came from eventually disagree, and
only one of them can be right.

**XP per cup is the drink's pearl value times the affinity multiplier** —
`serveOutcome(spec, drink).xp` from `constants/affinity.ts`. Handing a cat its
favourite therefore builds the bond several times faster than handing it
something it merely tolerates, which is the whole point: the bond is a record
of paying attention, not of volume.

**Five levels, and rarity sets the road length, not its shape.** `BOND_CURVE`
is front-loaded at every rarity — level 2 is cheap enough that a new player
sees the number move on their first afternoon, and the last level is the long
one:

| Rarity | L2 | L3 | L4 | L5 |
|---|---|---|---|---|
| common | 40 | 120 | 240 | 400 |
| rare | 70 | 210 | 420 | 700 |
| epic | 110 | 330 | 660 | 1100 |
| legendary | 170 | 510 | 1020 | 1700 |
| ultra | 280 | 840 | 1680 | 2800 |

**The tip is a standing multiplier on that cat's coins**, from `BOND_TIP`:

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Tip | — | +5% | +10% | +20% | +35% |

The ceiling is deliberately below the affinity multiplier (a favourite pays
×2.0). A maxed bond should never be worth more than giving a cat the right
drink, or the optimal play becomes grinding one cat with whatever is cheapest.

**The tip paid is the bond you walked in with.** The serve reads `bondTip`
*before* `recordCatsServed` adds the cup's XP — see convention 19.

### Patience — the other thing a bond buys

How long a cat stands in line before it gives up and walks out.

It used to be seconds and set by popularity, which made the café a reflex test:
a cat you couldn't reach in two minutes was a cat you lost, so the only way to
keep a café was to sit and watch one. That argues against the rest of the
product. **30 minutes to 4 hours** argues for it — the café fills while you are
away and coming back to it is the visit, the same shape as the greenhouse. You
lose cats by forgetting for a day, not by looking away for a minute.

The knock-on: arrivals are paced by *you* now. The café fills to `maxInside`
and holds there until you serve someone, so the loop runs at the speed you show
up at rather than at the speed of a spawn timer.

**Rarity sets the base and it runs downward; bond multiplies it.** Rarity is
otherwise pure upside — better tips, longer bond road, nicer sprite — and this
is the one place it costs you. The fancy cat has places to be. Bond is the
answer to that cost: a legendary you have never served is a 45-minute problem,
one you have taken care of waits an hour and a half.

`BOND_PATIENCE` is `1 / 1.15 / 1.35 / 1.6 / 2` — deliberately steeper than
`BOND_TIP`, which tops out at +35% because it competes with the affinity
multiplier. Nothing competes with patience, so it can afford to double, and it
is the level reward you *feel* first: a few extra coins is arithmetic you have
to go looking for, whereas an ultra that suddenly waits an hour is the
difference between catching it and not.

| Rarity | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| common | 2h | 2h 18m | 2h 42m | 3h 12m | **4h** |
| rare | 1h 30m | 1h 43m | 2h | 2h 24m | 3h |
| epic | 1h 05m | 1h 15m | 1h 28m | 1h 44m | 2h 10m |
| legendary | 45m | 52m | 1h | 1h 12m | 1h 30m |
| ultra | **30m** | 34m | 40m | 48m | 1h |

The corners are the range exactly: ultra at L1 is 30 minutes, common at L5 is
four hours.

**Exports:** `MAX_BOND_LEVEL`, `BOND_TIP`, `BOND_CURVE`, `xpToMax(rarity)`,
`bondLevel(xp, rarity)`, `bondTip(xp, rarity)`, `bondProgress(xp, rarity)` →
`BondProgress` (level, fraction, into, span, remaining, maxed), and
`tipLabel(level)` → `"+15%"` or `"—"`; and for patience, `BOND_PATIENCE`,
`MAX_PATIENCE_MS`, `patienceWindowMs(xp, rarity)` and `patienceLabel(ms)` →
`"3h 12m"` / `"42m"` / `"50s"` (two units at most, and the second dropped once
it stops mattering). Pure — no React, no state, and read from inside state
updaters that React may invoke more than once per commit.

**Where it shows:** `CatInspectCard`'s bond row (`Lv n` plus the tip), reached
by tapping a cat on the town map or the café floor; `CatAlmanacSheet`'s bond
card (level of 5, tip label, progress to the next); and the collection grid in
`app/cats/index.tsx`.

**What the café pays today.** The serve in `CafeCanvas` is
`serveOutcome(spec, drink, { bondTip: tip }).coins` — the drink's own base
coins, times what this cat thinks of it, times the tip. It used to be a flat
`25 * (1 + tip)`, which meant affinity moved bond XP but never money.

It changed because the brew machine's menu quotes the arithmetic to the coin.
A payout preview that names a number the till does not pay is worse than no
preview, so the preview and the serve read the same function. Same rule as
`PayoutBadge`, which dropped its popularity line for failing it: **popularity
is still the flat `addDrinkServed(1)`, not `serveOutcome().popularity`**, so
neither the badge nor the menu panel mentions popularity at all. Routing it
through affinity is a separate change, and one that has to pick a single path
— `addDrinkServed` already applies the café multiplier and `serveOutcome`
does not, so doing both double-counts.

---

## Achievements (constants/achievements.ts)

32 achievements across 6 categories, surfaced as the `achievements` Growth Hub
section.

Each has a `check(state)` predicate evaluated against **existing** state — no
per-event counters were added, so old saves light up retroactively. The
conditions are monotonic (you can't un-serve a cat), so earned stays earned.
`check` receives an `AchievementCheckState`, a flattened view the caller maps
once, rather than the full `CafeState`.

Claiming pays `pearlReward` once; claimed ids live in `state.claimedAchievements`.

| Category | Count | Tint | Edge | Ink |
|---|---|---|---|---|
| Habits 🌱 | 6 | `#D9F5EA` | `#9FD5BF` | `#2F6B54` |
| Streaks 🔥 | 6 | `#FFDDBF` | `#E8B38E` | `#8A5A33` |
| Focus ⏱ | 4 | `#CFEAFF` | `#8FC2E1` | `#38617D` |
| Café ☕ | 6 | `#FFD7EA` | `#E7A9C8` | `#8A4A67` |
| Cats 🐾 | 4 | `#DDD2FF` | `#B8A5EF` | `#4C3A7A` |
| Economy 🪙 | 6 | `#FFF0BE` | `#E4C983` | `#7A6230` |

`tint`/`edge`/`ink` extend the `tint`/`ink` convention from `habitTiers.ts`.
`CATEGORY_BY_ID` is the lookup map.

The three newest — `reflect-7` (Inner Mirror), `review-first` (Week One,
Closed), `review-4` (A Month in the Books) — read `totalReflections` (counted
off `DailyStat.reflected`, with a ≥1 fallback for pre-field saves that have
`reflectionLastClaimedDate` set) and `totalWeeklyReviews`
(`state.weeklyReviews.length`) on `AchievementCheckState`.

**Rendering:** earned cards fill with the category tint and take the app's hard
shadow; locked ones ghost the emoji to `opacity: 0.28` rather than showing a
padlock; the claim pill is pearl-purple (`#C8B6F2`).

---

## The Library (constants/library.ts)

The old "Resources" placeholder, replaced with real content: **12 principles
across 6 books** — Atomic Habits (4), The 7 Habits of Highly Effective People
(4), Deep Work (2), The Compound Effect (1), Tiny Habits (1) — each written in
the app's own words and **credited to its book and author**. A `Principle`
carries a `tryIt` line and a `section` key, so every card ends in a pixel
button that jumps straight into the hub section where you'd act on it
(guarded by a `SECTION_KEYS.has` check so a bad key can't navigate).

`principleForDate(dateKey)` rotates one principle to the top of the screen as
"TODAY'S PRINCIPLE", same daily-modulo scheme as the reflection prompts;
`sourceOf(principle)` resolves the credit line.

**Reading pays no pearls, by design.** Every other section pays for *doing*;
paying for scrolling text would teach checking the Library as a chore. The
first-visit guide beat says it out loud: the good ideas pay out somewhere
else in town.

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
- **Retro pixel buttons**: the Focus section used to draw its own gold/sky/pink rounded
  rects; it now uses `components/pixel/PixelButton` like the rest of the hub

### Colour families
- **Hub / Growth:** sky blues (`#EFF5FB` ground, `#D8E7F4` face, `#2F4C68` ink) with one pastel accent per section (see the accent table)
- **Café / retro:** warm creams, browns, golds (`#F8F1E7`, `#4E3226`, `#E7B85C`)
- **Town map:** greens, earth tones (`#A8C98C` grass, `#E0CCAE` road, `#EFE0CA` stone)
- **Shop / shelter / soft-card screens:** the pinks and lavenders of `colors.ts`

### Typography
- System font for prose; the Growth Hub and habit form set headings, labels and
  numbers in `HandjetBubble` (see the pixel kit's Typography note)
- Weights: 700 for labels, 800 for titles/buttons, 900 for large numbers
- Soft-card sizes: 9–11 for captions/pills, 12–13 for body, 15–17 for headers;
  the hub uses the quantised `TYPE` scale instead

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
function getWeekKey(dateKey: string): string;
// dateKey of the Monday of the containing week — the weekly review's claim key
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

**Note on the port.** `.claude/launch.json` hardcodes `--port 8090` in
`runtimeArgs`, so `autoPort` cannot help — Expo tries 8090, finds it busy, and
bails non-interactively. Changing ports requires editing **both** the `--port`
flag and the `port` field. Parallel sessions therefore each have to edit a
checked-in file, which is why `launch.json` frequently shows up dirty and
should generally not be committed with a session-local port.

---

## What exists and what doesn't

### Built and working
- Town map with day/night cycle, 28 buildings, cats roaming via BFS pathing
- Full café floor rendered through Skia as pixel art in the town's idiom —
  plank floor, woven runner, counter with espresso machine and boba jars,
  windows onto the town, chalk menu board, day/night lighting (2 visual style
  variants), with cats arriving from the town, queuing single-file, seating
  and one-drag-one-drink serving
- Growth Hub with all 9 sections (habits, mission, reflection, weekly review,
  focus, calendar, todo, library, achievements), on the pixel kit's sky-blue
  material with `PixelToast` feedback throughout
- Three-tier habit system with rep logging, un-logging, streaks, pearl math
  (budget + per-rep models), and a pixel-kit habit form with a two-step delete
- Focus timer with boba/pearl payouts, break guidance, a Deep Focus mode
  (2× pearls, locked while running), and a full-screen focus curtain
  (`FocusOverlay`) that blocks the whole app until you stop
- Mission statement with daily check-in (+25 pearls)
- Daily reflection with rotating prompts (12 questions, every answer a flat 4 pearls)
- Weekly review (+40 pearls, once per week): rate the week, keep one thing,
  aim one thing — past weeks kept as a journal, nudged on Sundays
- The Library: 12 credited principles from real self-help books with try-it
  jumps into the sections (`constants/library.ts`)
- Popularity system (10%/day proportional decay, café multiplier 1.0–2.0×, spawn pacing)
- Shop with 7 items across 3 categories (flavors, decor, upgrades)
- Achievements: 32 across 6 categories, retroactive `check` predicates, pearl claims
- Full guide/tutorial system with 27 contextual beats
- Procedural cat sprite system (36 cats, 5 rarities, 9 patterns, 8 directions),
  wired into the café via `catImageCache`, the town via `town/draw.ts`, and
  React via `CatSprite`
- Cat Shelter: gacha adoption on a 10 → 100 price ladder that caps at 100, no duplicates, rarity-weighted draw
  (`constants/gacha.ts`), pixel capsule machine, full-screen reveal, 36-cat collection
- Adopted cats are the only cats in the app — they roam the town and visit the café
- Café visits as shared state (`constants/cafeVisit.ts`): two timestamps per
  visit, phases derived from the clock, settled every 5s from the provider —
  town roamers walk to the door and hand off to the café floor, a waiting
  badge sits on the town's café building, and no cat exists in both worlds at
  once
- Patience: a queued cat carries a stamped window — 30 minutes to 4 hours, set
  by its rarity and multiplied by its bond — shows what is left of it on the
  inspect card above that bond, and walks out unserved through the side aisle
  rather than back down the queue, costing 2% of standing per cat
- Persistent state with migrations (legacy array logs → record-based, old habits → tiered,
  pre-shelter saves → seeded collection)
- Greenhouse: 12 sockets across 3 benches, 9 species with per-species growth
  and fragility, daily watering by dragging the can, harvest-by-tap, husks and
  composting, a misting reservoir that keeps plants alive without growing them,
  and a day/night room lit by sun or by grow lamps
- TopBar with currency pills persistent across all screens
- Player rank (`constants/userRank.ts`): 10 titles off pearls *earned*, a
  TopBar pill and a Growth Hub panel, backfilled for old saves from
  `dailyStats` — and buying nothing, on purpose
- Cat bonds (`constants/bonds.ts`): per-cat XP scored against the drink's
  affinity, five derived levels on a per-rarity curve, and a standing coin tip
  up to +35% shown on the inspect card, the almanac and the collection

### Not yet built
- **Verified native iOS/Android builds** — the Skia path, `app.json` config, and
  `.native.tsx` entrypoints are in place, but no build has been run end to end
- **Porting the `pixelSvg` components off SVG data-URIs** — the currency icons,
  cat collection grid, capsule machine and boba cup render nothing on device.
  See the warning in the cat sprite section
- Real app-blocking during Deep Focus — the toggle is honor-system today; the
  2× rate and the copy already promise the native blocking that comes later
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
5. **The Growth Hub is drawn with the pixel kit.** New hub UI uses
   `components/pixel/*` and the material from `usePixelMaterial()`, never a
   `borderRadius`, a gradient or a hardcoded pastel. Colour is passed at render
   time because it changes at dusk; a `StyleSheet` is frozen at module load, so
   the local `pixel` sheet holds layout only. The habit form converted with the
   hub; the shop and cat shelter are still on the soft-card styles — both
   languages coexist until those convert.

6. **The Growth Hub uses local section state, not routes.** Adding a new section
   means: add to `HubSection` type → add an entry to `HUB_TILES` → give it an
   accent and an icon grid → add render function → add conditional in JSX
   return → set `guideContext` in `useEffect`.

7. **Canvas rendering is imperative.** The café and town map draw through a 2D
   context directly. Don't try to use React components inside them. The café's
   context is `Ctx2D` — Skia behind a Canvas2D-shaped facade
   (`components/skiaCanvas2d.ts`), which is deliberately **not** a general
   polyfill: it implements only what the café uses. Reaching for a 2D API the
   café doesn't already call means adding it to the shim first, or it works on
   web and breaks on native.
8. **The guide system is data-driven.** Add new beats to `GUIDE_SCRIPT` in
   `guideScript.ts` — the engine picks them up automatically based on priority
   and match conditions. Section matching uses `onHabitsSection(ctx, sectionName)`.
9. **No dark mode.** The app has a fixed warm-light palette. `useColorScheme`
   exists but the root layout sets a fixed background (`#FFF7F2`). The hub's
   dusk material is not an exception: it follows the world clock the town and
   café already follow, and stays dark ink on a light ground.
10. **New state fields need migration.** When adding fields to `CafeState`, add
   defaults in `initialState` and handle the case where older saves don't have
   the field (the spread `...initialState, ...parsed` covers simple cases).
11. **Focus timer uses `endsAt` (absolute timestamp), not a decrementing counter.**
    This survives unmounts, app restarts, and throttled intervals. Pausing stores
    `remainingSeconds`; running derives remaining from `endsAt - Date.now()`.
    Offline time is never credited — a session mid-run at close comes back paused.
    The 1s settle tick lives in `FocusOverlay` (mounted in the root layout, alive
    exactly while `isRunning`), never in a screen that can unmount mid-session.
12. **Don't build new pixel art on `utils/pixelSvg.ts` — it is web-only.**
    It encodes a grid to an SVG data-URI rendered by a React Native `<Image>`,
    and **`<Image>` decodes PNG/JPEG/GIF/WebP, not SVG.** On iOS and Android it
    renders nothing at all; it only ever worked because `<Image>` becomes a
    browser `<img>` on web. See the warning in the cat sprite section for what
    is currently broken because of this.

    For anything new, draw the grid as `<Rect>` elements with `react-native-svg`
    instead — one code path that works everywhere. The café canvas is the
    separate exception: it needs `SkImage`s, so `pixelImage.rasteriseGrid` draws
    a grid once into an offscreen Skia surface and the caches
    (`catImageCache.ts`, `bobaImageCache.ts`) keep the snapshot forever. A 28×37
    grid is ~1,000 cells; painting that per cat per frame at 60fps is not
    viable.
13. **Draw functions that may run inside a state updater must be pure.** The
    adoption draw (`constants/gacha.ts`) takes its rolls as parameters and calls
    no `Math.random()`, because React can invoke an updater more than once per
    commit. Roll outside the updater; re-check preconditions inside it.
14. **The greenhouse has no render loop, and should not grow one.** Nothing in
    that room moves on its own — plants change once a day, when you water them
    — so the scene is recorded into `SkPicture`s and replayed. The room picture
    is re-recorded only when size, palette or bench count changes; the frame
    picture only when a plant does. Adding a `requestAnimationFrame` there
    would cost a repaint per frame to draw a still life.
15. **The trough lips are drawn after the plants, not with the bench.**
    `drawGreenhouseScene` deliberately omits them and `drawBenchFronts` paints
    them in a later pass, because they have to overlap the pots — that overlap
    is the only reason a plant looks planted rather than placed. Folding them
    back into the bench silently un-sinks every pot.
16. **The greenhouse's back wall is limewash and its floor is a short strip.**
    It was brick, the full height, and the room collapsed into one warm
    mid-value field with the pots and the benches. Limewash is quiet by
    construction — but a wall alone gives the room no ground, so anything meant
    to be standing on the floor floats. `floorRunY()` is the line where that
    stops, it is anchored to the last bench rather than to the screen bottom,
    and floor-level clutter belongs on it.
17. **Never hand `drawImage` the fill paint.** Skia ignores a paint's RGB when
    drawing an image but still applies its **alpha**, so sharing `fillPaint`
    painted every sprite at whatever opacity the last `fillStyle` happened to
    carry — a 22% contact shadow set just before a cat left the cat 22% opaque.
    `skiaCanvas2d.ts` keeps a separate `imagePaint` for this reason.
18. **Cat presence is derived from `cafeVisit`, never invented on a screen.**
    A visit is two timestamps; walking over / in line / lingering are read off
    the clock, so the café floor and the town map cannot disagree about where
    a cat is. Both canvases *mirror* the customer list — anything that changes
    presence goes through `settleCafeVisit` / `markServed` / `pruneCustomers`
    in `constants/cafeVisit.ts`, and neither screen spawns, despawns or
    reassigns a cat on its own authority.
19. **A bond pays the tip you walked in with.** The café serve reads
    `bondTip(...)` *before* calling `recordCatsServed`, which is what adds this
    cup's XP. Reading it after would mean the cup that levels a cat quietly
    pays twice for the same drink — once at the old rate for being served, and
    again at the new one it just bought. The same ordering applies anywhere
    else a derived reward and the thing that feeds it are settled together.
20. **Pearls are credited in exactly one place.** `creditPearls` in
    `useCafeState.tsx` moves `pearls`, `userXp` and `dailyStats.pearlsEarned`
    in one commit. A new pearl payout must go through it: crediting `pearls`
    directly leaves the player's rank behind, and crediting `pearlsEarned`
    directly makes `backfillUserXp` disagree with the live total for every save
    that ever migrates. `spendPearls` is the deliberate exception — spending is
    not un-earning — and so is `claimAchievement`, which is a receipt for work
    whose pearls, and whose rank XP, were paid when the work was done.
21. **The walk-out penalty's bound is the timescale, not a screen gate.**
    `settleVisit` used to take a `watching` argument, fed from a ref the café
    screen set on mount, and charged only while you were stood at the counter.
    The reason was that at forty-second windows the arithmetic had no bound of
    its own: if you never serve, walk-outs equal arrivals *forever* — a steady
    state, not a spiral — so a per-cat charge on an app left open drained about
    forty points an hour at popularity 75. That would have made popularity a
    measure of how much café you play rather than of how much life you did.

    Patience in hours supplies that bound directly. A café holds `maxInside`
    cats and each takes half an afternoon to give up, so the worst case is a
    few points an hour; and a return from a long absence charges for at most
    one caféful, because the catch-up sweeps cats who came and went without
    ever landing in state. **A week away costs exactly what a day away costs.**

    With the bound in the timescale, the gate became unreachable — you would
    have to be standing on the café screen at the instant a three-hour window
    closed — so it is gone, along with `setCafeOpen` and `cafeOpenRef`. Losing
    a cat is never a reflex you missed now; it is a day you didn't open the
    app, which is exactly the thing the charge should be reading.
22. **`Alert.alert` is a silent no-op on react-native-web.** Never reach for it.
    Confirmation feedback goes through `PixelToast` — the parent owns the
    `ToastValue`, the component owns the 2.2s hold — and destructive confirms
    are inline two-step buttons like the habit form's delete (armed for 4s,
    second tap acts). A dialog that renders as nothing reads as the button
    being broken, which is worse than no dialog at all.
