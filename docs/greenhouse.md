# The Greenhouse — design doc

> Status: **planned, not built.** Decisions marked ✅ are settled; open questions
> are at the bottom.

The café pays you for doing real work: habits and focus become pearls, pearls
serve cats, cats pay coins. The greenhouse pays you for **coming back**. It's a
different muscle, and it's the one the app actually cares about.

Where the café rewards a good session, the greenhouse rewards a good week. A
plant is a streak you can look at.

---

## The loop

1. **Buy a seed** at the rack on the potting bench (coins).
2. **Drag a pot** from the bench onto an empty shelf socket.
3. **Water daily** — drag the watering can across the bench.
4. **3 watered days → sprout.** More watered days → mature.
5. **Tap a mature plant to harvest** its coins.

Growth advances only on days you water, so "days to mature" below always means
*days you showed up*.

### Why the shop is inside the greenhouse ✅

The café taught us that the object you drag should live in the room you drag it
in — the boba cup works because it sits on the counter you serve from. Seeds
bought at the Market would mean Market → buy → navigate → greenhouse → drag,
which is three screens for a daily ritual.

So:

| Where | Sells | Why |
|---|---|---|
| **Greenhouse** (seed rack) | Plants | Repeat purchases, feeds the drag gesture |
| **Market** | Shelves, misting system, grow lamps | One-off room upgrades — the Market already has an `upgrades` category |

---

## The two gestures ✅

Kept deliberately simple. Everything reuses the café's `PanResponder` pattern,
including its hard-won lesson: **the dragged object is always draggable.**
Gating a gesture on "is this currently useful" makes it silently refuse to move,
which reads as broken rather than idle.

**Watering — one drag for the whole bench.** The can hit-tests *continuously
during* the drag rather than on drop, so sweeping it along a shelf waters every
plant it passes. Twelve plants shouldn't be twelve gestures. The can tilts, a
few droplet pixels fall, and each plant it touches perks up.

**Potting — drag and drop.** Pot lifts off the bench, empty sockets highlight,
drop snaps it in. Same drop-radius hit test as handing over a boba.

**Harvesting is a tap, not a drag** ✅ — a mature plant with coins ready shows a
glint; tapping it sends coins flying to the TopBar pill. Taps and drags stay
distinct so neither gets in the other's way. Once a player has six or more
plants, the harvest basket on the bench becomes a collect-all.

---

## The room

Authored 390 wide, uniform scale, height flows — the same system as the café,
the same `PixelPainter` at `PX = 2`, a new `greenhousePalette.ts`.

- **Glass everywhere.** White-painted iron frame, panes with condensation
  speckle and highlight streaks, a ridge vent cracked open at the top. The glass
  is this room's signature the way the counter is the café's.
- **Night is the café's opposite, again — but a third way.** The café warms to
  lamplight. The greenhouse goes *cold blue through the glass* with **magenta
  grow-lamp pools** on the benches. Real grow lamps are that colour, and it
  means the two rooms are never mistaken for each other at a glance.
- **Sunbeams.** Translucent diagonal bands from the roof onto the brick with
  dust motes drifting in them. Cheap at PX=2 and probably the detail that sells
  the room.
- **Three staging benches**, slatted wood on wrought-iron legs, four pot sockets
  each. Empty sockets are drawn as shallow rings so they read as invitations
  rather than gaps.
- **Potting bench**, bottom-left: stacked terracotta pots, soil bin, twine, the
  seed rack, the watering can on its hook.
- **Floor**: red brick in running bond, moss in the joints, a puddle reflecting
  the glass, a drain grate.
- **Ambient life**: a bee on a slow loop, a butterfly, drips off the can — and
  **one of your adopted cats asleep in a sunbeam**, drawn from `ownedCats` the
  same way the café and town draw theirs.

### Sprites are procedural, not hand-drawn

Nine species × five stages is 45 grids to author and keep in sync, which is how
they drift apart. `constants/catSprites.ts` already proves the alternative: a
spec (stem height, leaf shape, leaf count, flower type, palette) assembles a
grid, growth stages interpolate the parameters, and everything rasterises once
through `pixelImage.rasteriseGrid`.

---

## Plants

| Plant | Unlock | Cost | Days to mature | Coins/day | Dies after |
|---|---|---|---|---|---|
| Mung sprout | free starter | — | 3 | 3 | 4 dry days |
| Spider plant | Lv 1 | 60 | 4 | 5 | 4 |
| Aloe | Lv 2 | 90 | 5 | 8 | **6** (succulent) |
| Mint | Lv 3 | 120 | 4 | 11 | 3 |
| Lavender | Lv 4 | 180 | 6 | 16 | 3 |
| Monstera | Lv 5 | 260 | 7 | 24 | 2 |
| Orchid | Lv 6 | 340 | 8 | 32 | **2** (delicate) |
| Tea bush | Lv 7 | 450 | 10 | 44 | 3 |
| Moonflower | Lv 8 | 650 | 12 | 65 | **1** |

Two properties worth preserving when these get tuned:

- **Payback lands around 11 days for every plant**, so nothing is a trap. The
  expensive ones aren't better per coin, they're better *per slot* — which is
  what makes Market shelf upgrades worth buying.
- **Expensive means richer *and* more fragile.** A Moonflower dies if you miss a
  single day. A veteran's greenhouse is a statement about their consistency.

A free starter seed on first entry means the three-day clock starts on day one
instead of after a shopping trip — the same reason `ownedCats` ships with three
starters.

### The bloom bonus

Watering on a day you've completed your habits (or checked in on your mission)
pays **+50%**. This is the whole thesis of the app compressed into one mechanic:
the garden rewards the life, not the game.

### Death: husk and compost ✅

Permanent deletion in a self-improvement app is a quit risk. Someone gets sick
for four days, comes back to a dead Monstera, and the app becomes a source of
guilt — the exact opposite of what Homebase is for.

So a plant that runs out of water becomes a **dried husk in its pot**, not an
empty socket:

- The husk is visible and a bit sad. The slot stays occupied until you deal
  with it, so neglect has a footprint.
- **Clearing it is free.** **Composting it** returns one *fertilizer*, which
  skips a growth day on the next plant.
- You lose the investment and the income. You are handed the first step of the
  next plant instead of a hole.

Fertilizer is also purchasable with **pearls**, giving pearls a second sink and
closing another loop: habits → pearls → faster plants.

### The misting system: alive, never productive ✅

A Market upgrade that covers you when life happens — without undercutting the
point of the room.

The trick is *what* it does. It does **not** grant a permanent extra dry day;
that would just shift every number by one and remove the tension late. Instead
it's a **reservoir**:

- Holds up to **3 days** of water. Refills one day per visit.
- While you're away it spends a day per day to keep plants **alive**.
- It never advances growth and never accrues yield.

So you come back from a long weekend to plants that are living but exactly where
you left them — you lost the progress and the income, not the plant. Absence
still costs, which is the whole thesis; it just stops costing you 650 coins.

It's also a buffer you *spend and rebuild* rather than a switch you flip once,
so the tension survives into the late game. Fragile plants stay fragile relative
to hardy ones — the ordering is untouched.

---

## Account XP replaces café level ✅

The current `level` is café level: `addCoins` ticks it when
`coins >= level * 100`. It's really a coin ratchet, and it means saving to
unlock competes with spending to plant.

`CLAUDE.md` already lists "User XP / leveling system (separate from café level)"
as unbuilt. This feature is the reason to build it — and per the decision, it
**replaces** café level rather than sitting beside it. "Level up your account to
unlock new plants" then means literally that your real-life consistency unlocks
better plants.

### XP is pearls earned

Not pearls *held*. Pearls are already the token for exactly the actions that
should count — habit reps, focus minutes, mission check-ins, reflections,
achievement claims — so XP needs no new event plumbing:

```
xp        — cumulative pearls earned, net of corrections
level     — derived from xp, and ratchets: once reached, never lost
```

**Serving cats earns no XP, deliberately.** The café is the reward, not the
work. A player who only plays the game doesn't level; a player who does the
work does.

### The curve

```
xpForLevel(n) = 150 * n * (n - 1)
```

| Level | Cumulative XP | Days at ~285 XP/day |
|---|---|---|
| 2 | 300 | 1 |
| 3 | 900 | 3 |
| 4 | 1,800 | 6 |
| 5 | 3,000 | 11 |
| 6 | 4,500 | 16 |
| 7 | 6,300 | 22 |
| 8 | 8,400 | 29 |

285/day is a solid routine: one keystone (100) + two anchors (120) + a quick
habit (30) + a 25-minute focus session (5) + mission (25) + reflection (~4).
Moonflower at level 8 is a five-week goal, which feels right for a habit app.

### The exploit this closes

`unlogHabitRep` refunds pearls. If XP only ever counted up, log → unlog →
repeat farms infinite XP. So **XP decrements on unlog**, mirroring the refund.

Level still ratchets, so a correction never demotes anyone — it just delays the
next level slightly. Exploit-proof and non-punishing.

### Blast radius

Smaller than expected. `CAFE_LEVELS` in `constants/cafeData.ts` is **defined but
never imported** — dead data that can go.

| File | Change |
|---|---|
| `hooks/useCafeState.tsx:724` | Delete the coin-driven level tick from `addCoins` |
| `hooks/useCafeState.tsx` (6 pearl grants) | Route through one `earnPearls()` helper that also grants XP and recomputes level |
| `hooks/useCafeState.tsx:1262` | `unlogHabitRep` decrements XP alongside its pearl refund |
| `components/TopBar.tsx:69` | Level pill keeps its place; add an XP progress ring |
| `constants/achievements.ts:263,272` | "Reach café level 3/5" → account level, thresholds retuned to the new curve |
| `constants/guideScript.ts:85` | `level-up` beat retitled — "café leveled up" is no longer what happened |
| `constants/cafeData.ts:121` | Delete `CAFE_LEVELS` |

### Migration

Existing saves have no XP counter. Seed `xp` with the threshold for the player's
**current** level, so nobody is demoted by the update, and let it accumulate
normally from there. One line in `loadState`, consistent with how `seedOwnedCats`
handled the shelter migration.

---

## Ties into the rest of the game

- **Pearls** gain a second sink (fertilizer), connecting real work to plant speed.
- **The bloom bonus** ties yield directly to completing your actual habits.
- **The café**, later: a mature plant can be moved there as decor, feeding the
  café quality multiplier. Both rooms, one economy.
- **Town**: the greenhouse takes one of the four empty plots. Glass roof catches
  the sun by day and glows by night.
- **Cats**: adopted cats nap in the sunbeams.
- **Guide beats**: first visit, first sprout, "your lavender is drooping", a
  condolence on a husk, first harvest.
- **Achievements**: a Garden 🌿 category — first bloom, full shelf, 30-day
  survivor, a season without a loss.

---

## State

Lives beside the rest of `CafeState`, `dateKey`-based, with a
`settleGreenhouse(state, todayKey)` run at load and before any gain — the exact
pattern `settlePopularity` uses, for the exact same reason: it has to stay
correct across app closes and missed days.

```ts
interface Plant {
  id: string;
  species: string;          // key into PLANT_SPECIES
  slot: number;             // shelf socket index
  plantedOn: string;        // dateKey
  waterCount: number;       // distinct days watered
  lastWateredDate: string | null;
  stage: 'seed' | 'sprout' | 'growing' | 'mature' | 'wilting' | 'husk';
  thirst: number;           // days since last watered
  pendingCoins: number;     // accrued, awaiting a harvest tap
}

interface GreenhouseState {
  plants: Plant[];
  shelves: number;                        // unlocked benches
  seeds: Record<string, number>;          // bought, unplanted
  fertilizer: number;
  misting: boolean;                       // reservoir owned
  reservoir: number;                      // days of water in hand, 0–3
  lastSettledDate: string | null;
}
```

`pendingCoins` caps at three days' yield, so leaving plants unharvested doesn't
compound forever but a single missed day costs nothing.

---

## Phasing

1. **The room and the loop.** Greenhouse screen, benches, pot drag, watering
   can, seed rack, growth + settle logic, four starter species.
2. **Progression.** Account XP replacing café level, level-gated roster,
   wilting → husk → compost, harvest tap, guide beats.
3. **Depth.** Market upgrades (shelves, misting, lamps), Garden achievements,
   napping cats, café decor cross-link.

---

## Deferred

- **Whether the greenhouse needs unlocking.** Available from day one for now;
  the "empty plot becomes a greenhouse at level 3" beat is worth revisiting once
  the loop is proven.
- **Notifications** ("your plants need water") are unbuilt. This feature wants
  them, but not before phase 1 ships.
