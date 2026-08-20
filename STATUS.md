# Drink economy — build status

Whole-scope tracker for the project. `DRINK-ECONOMY.md` holds the numbers and
the rationale; `SERVE-INTERACTION.md` holds the Phase 1 interaction in full.
This file is **what's real on disk, what's next, and which lines to touch** —
it doesn't restate the numbers, it points at them.

Branch `brew-machine` · worktree `.claude/worktrees/almanac` · no PR yet
(cut off main @ 176ed0e; `cat-almanac` merged as PR #24)
Preview: `preview_start` name `cat-cafe-almanac` (port 8099)
Interaction spec: **`MACHINE.md`**, which supersedes `SERVE-INTERACTION.md` §2–4

| Phase | What it is | Status |
|---|---|---|
| 0 | Data foundation | ✅ **built** — `recipes` here, bonds on main as `bondXp` |
| 1 | Brew machine + hold-to-fill + payout preview | ✅ **built** |
| 2 | Payout rewrite — affinity actually pays | 🟡 **coins landed early**; streak counter + choreography ⬜ |
| 3 | Patience — the queue becomes a clock | 🔨 **another session, in parallel** |
| 4 | Bond levels — the coin tip | ✅ **built on main** |
| 5 | The almanac | ✅ **built**, bond row included |
| 6 | Gacha gives recipes | ✅ **built** — landed early, out of order |
| 7 | Tuning & tie-ins | ⬜ |

**Sequencing:** 0–2 are one shippable unit — after them the game plays
differently. 3 should follow closely or the result is solvable by stalling.
1 is closed and 2's coin half came with it; 3 is being built in parallel by
another session, so nothing here touches `Cat.tsx` timers, `cafeVisit.ts` or
the pacing curve in `constants/popularity.ts`.

---

## Phase 0 — Data foundation · 🟡 mostly built

| Piece | State |
|---|---|
| `constants/drinks.ts` — 24 recipes, `DRINKS`, `DRINK_ORDER`, `DrinkId`, `CUP_PALETTES` | ✅ |
| `constants/vessels.ts` — boba/coffee/tea on one 20×30 grid, `vesselGrid()` | ✅ |
| `constants/affinity.ts` — `affinityFor`, `favoriteDrink`, `serveOutcome`, `AFFINITY_COINS/POPULARITY/XP/PIPS/LABEL` | ✅ |
| `state.recipes: DrinkId[]` — seeded `STARTER_RECIPES`, migrated, filtered against roster on load | ✅ `useCafeState.tsx:250,347,753` |
| Bond XP — landed on main as `CatStat.bondXp`, not a `catBonds` map | ✅ `constants/bonds.ts` |

**The `catStats` / `catBonds` question is settled.**
`constants/catLore.ts:125` defines `CatStat { adoptedOn, firstServedOn,
lastServedOn, parts }`, live at `useCafeState.tsx:244` and written by
`recordCatsServed`. `DRINK-ECONOMY.md` §Phase 0 wanted `catStats` to **fold
into** a `CatBond`; what shipped instead was one `bondXp` field on the record
that already existed, with level and tip derived. Neither a merge nor a second
map — the smaller change turned out to be the right one, and `catStats` stands
as-is.

---

## Phase 1 — The brew machine · ✅ built

**Redesigned 2026-08-19.** The bottom-docked recipe rail is out; a brew machine
behind the counter is in. Full spec in **`MACHINE.md`**, which supersedes
`SERVE-INTERACTION.md` §2–4. The loop is: select a recipe on the machine
(occasional) → hold the dispense button 600ms to fill the cup → drag the cup to
the cat. Two actions per serve once a recipe is loaded, same as the rail, with
the picker out of the room.

### Built
| Piece | Where |
|---|---|
| `CupSprite.tsx` — react-native-svg, device-safe, DrinkId-keyed | ✅ |
| `drinkCupImageCache.ts` — DrinkId carried-cup `SkImage` cache | ✅ |
| The machine itself — body, lamp, 3 preset cells, gauge, button, spout, menu tab | `cafeRender.ts` `BREW_MACHINE` |
| The hold — 600ms linear gauge, `DRAIN_MS` 200 on early release, hum shake | `CafeCanvas.tsx` `beginHold`/`endHold` |
| Readiness — empty queue unlights the lamp and the button refuses with a shake | `machineRef.current.ready` |
| The menu sheet — 4-across grid + detail panel | `RecipeSheet.tsx`, `DrinkDetail.tsx` |
| Cancel `✕` — dumps the cup over `DUMP_MS` 200 | `CafeCanvas.tsx` `cancelBrew` |
| ~~Payout flash~~ — **cut.** Plates over every waiting head read as a spreadsheet bolted to the room; the inspect card prices drinks properly and `ServeReceipt` reports the serve | `ServeReceipt.tsx` |
| `Cat.tsx` `drink: DrinkId \| null`, `drawCatDrink` off the DrinkId cache | ✅ |
| Per-drink pearl cost replacing the flat `PEARLS_PER_CAT` | `pearlsPerCat(drink)` |

**The want bubble is gone, and `drawWantBubble` with it.** `SERVE-INTERACTION.md`
§10 planned to widen it to the cat's true favourite, full-palette when owned and
locked when not. It never got that far and it should not: a 26×20 bubble at
`PX = 2` has about eight art pixels to name a drink with, so every cat asked for
the same generic cup — a permanent smudge beside every head, carrying nothing.
The inspect card answers the same question properly and now loads the drink
besides, which the bubble could never have done. §10 is dead, not deferred.

**Tapping a drink on the inspect card loads it** (`onPickDrink`). The favourite
row and any liked drink on your menu are buttons; locked rows and dislikes stay
inert, because there is nothing to load. The card closes on the way out. The
town map passes no handler, so its card stays read-only — there is no machine
there to load into.

**The open question is answered, and the answer went the other way.** The cup
does **not** survive its cat. `MACHINE.md` records the directive: *"the cup
should be cancelled if the cat leaves."* The loop's `!ready` branch calls the
same `cancelBrew` the `✕` does, so there is one emptying animation rather than
two paths that can drift.

**Two things the preview may not do.** A payout preview that quotes a number
the till does not pay is worse than no preview, which forced two decisions:
- `PayoutBadge` dropped `SERVE-INTERACTION.md` §5's `-0.20 pop` line. The serve
  still runs the flat `addDrinkServed(1)`, so that line named a charge nobody
  makes. The warning is carried by the red figure and the `✕`, both true.
- The serve itself moved to `serveOutcome(spec, drink, { bondTip }).coins`
  early — see Phase 2 — because the menu quotes the arithmetic to the coin.

**⚠️ `bobaInventory` is not write-only — the doc is wrong about this.**
`SERVE-INTERACTION.md` §6 says the derivation can be deleted because nothing
reads the field. Two readers exist: `constants/guideScript.ts:96` (the
`boba-waiting-to-serve` nudge) and `CafeCanvas.tsx`, which feeds `scene.boba`
into `drawCupStation` — the jars on the counter. Deleting the `flavor`
`useMemo` is safe; **deleting the field is not.** It also gets a real job in
Phase 3. Leave it standing.

### Not yet verified by eye
The hold → brew → `✕` → dump sequence has not been watched running. It cannot
be driven from the agent harness: the brew commit lives in the
`requestAnimationFrame` loop, and a hidden Browser pane pauses rAF entirely
(`document.hidden === true`, zero frames), so a synthetic 900ms hold ticks
nothing. Everything React-side — preset tap, the flash, the peek, the sheet —
is confirmed working, because none of it goes through the loop.

### Closing out
- `~/.local/bin/rtk npx tsc --noEmit` from `client/` — ✅ clean
- Visual check on port 8099 — **needs a human at the keyboard**
- **Show before committing** — not pre-authorized
- Delete the scratch routes: `app/rail-preview.tsx`, `app/machine-preview.tsx`,
  `app/menu-preview.tsx`, `components/MachinePreview.tsx`, `components/RecipeRail.tsx`
- Then decide: new PR off `brew-machine`

---

## Phase 2 — The payout rewrite · 🟡 coins landed early

**The coin half is done.** `serveFrontCat` pays
`serveOutcome(spec, drink, { bondTip: tip }).coins` — the drink's base coins,
times what this cat thinks of it, times the bond tip. It came forward out of
Phase 2 because Phase 1's menu quotes those numbers on screen, and a preview
that disagrees with the till is worse than no preview.

The group premise in `SERVE-INTERACTION.md` §6 and in this section's original
text is dead: main serves **one cat per drop** (`serveFrontCat`,
`serveCustomers([front.id])`), so there is no group of three to return three
multipliers for.

**Popularity is still flat, on purpose.** The serve runs `addDrinkServed(1)`,
not `serveOutcome().popularity`. `addDrinkServed`'s gain is already
café-multiplier-scaled and `serveOutcome`'s is not (convention 2), so routing
affinity popularity needs to pick exactly one path — doing both double-counts.
Until that decision is made, **nothing on screen mentions popularity**: not
`PayoutBadge`, not the menu's detail panel. Deferred rather than half-done.

### Still to build here

**`components/StreakCounter.tsx`** — new. ×1.0/×1.2/×1.5/×2.0 at 0/3/6/10
consecutive favorite matches, **coins only**. Lives in a ref in `CafeCanvas`,
dies on unmount — never persisted, or it invites save-scumming. Placed left of
the coin pill's x in the café overlay, *not* in `TopBar` (shared across every
screen; the streak is café-only). The break is louder than the build: 400ms
red flash and a shake.

**The §7 payoff, ~640ms** — cup pours 1→0, ring flashes, heart pips burst
(3/1/0 by affinity; a dislike gets a grey puff and a cracked want bubble
instead), coin figure arcs to a fixed `(width - 96, 8)` rather than measuring
the TopBar pill across a Stack boundary. SERVING is non-interruptible: the
rail disables and hit-testing stops for the duration, which is what stops a
second drag paying pearls twice against one queue snapshot.

---

## Phase 3 — Patience · 🔨 built in parallel elsewhere

**Not this branch's work.** Another session is building it right now, which is
why nothing here touches `Cat.tsx`'s timer fields, `constants/cafeVisit.ts` or
the pacing curve in `constants/popularity.ts`. Left below as written so the two
can be reconciled at merge.

Condition (3) of the three the economy rests on, and the only one still
missing. Without it, holding pearls is free and stalling is optimal.

- Queue cats get a timer — ~90s at low popularity, tightening as the café
  fills (pair it with `spawnIntervalMs`/`maxGroupSize` in
  `constants/popularity.ts` so one pacing curve drives all three)
- Timing out: walk out unserved, small popularity cost, **streak breaks**.
  That last part is what makes a 10-streak feel precarious rather than merely
  long — it can be lost to the room, not only to your own mistake.
- `Cat.tsx` gains the timer field; the leave path already exists
  (`CafeCanvas.tsx:493` runs the seated 60s exit through `sendCatOut`)
- Some visible tell on the cat — **not the want bubble**, which was cut (see
  below); the cat sprite or a ring at its feet is the room's remaining surface

**`bobaInventory` finally gets spent here.** Focus sessions brew free *stock*
of recipes you own (today `settleFocusTimer` only ever adds `classic`,
`useCafeState.tsx:1300`); serving draws from stock before charging pearls.
Focus time becomes prep time, and a long session buys a rush you can survive.
The field widens from three flavours to `Record<DrinkId, number>` — needs a
migration, and `guideScript.ts:96` reads the old shape.

---

## Phase 4 — Bond levels · ✅ built on main

Landed as `constants/bonds.ts` (merged, PR #26) rather than here. `bondXp`
sits on `CatStat` in `constants/catLore.ts` and is written in exactly one
place, `recordCatsServed`; level and tip are **derived**, never stored — the
same rule that keeps `catLore` from holding a `served` total beside its
`parts`. XP per cup is `serveOutcome(spec, drink).xp`, so a favourite builds a
bond several times faster than something merely tolerated.

Five levels on a per-rarity curve (common 400 → ultra 2800 to max), tip
+5/+10/+20/+35%. The ceiling sits deliberately below affinity's ×2.0, so a
maxed bond is never worth more than handing a cat the right drink.

Surfaces done: `CatInspectCard`'s bond row, `CatAlmanacSheet`'s bond card, the
collection grid. The `catStats` → `CatBond` merge this phase was going to open
with **did not happen and should not** — one field on the existing record beat
a new one beside it.

---

## Phase 5 — The almanac · ✅ built

Cat Shelter is three tabs (`app/cats/index.tsx:48` — `adopt` / `collection` /
`almanac`), with a cats/drinks toggle inside the almanac (`:66`).
`CatAlmanacSheet.tsx` and `CatInspectCard.tsx` both shipped;
`/cats?cat=id` deep-links a sheet open (`:84`).

The bond row that was this phase's remaining gap arrived with Phase 4 — level,
tip and progress on the card, the sheet and the collection entry.

---

## Phase 6 — Gacha gives recipes · ✅ built

Second hopper on the capsule machine, `pickCat`/`pickDrink` both one line over
a generic `pickUnowned` (`constants/gacha.ts:97,135,144`), separate price
ladder 15/30/60/120 against the cats' 10/25/50/100, `pullCost` reading both
collection sizes (`useCafeState.tsx:1647`).

---

## Phase 7 — Tuning & tie-ins · ⬜

- **Rebalance against real play.** Everything in `DRINK-ECONOMY.md` is
  first-pass. The stacked ceiling (Aurora Fizz → Prism, maxed café,
  ten-streak = 3,360 coins) wants checking against actual coin flow once 1–3
  are in and the café has been played for more than a session.
- **Greenhouse toppings** — a harvested plant yields a topping that bumps one
  serve up an affinity step. Gives the greenhouse a reason to feed the café,
  which it currently doesn't. Hooks: `PlantSpec` (`constants/plants.ts:19`),
  `harvestPlant` (`useCafeState.tsx:1906`).
- **Order tickets** — a cat occasionally arrives demanding one specific drink
  at a premium, ignoring its own preferences. A rush event. Needs Phase 3's
  timer to have any teeth.
- **Achievements** — almanac completion, per-rarity bonds, first legendary
  match. `constants/achievements.ts` is 29 across 6 categories; `cats` and
  `cafe` are the natural homes. `check` predicates are evaluated against
  existing state so they light up retroactively — keep new ones monotonic.
