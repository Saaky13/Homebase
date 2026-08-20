# The brew machine — interaction specification

**Supersedes `SERVE-INTERACTION.md` §3 (the recipe rail) and §4 (the brew).**
§6 hand-off, §9 inspect card and §11 state machine are unchanged. §5 payout
badges and §10 want bubbles are **dead, not deferred**: the badge that hovered
over a cat mid-drag read as debug output, and the numbers now arrive once, as a
`ServeReceipt` that floats off the cat the moment it is served.

The rail is not deleted, it is **relocated**: it stops being a docked HUD strip
and becomes the contents of the machine's menu sheet.

---

## 1. Why this replaces the rail

The rail worked but it was chrome. A 104pt strip pinned to the bottom of the
screen covers the part of the room the queue occupies, and it announces itself
as UI in a game whose whole argument is that the café is the reward.

The machine is furniture. It is already drawn — `drawCupStation` in
`cafeRender.ts` paints an espresso machine and boba jars onto the counter — so
this extends existing art rather than adding a new object to the room.

It also resolves the geometric constraint (`SERVE-INTERACTION.md` §1) more
cleanly than the split-stage design did. The rail put stage 1 at the bottom of
the screen and stage 2 at the counter, ~420pt apart. The machine puts **both
stages at the counter**, where your hand already goes on every serve. Only the
occasional act of browsing all 24 recipes drops to the thumb zone, and that is
the one action rare enough to deserve the travel.

---

## 2. The loop

```
  select (occasional)  →  HOLD to fill  →  drag to cat
     preset or sheet        600ms gauge      existing short drag
```

Three actions the first time you want a new drink; **two on every serve after
that**, because the machine stays loaded with the last recipe selected. Same
action count as the rail, with the picker out of the room.

---

## 3. The machine

Sits behind the counter, above the cup station. Design-unit geometry, to be
finalised against `drawCupStation`:

```
   ┌─────────────────────────────────┐  design y
   │      ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄            │
   │      █ ● ▢▢ ▢▢ ▢▢  ≡ █          │  ~84   lamp · 3 presets · menu tab
   │      █ ▓▓▓▓▓▓░░░░░░ █           │  ~104  fill gauge
   │      █    [ HOLD ]   █          │  ~116  dispense button
   │      ▀▀▀▀▀▀▀╥▀▀▀▀▀▀▀▀           │        spout
   │            ☕ cup                │  132   ← drag starts here
   │                                 │
   │            🐱 front              │  268   ← and ends here
   └─────────────────────────────────┘
```

Drawn in the café's own idiom — `PixelPainter`, `PX = 2`, filled axis-aligned
rects only, palette from `cafePalette.ts` so it warms at dusk with the room.

### The lamp — the readiness tell

**You cannot brew with an empty queue.** Rejected alternative: brewing
speculatively and letting a full cup sit on the counter waiting for someone to
want it. That turns the machine into an inventory slot and drains the moment of
any relationship to the cat in front of you.

But a control that silently refuses reads as broken — that was the lesson from
the counter cup, which is deliberately always draggable for exactly this reason.
So the machine states it, physically:

| Queue | Lamp | Gauge | Dispense |
|---|---|---|---|
| Someone waiting | lit warm | dark, ready | live |
| Empty | unlit | dark | inert — 120ms ±3pt shake on press |

A machine with its power light off is not broken, it is off. No error copy
needed.

**Decided:** if the cat you brewed for leaves, **the cup is dumped** — the same
200ms empty as the cancel plate (§6), unprompted. A cup that outlives its cat
is speculative inventory arriving by the back door: keep it and the machine
becomes a place drinks accumulate, which is exactly what the no-speculative-brew
rule exists to prevent. Dumping also keeps the lamp honest — lamp out, cup
empty, one state rather than two.

### Presets

Three cells on the machine face — the three most recently used recipes, seeded
with `STARTER_RECIPES`. Each is a `CupSprite` at ~20 wide with its pearl cost, in
its rarity frame (`DRINK_FRAME`).

| Gesture | Result |
|---|---|
| Tap | Selects it. Does **not** brew. Fires the §5 payout flash across the queue. |
| Long-press ≥260ms | Peek — payout flash for as long as held, selection unchanged. |

The selected preset takes the loaded lift and underline the rail cells used.

### The menu tab

A `≡` tab at the machine's right edge. Opens the recipe sheet (§5). Selecting
from the sheet sets the recipe, pushes it to the front of the presets (MRU), and
dismisses.

---

## 4. The hold

**Press and hold the dispense button. The gauge fills. At full, the cup fills.**

Fixed duration, **600ms**. This is emphatically *not* a timing game — there is
no sweet spot, no overfill, no bonus for precision. You will do this fifteen
times in a session and a per-serve skill tax turns a calm game into a chore. The
hold exists so that committing to a drink costs a beat of real time and has a
physical consequence on screen.

| t (ms) | Event |
|---|---|
| 0 | Button face drops 4pt. Haptic `impactLight`. Gauge starts filling. |
| 0–600 | Gauge fills left→right, **linear** — a gauge that eases reads as lying about progress |
| 0–600 | Machine hum: a 2px vibration on the machine body, 60ms period |
| 600 | Gauge snaps full. Haptic `impactMedium`. Cup swaps palette, `fill` 0→1 over 260ms `out(quad)` |
| 640–1040 | Three steam puffs from the spout — per-frame `PixelPainter`, not a React overlay |
| 600–1800 | Payout flash across the queue (§5) |

The cup's `bob` loop pauses at t=0 and resumes at t=1040.

### Releasing early

The gauge **drains back to zero over 200ms** and nothing happens. No brew, no
spend, no penalty, no partial fill. Not a failure state — an unfinished one.

---

## 5. The recipe sheet

Bottom sheet, thumb zone, over the room. This is where `RecipeRail` goes.

- 24 recipes as a **grid, 4 across** — a sheet has vertical room a horizontal
  rail did not, and 24 items scan far better in a grid than in a strip
- Same 60×84 cell, same `CupSprite` + rarity frame + pearl cost, same
  unaffordable / pressed / selected states already built
- **Ordered for the cat at the front of the line** — four sections (loves,
  likes, fine, won't drink), rarest first inside each, names inked by rarity.
  Re-derives as the queue moves, so serving the front cat reshuffles the whole
  menu around whoever steps up. Same ordering the inspect card uses, from the
  same place (`preferencesFor().ranked`). Empty queue falls back to
  `DRINK_ORDER` (pearl-ascending) — cheap workhorses first
- Long-press still peeks; the sheet is translucent enough that the queue's
  badges read behind it
- Tap selects, closes, and promotes to presets

**Brewing stays free.** Pearls spend on the drop, never on the brew or the
select. You can re-brew fifty times while deciding and pay nothing.

---

## 6. Cancel

Once the cup is full it can be dumped. A small `✕` plate appears beside the cup
at design ~(222, 126).

| Gesture | Result |
|---|---|
| Tap `✕` | Cup empties over 200ms, machine returns to idle-ready |
| Hold dispense again with a different recipe selected | Implicit re-brew — dumps and refills, no confirm |
| Drag cup to a cat | Serves (§6 of `SERVE-INTERACTION.md`, unchanged) |
| Drag cup and release on nothing | Springs back to the counter, still full — existing behaviour |

Cancel is cheap by construction because the brew was free. Its job is not
undoing a cost, it is clearing the counter when you decide you would rather bank
the pearls.

---

## 7. Gesture vocabulary — revised

Replaces `SERVE-INTERACTION.md` §2.

| Gesture | Target | Result |
|---|---|---|
| Tap | machine preset | Selects the recipe. Payout flash. No brew, no spend. |
| Long-press ≥260ms | machine preset | Peek. Flash while held. No selection change. |
| Tap | `≡` menu tab | Opens the recipe sheet |
| Tap | sheet cell | Selects, promotes to preset, dismisses |
| **Hold 600ms** | dispense button | Fills the cup. Release early = drain, nothing happens. |
| Tap | `✕` beside a full cup | Dumps it |
| Drag | the full cup | Serves it to the cat you drop on |
| Tap | a cat in the queue | Inspect card, anchored above its head |

No overlaps. Every gesture has exactly one meaning.

---

## 8. What this changes in the build

| Piece | Was | Now |
|---|---|---|
| `PayoutBadge.tsx` | built | **unchanged** — §5 stands as written |
| `RecipeRail.tsx` | docked HUD strip | becomes sheet content; horizontal scroll → 4-across grid; drops `RAIL_HEIGHT` and the safe-area dock |
| `app/rail-preview.tsx` | scratch harness | needs reworking around the machine, or replacing |
| `cafeRender.ts` | want bubbles + steam | **plus the machine** — body, lamp, presets, gauge, dispense button, spout |
| `CafeCanvas.tsx` | rail mount + tap-to-brew | machine hit-testing, hold gesture + timer, gauge animation, cancel, sheet presentation |
| `Cat.tsx` | `DrinkId` widening | unchanged by this revision |

Net: roughly double the rail's build. Nothing already written is thrown away.
