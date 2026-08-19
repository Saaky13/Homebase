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
import { preferencesFor } from '../constants/affinity';
import { DRINKS, type DrinkId } from '../constants/drinks';
import { RARITY_STYLE, type CatSpec } from '../constants/catSprites';
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
 * The bond row the spec calls for is absent because bond doesn't exist yet
 * (Phase 4).
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
export const CARD_H_ESTIMATE = 220;
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

/** The favourite, given its own row — it is the answer the tap asked for. */
function HeroRow({ drink, onMenu }: { drink: DrinkId; onMenu: boolean }) {
  const spec = DRINKS[drink];
  return (
    <View style={styles.hero}>
      <CupSprite drink={drink} width={20} />
      <Text style={styles.heroName} numberOfLines={1}>
        {spec.name}
      </Text>
      {/* Being told, on a cat standing in front of you, that its favourite is
          something you can't pour is the strongest pull toward the machine
          in the app. It also teaches what the dimmed rows below mean. */}
      {!onMenu && <Text style={styles.heroMissing}>not on your menu</Text>}
      <Text style={styles.heroCost}>{spec.pearls}◆</Text>
    </View>
  );
}

/** One drink in a column: tiny cup, short name, pearl cost. */
function DrinkRow({
  drink,
  dim,
  locked,
}: {
  drink: DrinkId;
  /** A disliked drink, drawn back so the likes read first. */
  dim?: boolean;
  /** Not on the player's menu. */
  locked?: boolean;
}) {
  const spec = DRINKS[drink];
  return (
    <View style={[styles.row, (dim || locked) && styles.rowDim]}>
      <CupSprite drink={drink} width={13} />
      <Text style={[styles.rowName, dim && styles.rowNameDim]} numberOfLines={1}>
        {spec.short}
      </Text>
      {/* Dislikes never get poured, so their price is noise — omitted. */}
      {!dim && <Text style={styles.rowCost}>{locked ? '–' : `${spec.pearls}◆`}</Text>}
    </View>
  );
}

function Section({ label, tint }: { label: string; tint: string }) {
  return <Text style={[styles.section, { color: tint }]}>{label}</Text>;
}

export default function CatInspectCard({
  cat,
  recipes,
  pos,
  pointerX,
  flip,
  onHeight,
  onOpenAlmanac,
}: {
  cat: CatSpec;
  /** The player's menu, so a row can say whether it can be brewed. */
  recipes: DrinkId[];
  pos: Animated.ValueXY;
  pointerX: Animated.Value;
  /** 0 when the card is above the cat, 1 when below. Picks which tail shows. */
  flip: Animated.Value;
  /** Reports measured height back so the parent can anchor off the real box. */
  onHeight: (h: number) => void;
  /** Jump to this cat's full entry in the almanac. */
  onOpenAlmanac: () => void;
}) {
  const rarity = RARITY_STYLE[cat.rarity];
  const prefs = preferencesFor(cat);
  const owns = (id: DrinkId) => recipes.includes(id);

  const dislikes = prefs.dislikes.slice(0, MAX_DISLIKES);
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

      <Section label="LOVES" tint={colors.accentBlush} />
      <HeroRow drink={prefs.favorite} onMenu={owns(prefs.favorite)} />

      {/* Likes and dislikes side by side — the wide card's whole trick. Six
          likes stacked next to four dislikes is half the height of the same
          ten drinks in one column, and the hairline keeps the two lists from
          reading as one. */}
      <View style={styles.columns}>
        <View style={styles.col}>
          <Section label="LIKES" tint={colors.accentTeal} />
          {prefs.likes.map((id) => (
            <DrinkRow key={id} drink={id} locked={!owns(id)} />
          ))}
        </View>
        <View style={styles.colRule} />
        <View style={styles.col}>
          <Section label="WON'T DRINK" tint={colors.mediumGray} />
          {dislikes.map((id) => (
            <DrinkRow key={id} drink={id} dim />
          ))}
        </View>
      </View>

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
  heroCost: {
    marginLeft: 'auto',
    fontSize: 10,
    fontWeight: '800',
    color: colors.lavender,
  },

  columns: { flexDirection: 'row' },
  col: { flex: 1 },
  colRule: {
    width: 1,
    backgroundColor: 'rgba(233,209,183,0.7)',
    marginHorizontal: 8,
    marginTop: 6,
  },

  // `short` names are authored to fit a cell this wide next to a small cup;
  // the full names are not.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 15,
  },
  rowDim: { opacity: 0.45 },
  rowName: { flex: 1, fontSize: 9, fontWeight: '700', color: colors.darkBrown },
  rowNameDim: { color: colors.mediumGray },
  rowCost: { fontSize: 8, fontWeight: '700', color: colors.mediumGray },

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
