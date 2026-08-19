# The Serve — interaction specification

> How a player chooses a drink and hands it to a cat.
> This is the interactive core of the drink economy. `DRINK-ECONOMY.md` covers
> the numbers; this covers the feel.

---

## 1. What exists today

The café is a full-screen Skia canvas driven by `requestAnimationFrame`. Serving
is a single gesture and it is the best thing the screen has:

| Fact | Value | Source |
|---|---|---|
| Room authored width | 390 design units | `CafeCanvas.tsx:52` |
| Uniform scale | `min(layout.width / 390, 1.35)` | `CafeCanvas.tsx:102` |
| Counter cup station | design `(195, 132)` | `cafeRender.ts:29` |
| Queue spots | `x = width/2`, `y = 268 + i·46`, 9 spots | `cafeRender.ts:59` |
| Drop radius | 52 design units, measured from the cup's **base** | `CafeCanvas.tsx:63` |
| Cup size | 46 × 69 screen px (`CUP_ASPECT = 30/20`) | `BobaCupSprite.tsx:6` |
| Pearl cost | flat `5 × group size` | `CafeCanvas.tsx:64` |
| Coin payout | flat `25` per cat | `CafeCanvas.tsx:270` |
| Want bubble | design `(cat.x + 24, cat.y - 44)`, 26 × 20 | `cafeRender.ts:903` |
| Serve target ring | gold ellipse at `(cat.x, cat.y + 26)` | `cafeRender.ts:892` |

The cup is **not** painted into the canvas. It is an `Animated.View` overlay in
screen space, which is how it gets touch handling for free. Everything this spec
adds follows that precedent.

### The geometric constraint that shapes everything

**The counter is at the top of the room and the queue runs downward from it.**
The cup sits at design `y = 132`; the front cat stands at design `y = 268`. That
is a 136-unit drag — comfortable.

A drink rail placed at the bottom of the screen would sit near design `y ≈ 690`
on a 6.1" phone. Dragging a cup from there up to the front cat is a ~420pt
travel across the full height of the device, one-handed, while cats are timing
out. That is not a gesture, that is a chore.

So the choice and the hand-off are **split into two stages**:

```
   ┌─────────────────────────────────┐  design y
   │        ☕ counter · cup          │  132   ← stage 2 starts here
   │                                 │
   │            🐱 front              │  268   ← and ends here (136 units)
   │            🐱                    │  314
   │            🐱                    │  360
   │                                 │
   │  ▓▓ RECIPE RAIL ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  bottom ← stage 1 lives here (thumb)
   └─────────────────────────────────┘
```

**Stage 1 — choose,** in the thumb zone at the bottom. Tap a recipe; it brews.
**Stage 2 — hand over,** the existing short drag from counter to cat.

This is also how a boba shop actually works: you pick a recipe, the machine
makes it, you pass it across the counter.

---

## 2. Gesture vocabulary

Four gestures, no overlaps, each with exactly one meaning.

| Gesture | Target | Result |
|---|---|---|
| **Tap** | recipe cell in the rail | Brews it into the counter cup. Fires a 1200ms payout flash over the queue. |
| **Long-press** (≥ 260ms) | recipe cell in the rail | *Peek.* Shows the payout flash for as long as you hold. Does **not** brew, does **not** spend. |
| **Tap** | a cat in the queue | Opens its inspect card, anchored above its head. |
| **Drag** | the counter cup | Serves the brewed drink to the cat you drop it on. |

Long-press-to-peek is the free win here: it lets a player price every option
against the whole queue without committing to any of them, using one thumb,
without a menu.

---

## 3. The recipe rail

### Container

A screen-space overlay, sibling to the cup, pinned to the bottom of the canvas.

```
position: absolute;  left: 0;  right: 0;  bottom: 0;
height: 104            // 84 cell + 10 top pad + 10 bottom pad
backgroundColor: '#FFF7EC' @ 0.94      // cream, matches pal.cream
borderTopWidth: 2;  borderTopColor: '#B08A63'
borderRadius: 0                        // pixel idiom — convention 5
```

Bottom padding grows by the safe-area inset on devices that have one.

Horizontal `ScrollView`, `showsHorizontalScrollIndicator={false}`,
`contentContainerStyle: { paddingHorizontal: 12, gap: 8, alignItems: 'flex-end' }`.

The rail scrolls; it never wraps. With 24 recipes at 60 + 8 gap you get 1,632pt of
content against a ~390pt viewport — a little over four screens. Recipes are
ordered by **pearl cost ascending**, so the cheap workhorses are always under
your thumb at rest and the expensive ones are a deliberate scroll away. That
ordering is itself a design decision: reaching for the legendary should cost you
a beat.

### Cell

```
width: 60      height: 84      // the pressable
```

Composition, top to bottom:

| Element | Spec |
|---|---|
| Cup sprite | 34pt wide → 51pt tall at `CUP_ASPECT`. `BobaCupSprite` with this drink's palette. |
| Rarity frame | 2pt inset border around the whole cell face |
| Cost badge | Bottom-aligned row: `PearlIcon size={8}` + cost in 10pt |

Rarity frame colours reuse the app's existing accents so nothing new enters the
palette:

| Rarity | Frame | Notes |
|---|---|---|
| common | `#B08A63` | the room's own woodwork brown |
| rare | `#8FC2E1` | mission blue |
| epic | `#B8A5EF` | calendar violet |
| legendary | `#E4C983` | achievement gold |
| ultra | animated | cycles gold → violet → sky → mint on a 1400ms loop |

### Cell states

| State | Treatment |
|---|---|
| **Idle, affordable** | Full opacity, flat face |
| **Idle, unaffordable** | `opacity: 0.42`; cost text `#C0564E`; press is a no-op with a 120ms horizontal shake (±3pt, 3 cycles) |
| **Pressed** | Face drops **exactly 4pt with no easing** and the bevel inverts — pixel UI has no sub-pixel positions to ease through (convention 5, matching `PixelButton`) |
| **Brewed / loaded** | Cell lifts `translateY: -6`; a 4pt gold bar (`#E4C983`) underlines the full cell width; face lightens one step |
| **Peeking** (long-press held) | Same lift as loaded, but the underline is hollow — 4pt bar, 1pt gold outline, transparent fill |

Exactly one cell is loaded at a time. Loading is free and instant — **pearls are
spent on the drop, never on the brew.** A player can re-brew fifty times while
deciding and pay nothing. Charging on brew would make experimenting expensive,
which is the opposite of the goal.

---

## 4. The brew

Tapping a cell runs a 420ms sequence at the counter. It exists so that choosing
a drink has a physical consequence on screen rather than just changing a
highlight.

| t (ms) | Event |
|---|---|
| 0 | Cell face drops 4pt. Haptic: `impactLight`. |
| 0 | Counter cup swaps to the new drink's palette, `fill` snaps to 0 |
| 0–260 | `fill` animates 0 → 1, `Easing.out(Easing.quad)` — the cup visibly fills |
| 40–440 | Three steam puffs rise from the cup, painted in the per-frame layer |
| 60 | Cell settles into the loaded lift (`translateY: -6`) |
| 0–1200 | Payout flash over the queue (§5) |

The cup's bob loop (`CafeCanvas.tsx`, the `bob` Animated.Value) pauses for the
duration and resumes at t=440.

**Steam** is drawn per-frame in the café's own pixel idiom — three 2×2 `PX` rects
rising from design `(195, 118)` with an eased vertical offset and a fade, on the
same `PixelPainter` the rest of the room uses. It is *not* a React overlay; it
belongs to the room.

---

## 5. The payout preview — the hook

**This is the mechanic the whole feature rests on.** Everything else is support.

When a recipe is brewed or peeked, every cat currently in the queue gets a badge
showing what *that specific drink* would earn from *that specific cat*.

```
        ┌───────┐      ┌───────┐      ┌───────┐
        │ +112  │      │  +40  │      │   −8  │
        │ ♥ ♥ ♥ │      │   ♥   │      │   ✕   │
        └───┬───┘      └───┬───┘      └───┬───┘
           🐱 KOI         🐱 MOCHI       🐱 OBSIDIAN
          (rare)         (common)      (legendary)
```

You are not consulting a table and then acting. You hold your thumb on the
Matcha and the queue tells you Koi is worth 112 coins. You slide to the Classic
and every number collapses to 20. The decision is made with your eyes, in about
400ms, without leaving the café.

### Badge anatomy

Positioned in screen space, converted from the cat's live design coords:

```ts
screenX = offsetX + cat.x * scale
screenY = cat.y * scale
// badge centre sits at screenY - 52 * scale, i.e. just above the want bubble
```

| Element | Spec |
|---|---|
| Plate | 44 × 26pt, cream `#FFF7EC`, 2pt border in the affinity colour, `borderRadius: 0` |
| Coin figure | 12pt, weight 800, `HandjetBubble` where loaded, `#7A5418` |
| Affinity row | Heart pips or a cross, 8pt, drawn as 3 slots so the row width never jumps |

| Affinity | Pips | Border | Coin figure |
|---|---|---|---|
| Favorite | `♥ ♥ ♥` | `#D87E97` | `×2.0`, gold |
| Likes | `♥` | `#E4C983` | `×1.4` |
| Fine | `–` | `#B08A63` | `×1.0` |
| Dislikes | `✕` | `#C0564E` | `×0.5`, and the **popularity delta shows in red** |

The dislike badge is the only one that shows two numbers — coins *and* a
`−0.20 pop`. A bad serve has to look bad, or condition (2) of the economy fails.

### Why these are React overlays, not canvas

`components/skiaCanvas2d.ts` has no `fillText`. It is deliberately not a general
polyfill (convention 7), so painting numbers into the canvas would mean adding
font handling to the shim, loading a typeface on the café screen, and threading
it through `PixelPainter`. The badges are at most 9, transient, and need opacity
animation — exactly what the cup already demonstrates React overlays are for.

**Font.** Badges set in `HandjetBubble` to match the hub. Loaded with `useFonts`
on the café screen, but **without a paint gate** — unlike `app/habits/index.tsx`,
which holds first paint because a late swap reflows every label. Here the first
paint is the room, badges are transient, and a font arriving 200ms late is
invisible. Fall back to the system font until it resolves.

### Lifecycle

| Trigger | Behaviour |
|---|---|
| Brew (tap) | Fade in 120ms, hold 900ms, fade out 180ms |
| Peek (long-press) | Fade in 120ms, hold **while pressed**, fade out 180ms on release |
| Cup lift (drag start) | Fade in 120ms, hold **for the whole drag** |
| A cat leaves mid-flash | Its badge fades independently over 180ms; the rest are untouched |

Badges never animate position. A queue cat drifts a few units per frame as the
line advances, and a badge that chases it reads as jitter. The badge samples the
cat's position **once on appear** and holds it. If the cat moves more than 24
design units from the sample, the badge fades rather than snapping.

### The speed / information trade

The preview appears on **drag**, not on tap-to-serve. There is no way to serve
without either lifting the cup (which shows you the numbers) or having brewed
recently (which showed you the numbers 900ms ago). But at high popularity —
`spawnIntervalMs` bottoms out at 25s and groups reach 3 — you will be brewing and
dragging fast enough that the flash expires before you act.

That is intentional and it is free: **rushing costs you information, not
accuracy.** No extra system, no penalty, just a consequence of how fast you're
moving.

---

## 6. The hand-off

The existing drag, essentially unchanged. Three modifications:

**1. The cup carries the brewed recipe.** Today `flavor` is derived from whatever
`bobaInventory` holds the most of (`CafeCanvas.tsx`, the `useMemo` near the
bottom). That whole derivation is deleted — `bobaInventory` is a write-only field
that nothing reads, confirmed. The cup renders `loadedRecipe` instead.

**2. Cost and affordability move per-drink.** `PEARLS_PER_CAT` is replaced by
`recipe.pearls`. `canServeFrontGroup()` checks `pearls >= recipe.pearls × groupSize`.
The hint under the cup shows the real cost.

**3. Drop targeting widens to the whole queue, not just the front group.**

Today `findDropTarget` only considers `getFrontGroupInQueue()`. That was correct
when every serve was identical. Now that drinks differ, being forced to serve
strictly front-to-back removes half the decision — you could never skip the
common to reach the legendary behind it.

Opening it up means a player can serve any cat in line. The front group keeps a
**+18 unit bonus to its effective drop radius**, so the natural, low-effort drop
still lands on the front — reaching past it should take a deliberate aim.

```ts
const radius = cat.groupId === frontGroupId ? DROP_RADIUS + 18 : DROP_RADIUS;
```

**Group serving.** Dropping on a cat serves its whole group with the loaded
recipe, as today — the affinity is evaluated **per cat**, so a group of three can
return three different multipliers off one drop. That is a good moment: a mixed
group makes the "which drink" question genuinely hard, because no single recipe
is right for all three.

**On release:**

| Outcome | Behaviour |
|---|---|
| Hit, affordable | Serve. Pour animation, hearts, coins arc to the counter, streak ticks. Cup springs home and re-brews the same recipe (you almost always want the same one twice). |
| Hit, unaffordable | No serve. Cup springs home. Rail scrolls to the cheapest affordable recipe and pulses it once. |
| No hit | Cup springs home. Nothing spent. (Existing behaviour — keep it.) |

The existing spring is `friction: 6, tension: 70`, `useNativeDriver: false`.
That last part is load-bearing: `setValue` runs during the drag and mixing
native and JS driving on one transform throws. Do not change it.

---

## 7. The serve payoff

~640ms of feedback per successful serve. This is where the loop either feels
good or doesn't.

| t (ms) | Event |
|---|---|
| 0 | Cup `fill` animates 1 → 0 over 220ms — it pours into the cat's paws |
| 0 | Haptic: `impactMedium` on favorite, `impactLight` otherwise |
| 120 | Target ring under the cat flashes to white and back over 160ms |
| 180 | Heart pips burst above the cat: 3 / 1 / 0 by affinity, rising 18 units and fading over 420ms |
| 180 | On a **dislike**: no hearts. A grey puff, and the cat's want bubble shows a crack for 600ms |
| 220 | Coin figure spawns at the cat and arcs to the coin pill in the TopBar over 380ms, easing `out(quad)` |
| 260 | Streak counter ticks and pulses (§8) |
| 300 | Cat begins walking to its seat — existing `sendCatToSeat` |

The coin arc terminates at the TopBar pill, which means the café overlay needs
the pill's screen position. Simplest correct answer: arc to a fixed point at
`(width - 96, 8)` in screen space and let the pill's own bounce sell the
landing. Measuring the pill across a Stack boundary is not worth the wiring.

---

## 8. The combo streak

The reason to reach for the right drink when a cheap one would do.

```
Serve a FAVORITE  → streak + 1
Serve LIKES/FINE  → streak holds, does not advance
Serve a DISLIKE   → streak breaks to 0
A cat WALKS OUT   → streak breaks to 0
```

| Streak | Multiplier | Visual |
|---|---|---|
| 0–2 | ×1.0 | counter hidden |
| 3–5 | ×1.2 | counter appears, gold |
| 6–9 | ×1.5 | counter warms to orange, gains a 2pt outline |
| 10+ | ×2.0 | counter goes white-hot, a slow 900ms pulse |

The multiplier applies to **coins only** — not pearls spent, not popularity, not
bond XP. Keeping it to one currency means it can be tuned to nothing without
touching the rest of the economy.

**Placement.** Immediately left of the coin pill's x-position, in the café
overlay — not in the TopBar. The TopBar is shared across every screen and the
streak is a café-only concept; putting it there would mean a persistent component
carrying state it has no business knowing.

**The break is louder than the build.** Losing a ×2.0 shows a 400ms red flash and
a shake. That asymmetry is what makes a 10-streak feel worth protecting.

**Not persisted.** The streak lives in a ref inside `CafeCanvas` and dies when
you leave the screen. It is a within-session performance, not a stat. Persisting
it would invite save-scumming and add a `CafeState` field for something that
should be ephemeral.

---

## 9. The inspect card

**A simplified version of this shipped early**, on both the café floor and the
town map: tap a waiting or seated cat (café) or a roaming one (town) and the
full `CatAlmanacSheet` opens as a bottom sheet, not the compact anchored card
below. There's no bond level or brewed-recipe payout to show yet — those need
Phase 1 (the rail) and Phase 4 (bond) — so the full sheet has everything the
small card would and nothing it wouldn't. The spec below is what the card
becomes once those exist; the hit-testing it describes is already built for
both surfaces (café: `CafeCanvas.tsx`'s `handleInspectTap`; town:
`TownMap.tsx`'s, against the live `Roamer` array).

Tap any cat in the queue — or seated — and a card opens anchored above its head.

This is the same component as the almanac's entry body, at a smaller size. Tap
to read, drag to act; the two gestures never fight because one targets a cat and
the other targets the cup.

```
        ┌──────────────────────────────┐
        │ 🐱   KOI              ★rare  │
        │      Bond 3  ●●●○○   +10%    │
        ├──────────────────────────────┤
        │ Loves    🥤 Sea Salt Cream   │
        │ Likes    🥤 Matcha  🥤 Taro  │
        │ Dislikes 🥤 Brown Sugar      │
        ├──────────────────────────────┤
        │ Brewed: Matcha    +58 ♥      │
        └──────────────┬───────────────┘
                      🐱
```

| Row | Content |
|---|---|
| Header | Mini sprite (28pt, `getMiniCatGrid`), name, rarity chip |
| Bond | Level, 5-dot progress, current tip % |
| Preferences | Favorite / likes / dislikes, **stated outright** — the almanac gives the answer, so does this |
| Footer | What the currently brewed recipe would pay this cat |

**Geometry.** 208 × 132pt, anchored so its bottom edge sits 8pt above the cat's
head at `screenY = cat.y * scale - 58 * scale`. Clamped to stay 8pt inside the
canvas on all sides — a cat at the top of the queue would otherwise push the card
under the TopBar.

**Dismissal.** Tap anywhere else, tap the same cat again, or start a drag. It
also auto-dismisses if its cat leaves. No close button; a card this size that
follows a tap should not need chrome.

**Hit-testing.** The canvas has no touch handling today. Add a full-canvas
`Pressable` *beneath* the cup and rail overlays, converting the touch point to
design units and finding the nearest cat within 30 design units of its centre.
It must not swallow the cup's `PanResponder` — the cup sits above it in the tree,
so it won't.

**Locked recipes in the preference rows** render as a greyed cup with a small
lock. Being told, on a cat standing in front of you, that its favorite is
something you don't own is the single most effective pull toward the gacha
machine in the app. That is deliberate.

---

## 10. Want bubbles

`drawWantBubble` currently draws a generic cup with `pal.classic`. It becomes
specific:

- Bubble shows the cat's **true favorite**, always — not the best drink you own
- If you own that recipe, the cup is drawn in its palette at full value
- If you don't, the cup draws in silhouette with a 3×4 lock glyph over it

Showing the true favorite means you'll frequently be told you can't win this one.
That's the point: it's the same job the almanac does — generating want — except
it happens at the moment of loss, with the cat right there. A player who has
never seen Aurora Fizz has no reason to want it.

The drawing already takes `pal`; it gains a `drink: DrinkId` and an `owned: boolean`.
The per-drink tea colour comes from `DRINKS[id].palette.tea`.

---

## 11. State machine

```
                    ┌────────────────────────────────────┐
                    │              IDLE                   │
                    │  cup on counter, bobbing if servable│
                    └───┬────────────┬───────────────┬────┘
             tap recipe │   long-press│      tap cat │
                        ▼             ▼              ▼
                   ┌─────────┐  ┌──────────┐  ┌───────────┐
                   │ BREWING │  │ PEEKING  │  │ INSPECTING│
                   │  420ms  │  │ (held)   │  │ (card up) │
                   └────┬────┘  └────┬─────┘  └─────┬─────┘
                        │  release   │   tap out /  │
                        ▼            └──► IDLE ◄────┘
                   ┌──────────┐
                   │  FLASH   │ 1200ms, auto-expires to IDLE
                   └────┬─────┘
                        │ cup grabbed (from IDLE or FLASH)
                        ▼
                   ┌──────────┐   release, no hit
                   │ DRAGGING │──────────────────► IDLE
                   └────┬─────┘
                        │ release on a cat, affordable
                        ▼
                   ┌──────────┐
                   │ SERVING  │ 640ms, non-interruptible
                   └────┬─────┘
                        ▼  re-brews the same recipe
                       IDLE
```

**SERVING is non-interruptible.** The rail disables and the canvas `Pressable`
stops hit-testing for its 640ms. Allowing a second drag mid-payout is how you pay
pearls twice against one queue snapshot — the exact class of bug the existing
"build the PanResponder once in a ref" comment guards against.

---

## 12. Component tree

```
CafeCanvas
├── <Canvas>                          existing — room + cats + steam + bubbles
├── <Pressable> canvasTouch           NEW — cat hit-testing, beneath everything
├── <PayoutBadge× n>                  NEW — screen-space, animated opacity
├── <InspectCard>                     NEW — anchored above the tapped cat
├── <Animated.View> cup               existing — PanResponder unchanged
├── <View> hint                       existing — cost text now per-drink
├── <StreakCounter>                   NEW — top-right, café-only
└── <RecipeRail>                      NEW — bottom overlay, horizontal scroll
    └── <RecipeCell× n>
```

### Files

| File | Change |
|---|---|
| `constants/drinks.ts` | **New.** 24 recipes: id, name, short name, rarity, vessel, pearls, baseCoins, hue anchor, cup palette, frame colour |
| `constants/vessels.ts` | **New.** Boba / coffee / tea silhouettes on one 20×30 grid |
| `constants/affinity.ts` | **New.** Pure. `affinityFor(catSpec, drinkId) → 'favorite'\|'likes'\|'fine'\|'dislikes'` by hue distance |
| `constants/bobaCup.ts` | `BobaFlavor` union widens to the 14 drink ids; `BOBA_PALETTE` gains 11 entries |
| `components/RecipeRail.tsx` | **New.** The rail and its cells |
| `components/PayoutBadge.tsx` | **New.** One badge |
| `components/CatInspectCard.tsx` | **New.** Shared with the almanac entry body |
| `components/StreakCounter.tsx` | **New.** |
| `components/CafeCanvas.tsx` | Loaded-recipe state, brew sequence, widened drop targeting, per-drink cost, streak ref, canvas hit-testing |
| `components/cafeRender.ts` | `drawWantBubble` takes a drink + owned flag; new `drawSteam` |
| `hooks/useCafeState.tsx` | `recipes: string[]` owned; `catBonds`; per-drink serve payout |

### The one thing to check before building the rail

`BobaFlavor` is currently `'classic' | 'matcha' | 'strawberry'` and
`BOBA_PALETTE` has three entries. Twenty-four distinct cup palettes is
twenty-four nine-colour objects, across the three silhouettes in
`constants/vessels.ts`. Two of those colours (`c` cream, `h` white) are constant
across all three existing entries and can be hoisted; the rest derive
mechanically from the drink's hue anchor via the same `toHsl` helpers
`catLore.ts` already uses. **Generate them, don't author them** — the same
reasoning the file header already gives for generating the grid rather than
hand-keeping four near-identical ones.

---

## 13. Timing and easing reference

| Motion | Duration | Easing |
|---|---|---|
| Cell press | 0 | none — instant 4pt drop |
| Cell lift to loaded | 60 | none — instant |
| Cup fill on brew | 260 | `out(quad)` |
| Cup pour on serve | 220 | `in(quad)` |
| Steam puff | 400 | linear rise, `out(quad)` fade |
| Badge fade in | 120 | `out(quad)` |
| Badge hold | 900 | — |
| Badge fade out | 180 | `in(quad)` |
| Heart burst | 420 | `out(cubic)` rise, linear fade |
| Coin arc | 380 | `out(quad)` |
| Streak tick pulse | 260 | `out(back)` |
| Streak break flash | 400 | `in(quad)` |
| Cup spring home | — | `spring(friction: 6, tension: 70)` — **existing, don't touch** |
| Cup bob | 780 ×2 | `inOut(quad)` — **existing** |
| Unaffordable shake | 120 | 3 cycles, ±3pt |

Everything on the rail is instant-or-nothing; everything in the room eases.
That split is deliberate — the rail is UI drawn in the pixel idiom (convention 5:
no sub-pixel positions to ease through), the room is a physical space.

---

## 14. Edge cases

| Case | Behaviour |
|---|---|
| No recipe brewed yet | Cup shows Classic Milk Tea, the always-owned starter. Rail marks it loaded on mount. |
| Brewed recipe becomes unaffordable mid-drag | Drop is refused; cup springs home; rail pulses the cheapest affordable. No partial charge. |
| Group larger than affordable | `canServe` is false for the whole group. The hint reads the true cost so you can see the gap. |
| Cat leaves mid-drag | `dragTargetRef` is already validated against `catsRef.current.includes(target)` in the render loop — extend the same check to release. |
| Inspect card open, its cat leaves | Card fades over 180ms. |
| Inspect card open, drag starts | Card dismisses immediately, no fade. |
| Rail scrolled mid-brew | Loaded cell keeps its lift; no auto-scroll. Auto-scrolling under a moving thumb is the worst feeling in mobile UI. |
| Screen rotates / resizes | `scale` and `offsetX` recompute; badges resample position; card re-clamps. The render loop reads size through `designHeightRef` and must not restart. |
| Night crossover mid-session | Rail and card take their surface from the café palette, which already re-checks `isNightAt()` on a 60s timer. |
| Player owns 1 recipe | Rail renders one cell, centred rather than left-aligned. |
| Player owns all 24 | Rail scrolls ~4.2 screens. Acceptable; no paging — the cost order means the cheap ones are always at rest position. |

---

## 15. Deliberately not in this pass

- **Patience timers and walk-outs.** The economy needs them — holding pearls is
  free while cats queue forever, and the streak needs a way to break that isn't
  the player's own bad serve. But they change spawn pacing, the queue state
  machine and the guide script, and they are separable from the serve gesture.
  Next pass, and the streak's walk-out break wires up then.
- ~~Tap-to-inspect on the town map.~~ **Built** — see §9.
- ~~Gacha unlocking recipes.~~ **Built** — the capsule machine's second
  hopper, per `DRINK-ECONOMY.md` Phase 6.
- **Toppings, sizes, temperature.** A second axis of choice on top of 24 recipes
  and 36 cats is more combinations than a player can hold. Not until the first
  axis is proven.
