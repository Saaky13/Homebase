# Homebase
The concept is bascially gamifcation of self improvement to :
allow users to log and develop good habits
deep focused work
a more purpose-filled life




This app is not a cafe simulator. Its a personal development game with a cat cafe theme.


1 min focus = 1 pearl

Pearls give:
upgrades to 
cat treats



There should be a cat chest opener to unlock new cats


Coins used for cafe expansions, new locations, machinery, etc. 


 each day there can be an app dailogue before the user enters


 The Economic LoopPearls = Production

1 pearl per minute of focus = 1 boba made
Completing habits = bonus pearls (batch production)
Pearls sit in inventory as "made boba"
Cats = Customers

Cats spawn and queue up to buy boba
Each cat wants a drink (costs 1-3 pearls depending on fancy)
When cat buys → user gets coins
Cats leave happy (or impatient) based on wait time
Coins = Café Growth

Invest in café upgrades (counter speed, seating, ambiance)
Better café = cats want to come back = more customers
Creates a growth loop that requires focus to sustain

The Pressure Mechanic (This is where it gets real)
Queue visualization:

User opens app, sees cats waiting in line
They can see the queue getting longer in real-time
Cats start to look impatient if they wait too long
This creates natural motivation: "I need to focus to make boba to serve these cats"

Timeline:

Cat arrives and joins queue
If served within 5 minutes → happy, full coin payout
If served in 5-15 minutes → okay, reduced coins
If served after 15 minutes → cat leaves upset, no coins, loses reputation

The ritual becomes:

User opens app
Sees queue of waiting cats
"I need to focus now to make boba"
Starts a focus session
Pearls accumulate = boba gets made
After focus, serves the cats, gets coins
Uses coins to upgrade café
Better café = more cats come = bigger incentive to focus









# Focus Café

Focus Café is a simulation-based self-development app where real-world focus is translated into in-game progression through a living cat café environment.

The project is built using React Native (Expo) with a custom Canvas rendering system and game loop. It emphasizes real-time interaction, autonomous agent behavior, and clean, scalable architecture.

---

## Overview

Focus Café combines productivity and simulation by allowing users to interact with a café populated by cats that behave as independent agents.

Users can spawn cats, serve them, and watch them move through a system of queues and seating. The long-term goal is to connect this simulation to real-world focus sessions and habit tracking.

---

## Features

### Simulation System

- Real-time 2D simulation using HTML5 Canvas
- Custom game loop powered by requestAnimationFrame
- Autonomous agents (cats) with independent movement and state

---

### Cat Behavior

- Cats spawn in groups of 1 to 3
- Group members:
  - Move side-by-side
  - Stay together in queue
  - Sit at the same table
- Solo cats:
  - Prefer empty tables
  - Occasionally join occupied tables based on probabilistic logic

---

### State System

Each cat follows a defined state machine:
walkingToLine → waiting → walkingToSeat → seated
- Movement is smooth and continuous
- State transitions occur based on proximity to targets

---

### Queue System

- Groups occupy a single queue slot
- Cats within a group maintain horizontal spacing
- Queue dynamically updates as new cats spawn

---

### Seating System

- 10 tables (5 on each side)
- Each table seats up to 3 cats
- Intelligent seat allocation:
  - Groups are assigned to tables with enough space
  - Tables are selected based on availability and group size
  - Solo cats may join occupied tables with low probability

---

### Interaction

- Spawn button:
  - Generates a group of cats
- Serve button:
  - Serves the front group in queue
  - Awards coins
  - Sends group to a table

---

### Currency System

- Coins:
  - Earned by serving cats
  - Represents short-term reward

- Pearls (planned):
  - Intended for long-term progression tied to focus sessions

---

### Popularity System

Popularity is the café's **live standing** — how busy the place is *right now*.
It is the app's urgency mechanic: it controls how many cats show up, which is
what makes opening the app feel like there is something waiting for you.

This is the same idea the concept notes above call "reputation." One stat, two
names — popularity is the one we build.

#### Why popularity and not a level

A level only ever goes up. A Level 12 café tells you nothing about whether you
focused *this week*, so it can't create pressure. Popularity moves in both
directions and moves fast — on the same timescale habits actually operate on.
That two-way movement is the entire point: it can say "you've drifted," and a
number that can only rise never can.

#### Scale

Popularity runs **0–100**. It is displayed as a whole number, rounded **up**,
so the user never sees a decimal and rounding always favors them.

#### How it moves

**Gains scale with the café. Decay is proportional and steps once per day.**

- **Rising** — popularity is earned by:

  | Source | Popularity |
  |---|---|
  | Keystone complete | 2.0 |
  | Daily anchor complete | 1.25 |
  | Quick win (per rep) | 0.25 |
  | Focus | 0.05 / min |
  | Cat served promptly | 0.1 |

  Each gain is multiplied by a **café quality multiplier** derived from owned
  decor and upgrades, ranging **1.0× (bare) → 2.0× (fully decorated)**. A
  well-decorated café converts the same real-world effort into more popularity
  than a bare one. This is what makes coins spent on decor an investment rather
  than a cosmetic purchase.

- **Rewards breadth, not difficulty.** Popularity deliberately *compresses* the
  habit tier spread. Pearls run 100 / 60 / 10 across Keystone / Anchor / Quick
  — a 10× spread — while popularity runs 2.0 / 1.25 / 0.25, closer to 8×
  per-day once rep caps are accounted for.

  If popularity mirrored pearls, a single Keystone would *be* your score and
  every other habit would be a rounding error. Compressed, a full day across
  several habits beats one heroic thing. This fits what the stat represents: a
  café is busy because a lot is going on, not because one hard thing happened.
  Pearls already reward difficulty; popularity should not double-count it.

- **Falling** — popularity decays **once per calendar day**, as a fraction of
  current popularity. Starting rate: **10% / day** *(⚑ tunable — see below)*.

  Decay is a function of **days elapsed**, not of app opens. Crossing `n` day
  boundaries applies `popularity × 0.9ⁿ`, whether the user opened the app once
  in that stretch or fifty times. Opening the app never costs popularity.

  | Days away | Popularity (from 100) |
  |---|---|
  | 2 | 81 |
  | 3 | 73 |
  | 7 | 48 |
  | 14 | 23 |

  A weekend off costs a little. A full week costs half.

  Decay is **not** scaled by café quality — a beautiful café still empties out
  if you stop showing up. You cannot decorate your way out of neglect. Upgrades
  raise your ceiling and your climb rate; they do not buy you absence.

- **Why proportional rather than flat.** Proportional decay is *self-limiting*:
  it takes 10 points from a standing of 100 but only 2 from a standing of 20.
  The loss is largest for users who have built something up and gentlest on
  users who are new or returning from a lapse — which is the right way round
  for a habit app. A flat decay does the opposite: a fixed nightly loss is
  proportionally brutal at low standing, hitting hardest exactly the people you
  least want to punish.

- **Bottom of the range** — popularity is clamped at 0 and never goes negative.
  It *is* allowed to reach 0: the number should tell the truth about a long
  absence rather than propping itself up at a fake minimum.

  The death-spiral guard lives on the **spawn curve** instead, not on the
  number. Cat spawn rate bottoms out at a slow trickle rather than zero, so a
  returning user walks into a quiet café — not an empty room with no reason to
  stay. Honest signal, no dead app.

- **Decay applies every day, unconditionally** *(⚑ revisit later)* — it is not
  special-cased to "inactive" days. Gains and decay simply net out: on a real
  day of activity gains exceed the 10% and popularity rises; on an idle day
  nothing offsets it and popularity falls.

  The reason it is not skipped on active days: that would make *active* a
  boolean, and the cheapest way to hold a high café would be to open the app
  and tap one Quick win. Applying decay always makes activity a **spectrum** —
  a token tap earns 0.25 and loses 10%, a real day earns ~7 and nets up. How
  much you actually did decides which way the number moves.

  Note this is invisible in normal use: on a genuine day of activity the user
  never sees popularity drop, because the net is positive. The only time an
  active day nets negative is when the activity was token.

#### Implementation notes

- **Store popularity as a float; round only for display.** 10% of 73 is 7.3 —
  rounding the stored value each day would compound error fast. The stored
  number stays exact; `ceil` is applied at the display boundary and nowhere
  else.

- **Track decay with a `popularityLastDecayedDate` date key**, not a timestamp,
  and settle it against `getTodayDateKey()` using the existing
  `daysBetweenDateKeys` helper in `utils/date.ts`. This keeps popularity on the
  same calendar-day model as habits, streaks, and `dailyStats`.

- **Settle decay before applying any gain**, so a rep logged today is never
  eroded by decay owed from yesterday.

- **Snap to zero below 0.5.** Exponential decay approaches zero but never
  reaches it, and `ceil` turns any remainder into a displayed `1`. Without the
  snap, a café abandoned for a year would read `1` forever instead of `0`.

- **Show the loss on return.** When a user opens the app after one or more days
  away, surface the delta on the café screen — `Popularity 74 ▼ 12 while you
  were away` — rather than silently presenting a lower number. The decay should
  be legible, which is a display concern, not a reason to change the math.

#### Known tradeoff: the midnight boundary

Because decay steps on calendar-day boundaries, a user active at 11:59pm who
opens again at 12:01am takes a full 10% hit two minutes later. This is the
price of the discrete model, and it is accepted for consistency with habits and
streaks, which break on the same boundary.

The mitigation is that the day's own gains immediately offset it — the user
sees the dip and earns it back with that morning's first habit reps.

⚑ **Flagged as experimental.** The 10%/day rate is a starting point chosen to
make a missed week cost roughly half. The rate, the shape (proportional vs.
flat), and the discrete-vs-continuous choice are all open for revision once it
has been played.

#### The ceiling is gated by the café, not by time

Popularity settles at an equilibrium of **daily gain × 10** (where a gain of
`G` balances a 10% loss). That makes the top of the range deliberately hard to
reach, and hard for the *right* reason.

A typical loadout — one Keystone, two anchors, one Quick win at 3 reps, plus 30
minutes of focus — earns about **6.75/day at a bare café**:

| Café multiplier | Daily gain | Settles at |
|---|---|---|
| 1.0× (bare) | 6.75 | **~68** |
| 1.5× | 10.1 | **~100** |
| 2.0× (fully decorated) | 13.5 | 100 (capped, held comfortably) |

**No amount of habit perfection alone reaches 100.** A flawless routine in an
undecorated café tops out near 68. The last third of the range only opens as
the café multiplier climbs — which costs coins, which come from serving cats,
which comes back around to focus and habits.

This is the answer to "what stops the game being over once I max out." Hitting
your habit ceiling is not the end state, it is the prompt to start investing in
the café. And because equilibrium is proportional, arriving at 100 never
becomes a resting place: at 100 the daily decay is at its largest, so holding
the top requires the routine *and* the café *and* ongoing consistency. There is
no coasting on a good month.

Corollary worth keeping: a solid-but-imperfect routine settling around **60–70**
is the expected, healthy state — not a failure. 100 should feel rare.

#### What it drives

- Cat spawn rate and group sizes
- Queue length the user sees on open
- Coin payout / tip multiplier on served cats

#### Design consequences worth tracking

- **A standing, not a score.** Popularity is a readout of current form, not a
  total to accumulate. A given level of consistency lands on a given standing —
  see the equilibrium table above.
- **Recovery is fast at the bottom.** A returning user at popularity 8 loses
  under a point a day while a normal day earns ~7, so the first session back
  visibly moves the number. Coming back should feel like it works immediately —
  this is the deliberate counterweight to how punishing the top of the range is.
- **Not a currency.** It cannot be spent. It should not sit in the currency bar
  next to Coins and Pearls, where it reads as something to hoard — it belongs
  on the café screen next to the queue, where its causal link to "cats are
  showing up" is visible.

#### Planned: user level (separate, later)

A **user level** driven by XP per boba made is planned as a distinct system.
It is the ratchet — permanent, only-up, gating unlocks and marking milestones.
Keeping it separate from popularity is intentional: the permanent progression
is what makes it safe for popularity to fall hard, because a bad week dents
your standing without erasing your account.

---

### Rendering System

- Entire UI is rendered using Canvas
- Includes:
  - Café layout
  - Custom counter shape
  - Tile-based flooring
  - Tables and seating
  - Procedurally drawn cat characters

---

## Tech Stack

- React Native (Expo)
- TypeScript
- HTML5 Canvas
- requestAnimationFrame for animation loop

---

## Architecture

### Game Loop

- Central render loop updates:
  - Cat movement
  - State transitions
  - UI rendering

---

### Entity Model

Each cat is represented as:
Cat {
id: string
groupId: string
x: number
y: number
targetX: number
targetY: number
speed: number
state: CatState
seatIndex: number | null
}---

### Group System

- Cats are grouped using a shared groupId
- Group logic controls:
  - Movement alignment
  - Queue positioning
  - Seating behavior

---

### Seating Algorithm

- Tables are defined by grouped seat indices
- System evaluates:
  - Available seats
  - Occupied seats
  - Group size
- Allocation rules:
  - Groups prefer empty tables
  - Solo cats may join partially filled tables
  - Fallback to any available seat if necessary

---

## Current Status

- Core simulation and rendering system implemented
- Group behavior and seating logic functional
- UI layout and interaction stable

---

## Future Improvements

- Build the popularity system (see above) — currently a stored field that is
  never written to and renders as a permanent `0` in the currency bar
- Move popularity out of the currency bar onto the café screen as a meter
- Drive cat spawn rate from popularity
- Add user level + XP per boba as a separate permanent-progression track
- Integrate focus timer system
- Connect pearls currency to real-world productivity
- Add animations (idle, walking variations)
- Improve pathfinding and collision avoidance
- Enhance visual polish (sprites, lighting, depth)
- Add sound design and feedback

---

## Author

Saaketh Aluri