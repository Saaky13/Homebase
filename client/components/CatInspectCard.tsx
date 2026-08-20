import React from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CatSprite } from './CatSprite';
import { CupSprite } from './CupSprite';
import { preferencesFor, serveOutcome } from '../constants/affinity';
import { DRINKS, DRINK_INK, type DrinkId } from '../constants/drinks';
import { RARITY_STYLE, type CatSpec } from '../constants/catSprites';
import { bondProgress, bondTip, tipLabel } from '../constants/bonds';
import { colors } from '../constants/colors';

/**
 * The card that opens over a cat's head when you tap it.
 *
 * `SERVE-INTERACTION.md` §9. It answers "what does this one want" and nothing
 * else; the full `CatAlmanacSheet` is the catalogue, one tap away through the
 * button in the header.
 *
 * **Wide and translucent, not tall and opaque.** The first cut of this card
 * stacked everything in one 236px column and buried the queue it was
 * describing. This one goes wide (the room is wider than it is generous with
 * vertical space around a cat), runs the likes and dislikes as two side-by-side
 * columns, and frosts the background so the floor stays visible through it —
 * how much a card *blocks* is mostly about opacity, not area.
 *
 * The bond row sits directly under the header, above the drinks: it is the
 * one line on the card that is about *this* cat rather than about its species,
 * and it changes as you play.
 *
 * **Position is driven by `Animated.Value`s, not props.** Both callers move
 * their cats inside a `requestAnimationFrame` loop that deliberately never
 * re-renders React; feeding the position through props would put a full
 * re-render of this card on every frame of a cat's walk. The parent writes to
 * `pos`, `pointerX` and `flip` with `setValue` instead, and this component
 * re-renders only when the cat itself changes.
 */

/** Fixed so the anchor maths can centre the card before it has laid out. */
export const CARD_W = 268;
/**
 * Height used for the very first frame, before `onLayout` reports the real
 * one. Sized for the common case — a full six likes and four dislikes — so
 * the card doesn't visibly jump on the frame after it opens.
 */
export const CARD_H_ESTIMATE = 262;
export const CARD_GAP = 8;
/** The card never comes closer than this to the edge of its container. */
export const CARD_EDGE = 8;

/** Dislikes past this are cut. They are the least useful half of the card. */
const MAX_DISLIKES = 4;

/**
 * The frosted surface. `colors.paper` with enough alpha that the floor —
 * and the queue the card is describing — reads through it. `backdropFilter`
 * is CSS, so react-native-web forwards it and native ignores it: on a device
 * the card is simply translucent without the blur, which degrades gracefully
 * rather than breaking. Everything that must match the surface (the tails)
 * uses the same constant.
 */
const FROST_BG = 'rgba(255,249,240,0.82)';
const FROST_BORDER = 'rgba(233,209,183,0.95)';
const FROST_BLUR =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)' } as const)
    : null;

export interface CardAnchor {
  x: number;
  y: number;
  pointerX: number;
  /** True when the card sits under the cat rather than over its head. */
  below: boolean;
}

/**
 * Where the card sits, given the cat's head and feet. All values in container
 * pixels.
 *
 * Shared by both callers so the café and the town can't drift apart on
 * something as visible as which side of a cat the card lands.
 */
export function anchorCard(
  headX: number,
  headY: number,
  footY: number,
  bounds: { width: number; height: number },
  cardH: number
): CardAnchor {
  const x = Math.max(
    CARD_EDGE,
    Math.min(headX - CARD_W / 2, bounds.width - CARD_W - CARD_EDGE)
  );

  let below = false;
  let y = headY - CARD_GAP - cardH;

  // A cat at the front of the line has the counter right above it and no room
  // for a card. Clamping just buried the cat under its own card, so it drops
  // below the cat's feet instead and the tail moves to the top edge.
  if (y < CARD_EDGE) {
    const under = footY + CARD_GAP;
    if (under + cardH <= bounds.height - CARD_EDGE) {
      y = under;
      below = true;
    } else {
      y = CARD_EDGE;
    }
  }

  y = Math.max(CARD_EDGE, Math.min(y, bounds.height - cardH - CARD_EDGE));

  // The pointer tracks the cat even once the card has been clamped sideways,
  // which is the only thing still tying the two together at a screen edge.
  // Kept off the rounded corners, where a tail would float free of the border.
  const pointerX = Math.max(18, Math.min(headX - x, CARD_W - 18));

  return { x, y, pointerX, below };
}

/**
 * The three numbers a serve moves, in fixed columns so every row lines up and
 * the section header can double as their legend.
 *
 * Colour carries which is which — gold coins, lavender pearls, plum bond XP,
 * the same three the TopBar and the bond row already use — because three
 * labelled figures per row on a 268px card is more ink than the card has.
 * Only the pearls keep a symbol, since they are the one figure going *out*.
 */
function Figures({
  coins,
  pearls,
  xp,
  dim,
}: {
  coins: number;
  pearls: number;
  xp: number;
  dim?: boolean;
}) {
  return (
    <>
      <Text style={[styles.fCoins, dim && styles.fDim]}>+{coins}</Text>
      <Text style={[styles.fPearls, dim && styles.fDim]}>{pearls}◆</Text>
      <Text style={[styles.fXp, dim && styles.fDim]}>{xp > 0 ? `+${xp}` : '0'}</Text>
    </>
  );
}

/** The favourite, given its own row — it is the answer the tap asked for. */
function HeroRow({
  drink,
  onMenu,
  coins,
  xp,
  onPick,
}: {
  drink: DrinkId;
  onMenu: boolean;
  coins: number;
  xp: number;
  onPick?: () => void;
}) {
  const spec = DRINKS[drink];
  // The card names the drink you should be pouring; making that name the
  // button is the shortest path there is from "what does this cat want" to a
  // loaded machine. Not on your menu means not pourable, so it stays inert.
  const pickable = onMenu && !!onPick;

  return (
    <Pressable
      onPress={pickable ? onPick : undefined}
      disabled={!pickable}
      style={({ pressed }) => [styles.hero, pressed && pickable && styles.heroPressed]}
    >
      <CupSprite drink={drink} width={20} />
      <Text style={[styles.heroName, { color: DRINK_INK[spec.rarity] }]} numberOfLines={1}>
        {spec.name}
      </Text>
      {/* Being told, on a cat standing in front of you, that its favourite is
          something you can't pour is the strongest pull toward the machine
          in the app. It also teaches what the dimmed rows below mean. */}
      {!onMenu && <Text style={styles.heroMissing}>not on your menu</Text>}
      {pickable && <Text style={styles.heroLoad}>LOAD</Text>}
      <Figures coins={coins} pearls={spec.pearls} xp={xp} dim={!onMenu} />
    </Pressable>
  );
}

/** One drink on the list: tiny cup, name, and what serving it would move. */
function DrinkRow({
  drink,
  coins,
  xp,
  locked,
  onPick,
}: {
  drink: DrinkId;
  coins: number;
  xp: number;
  /** Not on the player's menu. */
  locked?: boolean;
  /** Load this one into the machine. Absent on rows that can't be poured. */
  onPick?: () => void;
}) {
  const spec = DRINKS[drink];
  const pickable = !locked && !!onPick;

  return (
    <Pressable
      onPress={pickable ? onPick : undefined}
      disabled={!pickable}
      style={({ pressed }) => [
        styles.row,
        locked && styles.rowDim,
        pressed && pickable && styles.rowPressed,
      ]}
    >
      <CupSprite drink={drink} width={13} />
      {/* The name carries the rarity — no chip, no second line. A row is
          15px tall and this is the only channel it has spare. */}
      <Text style={[styles.rowName, { color: DRINK_INK[spec.rarity] }]} numberOfLines={1}>
        {spec.name}
      </Text>
      <Figures coins={coins} pearls={spec.pearls} xp={xp} dim={locked} />
    </Pressable>
  );
}

/**
 * How well you know this one, and what it tips.
 *
 * One row, not a panel: the level, the coin tip it currently pays, and a well
 * showing the walk to the next level. The remaining-XP number is deliberately
 * on the same line as the bar rather than under it — the bar alone says "some
 * progress", and the thing a player actually wants is how much further.
 */
function BondRow({ cat, xp }: { cat: CatSpec; xp: number }) {
  const bond = bondProgress(xp, cat.rarity);

  return (
    <View style={styles.bond}>
      <Text style={styles.bondLabel}>BOND</Text>
      <View style={styles.bondTrack}>
        <View
          style={[
            styles.bondFill,
            // Maxed reads as a full bar rather than an empty one — `fraction`
            // is 1 at max precisely so this needs no special case.
            { width: `${Math.round(bond.fraction * 100)}%` },
          ]}
        />
      </View>
      <Text style={styles.bondLevel}>Lv {bond.level}</Text>
      <Text style={styles.bondTip}>{tipLabel(bond.level)}</Text>
      <Text style={styles.bondNext}>
        {bond.maxed ? 'max' : `${bond.remaining} to go`}
      </Text>
    </View>
  );
}

function Section({
  label,
  tint,
  figures,
}: {
  label: string;
  tint: string;
  /**
   * Head the three figure columns beneath. The section label is the only spare
   * line on the card, so it doubles as the legend — otherwise each row would
   * have to carry its own labels, which is three times the ink for a fact that
   * only needs saying once per list.
   */
  figures?: boolean;
}) {
  if (!figures) return <Text style={[styles.section, { color: tint }]}>{label}</Text>;
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, styles.sectionGrow, { color: tint }]}>{label}</Text>
      <Text style={[styles.legend, styles.fCoins]}>coins</Text>
      <Text style={[styles.legend, styles.fPearls]}>cost</Text>
      <Text style={[styles.legend, styles.fXp]}>bond</Text>
    </View>
  );
}

export default function CatInspectCard({
  cat,
  recipes,
  bondXp,
  pos,
  pointerX,
  flip,
  onHeight,
  onOpenAlmanac,
  onPickDrink,
}: {
  cat: CatSpec;
  /** The player's menu, so a row can say whether it can be brewed. */
  recipes: DrinkId[];
  /** This cat's banked bond XP. Level and tip derive from it — see `bonds.ts`. */
  bondXp: number;
  pos: Animated.ValueXY;
  pointerX: Animated.Value;
  /** 0 when the card is above the cat, 1 when below. Picks which tail shows. */
  flip: Animated.Value;
  /** Reports measured height back so the parent can anchor off the real box. */
  onHeight: (h: number) => void;
  /** Jump to this cat's full entry in the almanac. */
  onOpenAlmanac: () => void;
  /**
   * Load a drink into the machine. Only ever called with something on the
   * player's menu — a locked row has nothing to load. Omitted by the town map,
   * where there is no machine to load into and the card is read-only.
   */
  onPickDrink?: (drink: DrinkId) => void;
}) {
  const rarity = RARITY_STYLE[cat.rarity];
  const prefs = preferencesFor(cat);
  const owns = (id: DrinkId) => recipes.includes(id);

  const dislikes = prefs.dislikes.slice(0, MAX_DISLIKES);

  // What each drink is actually worth *to this cat, right now*. The tip is
  // read once from the bond the cat walked in with, which is the same figure
  // the till will use when the cup is handed over (convention 19) — the card
  // would be lying if it quoted a rate the serve doesn't pay.
  const tip = bondTip(bondXp, cat.rarity);
  const payout = (id: DrinkId) => serveOutcome(cat, id, { bondTip: tip });
  const handleLayout = (e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height);

  return (
    // `box-none`, not `none`: the card itself is no longer fully transparent to
    // touches because the almanac button in the header has to be pressable.
    // The body still has no handlers, so tapping prose does nothing — taps on
    // the floor around the card keep going to the dismissal layer beneath.
    <Animated.View
      pointerEvents="box-none"
      onLayout={handleLayout}
      style={[
        styles.card,
        FROST_BLUR,
        { transform: [{ translateX: pos.x }, { translateY: pos.y }] },
      ]}
    >
      <View style={styles.header}>
        <CatSprite catId={cat.id} size={26} />
        <Text style={styles.name} numberOfLines={1}>
          {cat.name}
        </Text>
        <View style={[styles.rarityChip, { backgroundColor: rarity.ring }]}>
          <Text style={styles.rarityText}>{rarity.label}</Text>
        </View>
        <Pressable
          onPress={onOpenAlmanac}
          hitSlop={6}
          style={({ pressed }) => [styles.almanacBtn, pressed && styles.almanacBtnPressed]}
        >
          <Text style={styles.almanacBtnText}>ALMANAC ›</Text>
        </Pressable>
      </View>

      <View style={styles.rule} />

      <BondRow cat={cat} xp={bondXp} />

      <Section label="LOVES" tint={colors.accentBlush} figures />
      <HeroRow
        drink={prefs.favorite}
        onMenu={owns(prefs.favorite)}
        coins={payout(prefs.favorite).coins}
        xp={payout(prefs.favorite).xp}
        onPick={onPickDrink && (() => onPickDrink(prefs.favorite))}
      />

      {/* One column, not two. The side-by-side split existed to keep the card
          short, and it cost each list about 120px of width — enough for a name
          and a price, and nowhere near enough for the three figures a serve
          actually moves. Full width buys those columns back; the dislikes give
          up their rows to pay for it, which costs nothing because a drink this
          cat won't touch has no payout worth tabulating. */}
      <Section label="LIKES" tint={colors.accentTeal} figures />
      {prefs.likes.map((id) => (
        <DrinkRow
          key={id}
          drink={id}
          coins={payout(id).coins}
          xp={payout(id).xp}
          locked={!owns(id)}
          onPick={onPickDrink && (() => onPickDrink(id))}
        />
      ))}

      <Section label="WON'T DRINK" tint={colors.mediumGray} />
      <Text style={styles.dislikeLine} numberOfLines={2}>
        {dislikes.map((id) => DRINKS[id].short).join('  ·  ')}
      </Text>

      {/* Both tails are rendered and cross-faded, because which one shows has
          to change from inside a render loop that never re-renders React —
          an `Animated.Value` can drive opacity but can't swap a style prop. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.tail, styles.tailDown, { left: pointerX, opacity: flipTo(flip, 1, 0) }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.tail, styles.tailUp, { left: pointerX, opacity: flipTo(flip, 0, 1) }]}
      />
    </Animated.View>
  );
}

/** `flip` is 0 above / 1 below; this reads it as an opacity for one tail. */
function flipTo(flip: Animated.Value, atAbove: number, atBelow: number) {
  return flip.interpolate({ inputRange: [0, 1], outputRange: [atAbove, atBelow] });
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARD_W,
    backgroundColor: FROST_BG,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: FROST_BORDER,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 8,
    // Stacking is left to tree order on purpose: the callers place this above
    // the canvas and its dismissal layer but below the cup, and a zIndex here
    // would float it over the cup no matter where they put it.
    shadowColor: 'rgba(92,58,42,1)',
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 13, fontWeight: '900', color: colors.darkBrown },
  rarityChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  rarityText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.4,
  },
  almanacBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brown300,
    backgroundColor: 'rgba(255,253,248,0.85)',
  },
  almanacBtnPressed: { backgroundColor: colors.cream },
  almanacBtnText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.brown700,
  },

  rule: { height: 1, backgroundColor: 'rgba(233,209,183,0.7)', marginTop: 6 },

  bond: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  bondLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.brown500,
  },
  // Sunken well, flat fill — the same well the rest of the app draws progress
  // in, at the one size that fits between two labels on a 268px card.
  bondTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(213,176,141,0.45)',
  },
  bondFill: { height: '100%', borderRadius: 3, backgroundColor: colors.lavender },
  bondLevel: { fontSize: 9, fontWeight: '900', color: colors.darkBrown },
  // Gold, because it is coins — the same colour the pills pay them out in.
  bondTip: { fontSize: 9, fontWeight: '900', color: colors.accentGold },
  bondNext: { fontSize: 8, fontWeight: '700', color: colors.mediumGray },

  // Same `gap` as a drink row, so the legend's right-aligned columns land
  // exactly over the figures they name. Its own margins replace the label's,
  // which would otherwise push the label off the legend's baseline.
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginBottom: 3,
  },
  sectionGrow: { flex: 1, marginTop: 0, marginBottom: 0 },
  legend: { fontSize: 7, fontWeight: '800', letterSpacing: 0.3, opacity: 0.7 },
  section: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 3,
  },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    // Bleeds into the card's own padding by exactly what it pads back, so the
    // plate reads as a highlighted band while its three figures land in the
    // same columns as every row below it. Inset only on the left and the
    // legend above would point at nothing.
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(248,241,231,0.85)',
  },
  heroName: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    color: colors.darkBrown,
  },
  heroMissing: {
    flex: 1,
    fontSize: 8,
    fontWeight: '700',
    color: colors.accentBlush,
  },
  heroPressed: { backgroundColor: colors.cream },
  // Says the row is a button without adding a second control to the line. It
  // sits where "not on your menu" sits, because the two are the same slot's
  // two answers: you can pour this, or you can't.
  heroLoad: {
    flex: 1,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.accentTeal,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 15,
  },
  rowDim: { opacity: 0.45 },
  rowPressed: { opacity: 0.55 },
  rowName: { flex: 1, fontSize: 9, fontWeight: '700', color: colors.darkBrown },

  // The three figure columns. Fixed widths, right-aligned: the numbers are
  // meant to be compared down the list, and a flexed column puts every row's
  // digits in a different place. Same three inks as the serve receipt, so a
  // number quoted here and a number floating off a served cat read as the
  // same number.
  fCoins: { width: 30, textAlign: 'right', fontSize: 9, fontWeight: '800', color: '#7A5418' },
  fPearls: { width: 26, textAlign: 'right', fontSize: 9, fontWeight: '800', color: '#6B52A8' },
  fXp: { width: 28, textAlign: 'right', fontSize: 9, fontWeight: '800', color: '#8A4A67' },
  fDim: { color: colors.mediumGray },

  dislikeLine: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.mediumGray,
    marginTop: 1,
    marginBottom: 2,
  },

  /**
   * A square turned 45°, half-buried in the card's edge, so the two borders
   * left showing read as a tail pointing at the cat. Same frost as the card:
   * where the halves overlap the alpha stacks slightly denser, which is far
   * less visible than an opaque tail on a translucent card would be.
   */
  tail: {
    position: 'absolute',
    width: 11,
    height: 11,
    marginLeft: -5.5,
    backgroundColor: FROST_BG,
    borderColor: FROST_BORDER,
    transform: [{ rotate: '45deg' }],
  },
  tailDown: { bottom: -6, borderRightWidth: 1.2, borderBottomWidth: 1.2 },
  tailUp: { top: -6, borderLeftWidth: 1.2, borderTopWidth: 1.2 },
});
