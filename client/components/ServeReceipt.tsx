import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

/**
 * The receipt for one serve, floated off the cat you just served.
 *
 * Three figures and nothing else: the coins in, the pearls out, and the bond
 * XP that cat banked. It exists because the serve was the only moment in the
 * café where three numbers moved at once and none of them were visible —
 * coins and pearls ticked in the TopBar, two screens' worth of layout away
 * from where you were looking, and bond XP moved nowhere at all until you
 * went and opened the cat's card.
 *
 * **A record, not a forecast.** The room used to float a payout plate over
 * every waiting head the moment you loaded a recipe, which turned the queue
 * into a spreadsheet you read instead of a café you looked at. The inspect
 * card prices every drink for the cat you tapped, which is the same answer
 * asked for deliberately; this says what one cup actually paid, once, where
 * it happened, and then leaves.
 *
 * Position is sampled once by the caller at the moment of the serve, for the
 * same reason the plates did: the cat is walking to its chair by the next
 * frame, and a receipt chasing it reads as jitter. Rising off a fixed
 * point is also the clearer motion — it says *this came from here* rather
 * than trailing along behind.
 */

/** How far the receipt climbs, in screen px, over its life. */
const RISE = 30;
/** Total time on screen. Long enough to read three short figures, no longer. */
const LIFE_MS = 1100;
/** Fixed so two receipts in quick succession line up rather than stagger. */
export const RECEIPT_W = 82;

export interface ServeReceiptProps {
  /** Screen px, the plate's horizontal centre. Sampled once at serve time. */
  screenX: number;
  /** Screen px, the plate's starting top edge. It rises from here. */
  screenY: number;
  coins: number;
  /** Pearls spent on the cup. Shown as a debit — the one figure that isn't a gain. */
  pearls: number;
  /** Bond XP this cat banked. Zero on a drink it won't drink. */
  xp: number;
  /** Called once the float has finished, so the caller can drop it. */
  onDone: () => void;
}

export function ServeReceipt({
  screenX,
  screenY,
  coins,
  pearls,
  xp,
  onDone,
}: ServeReceiptProps) {
  const t = useRef(new Animated.Value(0)).current;
  // The callback is read through a ref so a caller that re-creates it every
  // render can't restart the animation mid-float.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: LIFE_MS,
      // Fast at the start, drifting at the end: the figures are legible for
      // most of the float rather than for the moment they are still moving.
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) done.current();
    });
  }, [t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.plate,
        {
          left: screenX - RECEIPT_W / 2,
          top: screenY,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -RISE] }) },
          ],
          // Holds full opacity through the first half, so the rise reads as a
          // rise rather than as an immediate fade that happens to move.
          opacity: t.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0] }),
        },
      ]}
    >
      <Text style={styles.coins}>+{coins}</Text>
      <Text style={styles.pearls}>−{pearls}◆</Text>
      {/* A dislike banks nothing, and saying so is the point — it is the only
          place the game admits that cup was wasted on this cat. */}
      <Text style={[styles.xp, xp === 0 && styles.xpNone]}>
        {xp > 0 ? `+${xp}` : '0'} xp
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plate: {
    position: 'absolute',
    width: RECEIPT_W,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 2,
    backgroundColor: '#FFF7EC',
    borderWidth: 2,
    borderColor: '#B08A63',
    // Square, like every other plate in this room.
    borderRadius: 0,
  },
  /** Gold — the colour the coin pill pays in. */
  coins: { fontSize: 11, fontWeight: '800', lineHeight: 13, color: '#7A5418' },
  /** Lavender, and the only figure carrying a minus sign. */
  pearls: { fontSize: 10, fontWeight: '800', lineHeight: 13, color: '#6B52A8' },
  xp: { fontSize: 9, fontWeight: '800', lineHeight: 13, color: '#8A4A67' },
  xpNone: { color: '#A08C82' },
});
