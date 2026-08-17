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
    │   ├── _layout.tsx      # root layout (CafeProvider, TopBar, GuideOverlay, Stack)
    │   ├── index.tsx        # TownScreen — the home screen (pixel-art town map)
    │   ├── cafe/index.tsx   # CafeTab — Skia café floor with cats, queue, serve button
    │   ├── habits/index.tsx # HabitsTab — the "Growth Hub" (~2130 lines, all 8 sections + hub grid)
    │   ├── shop/index.tsx   # ShopTab — coin-based shop (flavors, decor, upgrades)
    │   ├── cats/index.tsx   # CatsTab — the Cat Shelter (Adopt + Collection tabs)
    │   └── habit-form.tsx   # modal form for creating/editing habits
    │
    ├── components/
    │   ├── CafeCanvas.tsx   # Skia game loop — cat spawning, queuing, seating, serving
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
    │   ├── AdoptionReveal.tsx  # Full-screen reveal after an adoption
    │   ├── CurrencyBar.tsx  # Coins + Pearls bar (unused — replaced by TopBar pills)
    │   ├── FocusSection.tsx # Focus timer UI — rendered as a Growth Hub section
    │   ├── GuideOverlay.tsx # Animated bottom sheet — name prompt + contextual guide beats
    │   ├── Icons.tsx        # Coin / Pearl / Popularity pixel icons as SVG data-URIs
    │   ├── PopularityMeter.tsx  # Popularity bar shown on the café screen
    │   ├── TopBar.tsx       # Persistent top bar — brand, back button, coin/pearl/level pills
    │   ├── TownMap.tsx      # Pixel-art town map component (canvas-rendered)
    │   ├── cafeConfig.ts    # Café layout constants — 10 table center coordinates
    │   ├── cafePixel.ts     # PixelPainter — the café's rect-only pixel-art primitives
    │   └── cafeRender.ts    # The room — floor, rug, wall, windows, counter, tables, door
    │
    ├── constants/
    │   ├── achievements.ts  # 29 achievements across 6 categories + category colour defs
    │   ├── bobaCup.ts       # Generated 20×30 boba cup grid — 3 flavours, variable fill
    │   ├── cafeData.ts      # Legacy cat roster (7), shop items (7), reflection prompts (4), café levels (5)
    │   ├── cafePalette.ts   # Café interior palette + its night variant
    │   ├── catSprites.ts    # Procedural pixel-art cat system — 36 palettes, 9 patterns, grid assembly, roster of 36 cats
    │   ├── colors.ts        # Shared colour palette (cream, brown, gold, pastels, etc.)
    │   ├── gacha.ts         # Adoption draw — rarity weights, pickCat, starters, save seeding
    │   ├── gachaMachine.ts  # Pixel art for the capsule machine (36×54 grid, crank, capsules)
    │   ├── guideScript.ts   # All guide beats — 25 contextual messages with priority/match/cooldown
    │   ├── habitTiers.ts    # Keystone/Anchor/Quick tier definitions, pearl math functions
    │   └── popularity.ts    # Popularity system — decay, gains, café multiplier, spawn pacing
    │
    ├── hooks/
    │   ├── guideEngine.ts   # Guide resolution engine — picks highest-priority eligible beat
    │   ├── useCafeState.tsx  # THE state file (~1500 lines) — CafeProvider, all actions, persistence, migrations
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
    │   ├── date.ts          # Date key helpers, streak computation, habit log types
    │   └── pixelSvg.ts      # Shared grid → SVG data-URI encoder (icons, cats, machine)
    │
    ├── scripts/
    │   └── copy-canvaskit.js  # postinstall — stages the CanvasKit WASM payload for web
    │
    ├── assets/
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
| `/habit-form` | Habit Form | From Growth Hub → Habits → "+ New habit" or long-press a habit tile |

The **TopBar** (`components/TopBar.tsx`) is rendered outside the Stack in `_layout.tsx`
so it persists across all screens. It shows:
- "Homebase" brand text on the map, "‹ Town" back button on sub-screens
- The current screen title (Café, Market, Growth Hub, Cat Shelter)
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
  claimedAchievements: string[];             // achievement ids whose pearls were claimed
  ownedCats: string[];                       // roster ids adopted from the shelter
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

type AdoptResult =
  | { ok: true; cat: CatSpec }
  | { ok: false; reason: 'coins' | 'complete' };
```

**Persistence:** Debounced writes to AsyncStorage (250ms delay). Storage key:
`@focus_cafe_state_v2`. On load, the provider runs migrations for legacy habit
formats (old array-based logs → Record-based, old habits without tiers → anchor
default), seeds `ownedCats` for pre-shelter saves via `seedOwnedCats()` (starters
plus one common per `cat-*` item previously bought in the Market), and recomputes
popularity decay.

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
| `claimAchievement` | `(achievementId, pearlReward) => boolean` | Adds id to `claimedAchievements` + pays pearls, once |
| `adoptCat` | `() => AdoptResult` | Spends 100 coins, draws an unowned cat, adds it to `ownedCats` |
| `setRevealActive` | `(active: boolean) => void` | Tells guide overlay to hide during an adoption reveal |

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
Coins → Shop upgrades (decor, flavors) ── or ── Cat Shelter adoption (100/pull)
         ↓                                              ↓
Upgrades → Café quality multiplier (1.0×–2.0×)   Adopted cats roam the town
         → More popularity per action             and visit the café
         ↓
Popularity → Cat spawn rate + group size → More cats to serve → More coins
```

Coins have two sinks: café quality (which compounds, via the multiplier) and
the shelter (which doesn't compound — it's the collection reward). Only the
first feeds back into the loop.

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
> Four components are affected today: `Icons.tsx` (coin/pearl/star pills),
> `CatSprite.tsx` (the shelter's whole collection grid), `GachaMachine.tsx`
> (the capsule machine), and `BobaCupSprite.tsx` (the cup you drag to serve).
> On a device the top bar loses its currency icons, the Cat Shelter shows an
> empty grid, and the café's serve gesture has nothing to grab.
>
> **The fix is mechanical:** emit `<Rect>` elements with `react-native-svg`
> instead of encoding a data-URI. The `ios-town-skia` branch does exactly this
> for the currency icons (`Icons.tsx` + `iconGrids.ts`) — copy that pattern.
> The other three still need porting, since the Cat Shelter and the pixel-art
> café both landed after the device work started.
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
replayed with `drawPicture` each frame; only cats, drinks, want-bubbles and the
drag target are painted per frame.

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

### Cat entity (Cat.tsx)

```typescript
interface Cat {
  id: string;
  catId: string;           // which roster cat this is — drawn from state.ownedCats
  groupId: string;
  x: number; y: number;
  targetX: number; targetY: number;
  speed: number;           // 3 pixels/frame
  size: number;            // 30 (width = size * 1.8 * scale; height follows the 28×37 grid)
  state: CatState;         // 'walkingToLine' | 'waiting' | 'walkingToSeat' | 'seated' | 'leaving'
  seatIndex: number | null;
  lineOffsetX: number;
  seatFacing: 'front' | 'left' | 'right' | null;
  seatedAt: number | null; // timestamp when seated
  drink: BobaFlavor | null;// the cup handed over, carried until they leave
  scale: number;           // current draw scale, eased toward targetScale
  targetScale: number;     // 1 standing; SEAT_SCALE once they take a chair
}
```

**Cat functions:** `createCat()`, `updateCat()` (per-frame movement + scale
easing), `retargetCat()` (reposition in queue), `sendCatToSeat()`,
`sendCatOut()`, `isCatOffscreen()`, `drawCat(ctx, cat)` (sprite + contact
shadow), `drawCatDrink(ctx, cat)` (the carried cup).

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

**Who visits:** each spawned cat picks a random id from `state.ownedCats`. A
player with nothing adopted gets no visitors at all — in practice impossible,
since the collection is seeded with three starters.

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

Queue spots are vertically spaced at `y = 268 + i*46`, centered at `width/2`.
Up to 9 queue positions. A cat is ~71 tall, so at the old 36 spacing the line
stacked into one mound of ears.

**Cat state machine:** `walkingToLine → waiting → walkingToSeat → seated → leaving`

**Group behaviour:**
- Cats spawn in groups of 1–3 (based on `maxGroupSize(popularity)`)
- Groups share a `groupId` and stay together through queue → seating
- Auto-spawn interval: `spawnIntervalMs(popularity)`, self-rescheduling

**Seating preferences:**
- Groups prefer empty tables; solo cats 80% prefer empty, 20% join occupied
- Cats leave after 60s seated

### Serving is a gesture, not a button

You drag the boba cup off the counter and hand it to the cat at the front of
the line. There is no Serve button.

- The cup lives at `CUP_STATION` and is a React `Animated.View` over the canvas
  (`BobaCupSprite` → `gridToSvgUri`), not something the canvas draws
- Drop test: nearest cat in the front group within `DROP_RADIUS` of the cup's
  **base** — you set the cup down in front of them
- Costs 5 pearls per cat in the front group; awards 25 coins per cat + 1 drink
  served (→ popularity), then sends the group to assigned seats
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
| `shelter-first-visit` | 32 | no | — | On /cats route |
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

The Growth Hub is a single screen (~2130 lines) with a local `section` state:

```typescript
type HubSection = 'hub' | 'habits' | 'mission' | 'reflection' | 'focus'
                | 'calendar' | 'resources' | 'todo' | 'achievements';
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
| Achievements | `tileGold` | `#FFE7A3` | `#E3C26B` | `#D6B052` |

`tileGold` is deliberately a deeper amber than Reflection's `tileButter` so the
two don't read as the same tile.

**ThreeDButton component anatomy:**
- Shadow layer: `tileShadowLayer` (48% width, 4px bottom margin)
- Face: `tileFace` (min-height 142, border-radius 24, 1.2px border, 7px shadow offset)
- Gloss overlay: `tileGloss` (25% white, 24px tall, rounded, positioned at top)
- Press animation: `Animated.timing` → translateY 5px on press-in, spring back on release
- Dimming: `tileDimmed` (opacity 0.55) — signals "nothing left to do here today"

### Sections

| Section | Key render function | What it shows |
|---|---|---|
| `hub` | `renderHub()` | Grid of 8 ThreeDButton tiles + hero card |
| `habits` | `renderHabits()` (inline) | Today progress ring, habit tiles grouped by tier (via `TIER_ORDER`), "+ New habit" button |
| `mission` | inline in return | Mission TextInput + save button, daily check-in (+25 pearls) |
| `reflection` | inline in return | `getReflectionPromptForDate(todayKey)` — rotating daily question with 4 multiple-choice answers (2–5 pearls each) |
| `focus` | `<FocusSection />` | Timer presets (5/10/15/25/45/60 min), start/pause/reset, break guidance |
| `calendar` | inline in return | Month view with prev/next, per-day habit count dots, tap-to-drill-down stats |
| `todo` | inline in return | Text input, add button, list with check/delete |
| `resources` | inline in return | "Coming soon" placeholder cards |
| `achievements` | `renderAchievements()` | 29 achievements grouped by category, filter chips, claim pills |

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
| `shelter` | (17, 34) | 5×4 | Cat Shelter | `/cats` |

Other buildings (inn, bakery, observatory, grocer, workshop, nursery, shrine,
15 houses) are scenery — no route yet. 4 empty plots rendered as dirt rings
with signposts.

The shelter is sited beside the café and market rather than on one of the
southern empty plots, since it's somewhere you visit often and those plots are
a long scroll from everything else.

### Wandering cats on the town map (town/roam.ts)

The cast is **exactly `state.ownedCats`**, capped at `MAX_ROAMERS = 16`. There
is no fixed list and no separate unlock path — a cat you haven't adopted exists
nowhere in the app.

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
Still exported, tied to the legacy `queue` field. The café canvas draws roster
cats from `ownedCats` instead and does not read this.

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

## Cat Shelter / adoption (constants/gacha.ts + app/cats/index.tsx)

The coin sink that turns the 36-cat roster into a collection. Route `/cats`,
two local tabs: `type Tab = 'adopt' | 'collection'`.

### Draw rules

- **Cost:** `PULL_COST_COINS = 100`
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

## Achievements (constants/achievements.ts)

29 achievements across 6 categories, surfaced as the `achievements` Growth Hub
section.

Each has a `check(state)` predicate evaluated against **existing** state — no
per-event counters were added, so old saves light up retroactively. The
conditions are monotonic (you can't un-serve a cat), so earned stays earned.
`check` receives an `AchievementCheckState`, a flattened view the caller maps
once, rather than the full `CafeState`.

Claiming pays `pearlReward` once; claimed ids live in `state.claimedAchievements`.

| Category | Count | Tint | Edge | Ink |
|---|---|---|---|---|
| Habits 🌱 | 4 | `#D9F5EA` | `#9FD5BF` | `#2F6B54` |
| Streaks 🔥 | 5 | `#FFDDBF` | `#E8B38E` | `#8A5A33` |
| Focus ⏱ | 4 | `#CFEAFF` | `#8FC2E1` | `#38617D` |
| Café ☕ | 6 | `#FFD7EA` | `#E7A9C8` | `#8A4A67` |
| Cats 🐾 | 4 | `#DDD2FF` | `#B8A5EF` | `#4C3A7A` |
| Economy 🪙 | 6 | `#FFF0BE` | `#E4C983` | `#7A6230` |

`tint`/`edge`/`ink` extend the `tint`/`ink` convention from `habitTiers.ts`.
`CATEGORY_BY_ID` is the lookup map.

**Rendering:** earned cards fill with the category tint and take the app's hard
shadow; locked ones ghost the emoji to `opacity: 0.28` rather than showing a
padlock; the claim pill is pearl-purple (`#C8B6F2`).

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
  variants), with cat spawning, queuing, seating and drag-to-serve
- Growth Hub with all 8 sections (habits, mission, reflection, focus, calendar,
  todo, resources, achievements)
- Three-tier habit system with rep logging, streaks, pearl math (budget + per-rep models)
- Focus timer with boba/pearl payouts and break guidance
- Mission statement with daily check-in (+25 pearls)
- Daily reflection with rotating prompts (4 questions, 2–5 pearls)
- Popularity system (10%/day proportional decay, café multiplier 1.0–2.0×, spawn pacing)
- Shop with 7 items across 3 categories (flavors, decor, upgrades)
- Achievements: 29 across 6 categories, retroactive `check` predicates, pearl claims
- Full guide/tutorial system with 25 contextual beats
- Procedural cat sprite system (36 cats, 5 rarities, 9 patterns, 8 directions),
  wired into the café via `catImageCache`, the town via `town/draw.ts`, and
  React via `CatSprite`
- Cat Shelter: 100-coin gacha adoption, no duplicates, rarity-weighted draw
  (`constants/gacha.ts`), pixel capsule machine, full-screen reveal, 36-cat collection
- Adopted cats are the only cats in the app — they roam the town and visit the café
- Persistent state with migrations (legacy array logs → record-based, old habits → tiered,
  pre-shelter saves → seeded collection)
- TopBar with currency pills persistent across all screens

### Not yet built
- User XP / leveling system (separate from café level)
- **Verified native iOS/Android builds** — the Skia path, `app.json` config, and
  `.native.tsx` entrypoints are in place, but no build has been run end to end
- **Porting the `pixelSvg` components off SVG data-URIs** — the currency icons,
  cat collection grid, capsule machine and boba cup render nothing on device.
  See the warning in the cat sprite section
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
6. **Canvas rendering is imperative.** The café and town map draw through a 2D
   context directly. Don't try to use React components inside them. The café's
   context is `Ctx2D` — Skia behind a Canvas2D-shaped facade
   (`components/skiaCanvas2d.ts`), which is deliberately **not** a general
   polyfill: it implements only what the café uses. Reaching for a 2D API the
   café doesn't already call means adding it to the shim first, or it works on
   web and breaks on native.
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
11. **Don't build new pixel art on `utils/pixelSvg.ts` — it is web-only.**
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
12. **Draw functions that may run inside a state updater must be pure.** The
    adoption draw (`constants/gacha.ts`) takes its rolls as parameters and calls
    no `Math.random()`, because React can invoke an updater more than once per
    commit. Roll outside the updater; re-check preconditions inside it.
13. **Never hand `drawImage` the fill paint.** Skia ignores a paint's RGB when
    drawing an image but still applies its **alpha**, so sharing `fillPaint`
    painted every sprite at whatever opacity the last `fillStyle` happened to
    carry — a 22% contact shadow set just before a cat left the cat 22% opaque.
    `skiaCanvas2d.ts` keeps a separate `imagePaint` for this reason.
