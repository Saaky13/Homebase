# Drinks, Preferences & Bonds — the plan

The café currently pays a flat 25 coins for any cat and any drink. Nothing you
know about a cat changes what you do. This plan replaces that with a per-serve
decision: **which drink, for which cat, at what pearl cost, for what return.**

The interaction that carries this is specified separately in
**`SERVE-INTERACTION.md`** — this document is the numbers and the sequencing.

---

## The core loop we're building toward

```
A cat walks in. Its want bubble shows the drink it loves — greyed with a lock
if you don't own that recipe yet.
  → Thumb on the recipe rail. Hold a drink: the whole queue lights up with what
    that drink would pay each cat.
  → You have N pearls. Drinks cost 3–35 pearls each.
  → Serve the cheap one it merely tolerates?   small coins, streak holds
    Serve the expensive one it loves?          big coins, streak advances
    Skip this cat for the legendary behind it? the cheap cat eventually leaves
```

Every one of those is a real choice only if three things are true:

1. **Drinks cost meaningfully different amounts.** Otherwise you always brew the best.
2. **A wrong drink is actually bad**, not just less good. Otherwise you always serve.
3. **Waiting costs something.** Otherwise holding pearls is free and you always hold.

(3) is the one that doesn't exist today — cats queue forever. It needs a patience
timer or the whole economy is solvable by stalling. It lands in Phase 3.

---

## Phase 0 — Data foundation

*No gameplay change. Everything derived, nothing authored per-cat.*

### `constants/drinks.ts` (new)

**24 drinks** across the same five rarities as cats, in **three vessels** —
boba, coffee and tea. It is a café, not a boba stand; a Flat White drawn as a
cup with tapioca in it is a lie the sprite tells before the name can correct
it. `constants/vessels.ts` generates all three silhouettes on one 20×30 grid
from one nine-key palette, so a drink names its vessel and its hue and the art
follows.

Each also carries a **hue anchor**, which is what lets affinity be derived
rather than hand-written for 36×24 pairs.

| Rarity | Drink | Vessel | Pearls | Coins | c/p | Hue |
|---|---|---|---|---|---|---|
| common | Classic Milk Tea | boba | 3 | 20 | 6.7 | — |
| common | House Drip | coffee | 3 | 20 | 6.7 | 26 |
| common | Jasmine Green | tea | 4 | 26 | 6.5 | 100 |
| common | Honey Oolong | boba | 4 | 26 | 6.5 | 40 |
| common | Brown Sugar | boba | 5 | 32 | 6.4 | 30 |
| common | Café au Lait | coffee | 5 | 32 | 6.4 | 35 |
| rare | Earl Grey | tea | 7 | 48 | 6.9 | 17 |
| rare | Matcha Latte | boba | 7 | 48 | 6.9 | 130 |
| rare | Flat White | coffee | 8 | 54 | 6.8 | 22 |
| rare | Strawberry Cream | boba | 8 | 54 | 6.8 | 346 |
| rare | Mango Sago | boba | 9 | 62 | 6.9 | 42 |
| rare | Taro Swirl | boba | 9 | 62 | 6.9 | 272 |
| rare | Sea Salt Cream | boba | 10 | 68 | 6.8 | 205 |
| epic | Peach Oolong | tea | 13 | 92 | 7.1 | 12 |
| epic | Genmaicha | tea | 14 | 98 | 7.0 | 140 |
| epic | Hojicha Latte | tea | 14 | 98 | 7.0 | 35 |
| epic | Lavender Haze | boba | 15 | 106 | 7.1 | 262 |
| epic | Espresso Tonic | coffee | 15 | 106 | 7.1 | 190 |
| epic | Black Sesame | boba | 16 | 114 | 7.1 | — |
| **legendary** | **Reserve Roast** | coffee | 22 | **210** | **9.5** | 16 |
| **legendary** | **Golden Osmanthus** | tea | 24 | **240** | **10.0** | 45 |
| **legendary** | **Midnight Yuzu** | boba | 26 | **270** | **10.4** | — |
| **legendary** | **Ube Cloud** | boba | 28 | **300** | **10.7** | 288 |
| **ultra** | **Aurora Fizz** | boba | 35 | **420** | **12.0** | — |

### The payout cliff

Common through epic converts pearls to coins at a near-flat **6.4–7.1**.
Legendary jumps to **9.5–10.7**, and the ultra to **12.0**.

That discontinuity is the point. A legendary is not a bigger drink, it is a
different class of drink — and because the cliff sits at a rarity boundary
rather than sloping the whole way up, the mid-game stays about *matching*
rather than about hoarding for the most expensive thing on the rail.

Stacked with a favorite match (×2.0), a maxed café (×2.0) and a ten-streak
(×2.0), one Aurora Fizz handed to Prism pays **3,360 coins**. It needs the
ultra cat in your queue, the ultra recipe in your rail, a café you finished
building and ten correct serves in a row — so it should be enormous when it
finally happens.

*(First-pass numbers. Phase 7 rebalances against real play.)*

### Anchors are placed on cats, not on the colour wheel

The 36 coats are not evenly spread: **15 of them sit between hue 13 and 43** —
gingers, sands, clays, honeys — while the greens hold 3 and the pinks 3. Anchors
spaced evenly across 360° left five drinks as nobody's favorite and gave Sea
Salt Cream five.

So each drink is anchored near a cluster of cats **of its own rarity**: Peach
Oolong at 12 for Ember (epic, 13), Reserve Roast at 16 for Aurora the cat
(legendary, 16), Golden Osmanthus at 45 for Sunbeam (legendary, 43). All 24
drinks are now some cat's favorite, and the spread runs 1–3 rather than 0–5.

### `constants/affinity.ts` (new)

`affinityFor(cat, drink)` — pure, extending the hue analysis `catLore.ts`
already does:

- **Favorite** — the best match once rarity is folded in. The rarity pull is
  **asymmetric**: dragging a legendary cat *down* to a common drink costs 26
  per band, a common cat reaching *up* only 10. That asymmetry is the "save
  your pearls for this one" pressure, and a symmetric version left the ultra
  drink as nobody's favorite.
- **Likes** — the next two nearest.
- **Dislikes** — hue distance > 150° (the complement of its coat).
- **Fine** — everything else.

Neutral coats anchor on luminance instead of hue: Classic Milk Tea for the mid
and pale ones, Black Sesame at 0.46 and Midnight Yuzu at 0.31 for the dark.
Those targets look high for cats called Pepper and Cinder — no cat in the
roster has a genuinely black *body*, only dark outlines, and Obsidian at 0.306
is the darkest in the game.

**Aurora Fizz is the one exception to the whole scheme**: it matches on rarity,
not colour. There is one ultra cat and one ultra drink and they belong to each
other.

This keeps the rule **readable off the sprite**: a green cat drinks green things,
a legendary cat wants something expensive.

### New state

```ts
interface CatBond {
  xp: number;
  level: number;              // 1–5
  adoptedOn: string | null;
  timesServed: number;
  lastServedOn: string | null;
}
// on CafeState:
catBonds: Record<string, CatBond>;
recipes: string[];            // drink ids you can brew
```

No `discovered` map — the almanac states preferences outright, so there is
nothing to record having learned. `catStats` (already built on `cat-almanac`)
folds into `CatBond` rather than sitting beside it. Migration backfills from
`ownedCats`; `recipes` seeds with the three commons so an existing save can
still serve.

---

## Phase 1 — The recipe rail and the brew

The interaction, per `SERVE-INTERACTION.md`. Summary of what ships:

- Bottom recipe rail: tap to brew, long-press to peek
- Payout preview badges over the queue on brew, peek, and cup-lift
- The counter cup carries the brewed recipe; `bobaInventory`'s dead derivation
  is deleted
- Per-drink pearl cost replaces flat `PEARLS_PER_CAT`
- Drop targeting widens past the front group, with an 18-unit bias toward it

No payout changes yet — coins stay flat at 25 so the interaction can be tuned
on its own before the economy moves under it.

---

## Phase 2 — The payout rewrite

Rip out the flat numbers in `CafeCanvas.serveFrontGroup`.

| Affinity | Coin mult | Popularity | Bond XP mult |
|---|---|---|---|
| Favorite | ×2.0 | +0.30 | ×3 |
| Likes | ×1.4 | +0.15 | ×2 |
| Fine | ×1.0 | +0.05 | ×1 |
| **Dislikes** | **×0.5** | **−0.20** | **×0** |

```
coins = drink.baseCoins × affinityMult × cafeMultiplier × streakMult × bondTip
xp    = drink.pearls × affinityXpMult
```

**Affinity is evaluated per cat, not per group.** One drop on a group of three
returns three different multipliers. A mixed group is the hardest question the
café asks, because no single recipe is right for all of them.

**The combo streak** (`SERVE-INTERACTION.md` §8) multiplies coins only —
×1.2 / ×1.5 / ×2.0 at 3 / 6 / 10 consecutive favorite matches. It is ephemeral,
lives in a ref, and never persists.

---

## Phase 3 — Patience

The missing third condition. A queued cat gets a timer — generous at low
popularity (90s), tightening as the café fills — and walks out unserved, costing
a small amount of popularity and breaking the streak.

Without it, holding pearls is free and the optimal play is always to stall for
the best cat. With it, the queue is a clock.

This also gives the streak a way to break that isn't the player's own mistake,
which is what makes a 10-streak feel precarious rather than merely long.

`bobaInventory` finally gets spent here: focus sessions brew **free stock** of
recipes you own, and serving draws from stock before it charges pearls. Focus
time becomes prep time, and a long session buys you a rush you can actually
survive.

---

## Phase 4 — Bond levels

Serving a cat well deepens your relationship with **that specific cat**, and the
payoff is simple and one-dimensional: **it tips you more coins.**

| Level | Tip |
|---|---|
| 1 | — |
| 2 | +5% coins from this cat |
| 3 | +10% |
| 4 | +20% |
| 5 | +35% |

XP to L5: common 400, rare 700, epic 1100, legendary 1700, ultra 2800.

No perks, no spawn weighting, no unlocks gated behind a level. Bond is a
number that goes up and pays you back, and the only way to move it is to serve
that cat drinks it actually likes — a favorite match is worth 3× the XP of a
neutral one, and a dislike is worth nothing at all.

The reason to care about a legendary is therefore not that its bond is special,
but that it is *slow*: 2800 XP is a long relationship, and the cat you've been
matching correctly for weeks pays 35% more than the one you've been handing
milk tea to.

---

## Phase 5 — The almanac

**The almanac gives you the answer.** Every entry states the cat's favorite,
likes and dislikes outright, from the moment you open it, owned or not.

It is deliberately low-utility. It is not a puzzle, not a research log, not a
tool you need. It exists so you can browse 36 cats and want them — the Battle
Cats encyclopedia, where half the reason to keep playing is that you saw the
art for a unit you don't have yet.

**Home: the Cat Shelter, as a third tab.**

| Tab | What it is |
|---|---|
| **Adopt** | The capsule machine |
| **Collection** | What you own — bond level, tip %, times served, first met |
| **Almanac** | Everything that exists, owned or not |

Collection is your relationship. Almanac is the catalogue. Collapsing them into
one screen — which the current `cat-almanac` branch does — loses both.

### Cat entry

Big sprite · `#017 / 36` · rarity · generated flavour text · **favorite, likes
and dislikes stated plainly** · draw odds · coat, pattern, eyes, tail · and if
owned, bond level, tip %, times served, first met.

Locked cats show a silhouette, the rarity, the odds, and one teaser line. Name,
prose and traits stay hidden — enough to want it, not enough to have it.

### Drink entry

The almanac's second half. Cup art · rarity · pearl cost · base coins · **which
cats favor it**. That last line is the one that does the work: you browse to
Aurora Fizz, see the four cats that love it, and go want those cats.

Locked recipes appear too, for the same reason.

---

## Phase 6 — Gacha gives recipes — **built**

*Landed early, out of order: the almanac was showing 24 drinks nobody owned, so
the catalogue was making a promise the save file couldn't keep.*

`state.recipes` is the menu — a `DrinkId[]` seeded with `STARTER_RECIPES`,
migrated onto old saves and filtered against the roster on load so a retired id
can't sit in the menu as a cup with no spec behind it.

The capsule machine has a second hopper. A segmented switch above it —
**Cats** / **Recipes** — with the same rarity weights, the same
no-duplicates rule, and the same reveal. `pickCat` and `pickDrink` are both
one line over a generic `pickUnowned`, because "the same odds" should be the
same code rather than two copies that drift.

Prices are a **separate ladder**: `15 / 30 / 60 / 120` against the cats'
`10 / 25 / 50 / 100`. A cat is a collectible; a recipe is an engine that pays
coins for the rest of the save. Pricing them the same would make cats the
obvious early buy and recipes the obvious buy forever after, which is not a
choice.

No auto-convert once the cat roster completes — the toggle is right there, and
a mode that silently becomes a different mode is worse than one you pick.

**Where ownership shows up:**

| Surface | Treatment |
|---|---|
| Machine tab | Mode switch carries each collection's count |
| Hero card | Two tracks — cats in gold, recipes in teal |
| Collection | "Your menu" grid: owned recipes, cost, how many of *your* cats love it |
| Almanac | All 24, grouped by rarity, locked rows dimmed with a LOCKED chip — the cup still draws, because wanting it is the point |
| Cat entry | The LOVES line says "not on your menu yet" when you can't pour it |
| Adoption reveal | Same marker — a cat arriving with a drink you can't make is the clearest reason the machine has a second hopper |
| Recipe reveal | Mirrored: which of your cats have been waiting for this |

---

## Phase 7 — Tuning & tie-ins

- Rebalance against real play. The numbers above are first-pass.
- **Greenhouse toppings**: a harvested plant yields a topping that bumps one
  serve up an affinity step. Gives the greenhouse a reason to feed the café.
- **Order tickets**: occasionally a cat arrives demanding one specific drink at a
  premium, ignoring its own preferences. A rush event.
- ~~Tap-to-inspect on the town map~~ — **built**, landed early alongside the
  café-floor version. Both reuse the full `CatAlmanacSheet` rather than the
  compact anchored card `SERVE-INTERACTION.md` §9 specifies — there's no bond
  level or brewed-recipe preview to show yet, so the smaller card has nothing
  over the sheet. §9's version is worth building once Phase 1 (the rail) and
  Phase 4 (bond) exist to fill it.
- Achievements for almanac completion, per-rarity bonds, first legendary match.

---

## Sequencing note

**Phases 0–2 are one shippable unit.** After them the game is different: you
choose a drink, the choice pays differently, and you can see why.

Phase 3 (patience) is what stops the result being solvable by stalling, and
should follow closely.

The almanac is Phase 5 on purpose. Built earlier it is what we already have —
a description with nothing behind it. It only becomes worth browsing once the
preferences it lists are preferences you act on.
