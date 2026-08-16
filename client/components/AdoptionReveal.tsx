import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';

import { CatSprite } from './CatSprite';
import { CoinIcon } from './Icons';
import { RARITY_STYLE, type CatSpec } from '../constants/catSprites';
import { PULL_COST_COINS } from '../constants/gacha';
import { colors } from '../constants/colors';

/** Longer, more syncopated buzz the rarer the cat. */
const HAPTICS: Record<string, number[]> = {
  common: [0, 40],
  rare: [0, 50, 90, 50],
  epic: [0, 60, 80, 60, 80, 60],
  legendary: [0, 70, 70, 70, 70, 120],
  ultra: [0, 80, 60, 80, 60, 80, 60, 180],
};

function Sparkles({ count, color }: { count: number; color: string }) {
  const twinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [twinkle]);

  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return {
          x: Math.cos(angle) * 92,
          y: Math.sin(angle) * 78,
          // Staggered so they don't all pulse in lockstep.
          phase: i / count,
        };
      }),
    [count]
  );

  return (
    <>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.sparkle,
            {
              backgroundColor: color,
              transform: [
                { translateX: d.x },
                { translateY: d.y },
                {
                  scale: twinkle.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5 + d.phase * 0.4, 1.1 - d.phase * 0.3],
                  }),
                },
              ],
              opacity: twinkle.interpolate({
                inputRange: [0, 1],
                outputRange: [0.25 + d.phase * 0.5, 1],
              }),
            },
          ]}
        />
      ))}
    </>
  );
}

export default function AdoptionReveal({
  cat,
  coins,
  remaining,
  onClose,
  onAdoptAgain,
}: {
  /** The cat just adopted, or null when nothing is being revealed. */
  cat: CatSpec | null;
  coins: number;
  /** How many cats are still unadopted, so the footer can adapt. */
  remaining: number;
  onClose: () => void;
  onAdoptAgain: () => void;
}) {
  // Kept separate from `cat` so the exit animation has something to play
  // against. GuideOverlay returns null the moment its flag flips, which is why
  // its own exit animation never actually runs.
  const [shown, setShown] = useState<CatSpec | null>(null);

  const scrim = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cat) {
      setShown(cat);
      Vibration.vibrate(HAPTICS[cat.rarity] ?? HAPTICS.common);
      scrim.setValue(0);
      pop.setValue(0);
      Animated.parallel([
        Animated.timing(scrim, { toValue: 1, duration: 190, useNativeDriver: true }),
        Animated.spring(pop, {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 9,
        }),
      ]).start();
      return;
    }

    if (!shown) return;

    // Unmounting is driven by the animation finishing, and Animated runs on
    // requestAnimationFrame — which the browser suspends for a backgrounded
    // tab. Without a fallback, backgrounding the app with a reveal open would
    // leave it stuck on screen permanently. Whichever fires first wins.
    let cleared = false;
    const clear = () => {
      if (cleared) return;
      cleared = true;
      setShown(null);
    };
    const fallback = setTimeout(clear, 400);

    Animated.parallel([
      Animated.timing(scrim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) clear();
    });

    return () => clearTimeout(fallback);
  }, [cat, shown, scrim, pop]);

  if (!shown) return null;

  const style = RARITY_STYLE[shown.rarity];
  const canAdoptAgain = coins >= PULL_COST_COINS && remaining > 0;

  return (
    <Animated.View style={[styles.scrim, { opacity: scrim }]} pointerEvents="auto">
      {/* Tapping the backdrop dismisses, the way the rest of the app lets you
          out of things without hunting for a button. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <Animated.View
        style={[
          styles.card,
          {
            borderColor: style.ring,
            backgroundColor: style.tint,
            transform: [
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
            ],
            opacity: pop,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: style.ring }]}>
          {style.label.toUpperCase()}
        </Text>

        <View style={styles.stage}>
          {!!shown.sparkles && (
            <Sparkles count={shown.sparkles} color={style.ring} />
          )}
          <CatSprite catId={shown.id} size={128} />
        </View>

        <Text style={styles.name}>{shown.name}</Text>
        <Text style={styles.blurb}>
          {shown.name} is settling into town. Say hello on the map.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onAdoptAgain}
            disabled={!canAdoptAgain}
            // Deliberately not the rarity ring: Common's ring is a neutral grey,
            // which made a live button look disabled.
            style={({ pressed }) => [
              styles.primary,
              !canAdoptAgain && styles.disabled,
              pressed && canAdoptAgain && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>Adopt again</Text>
            {canAdoptAgain && (
              <View style={styles.costRow}>
                <CoinIcon size={12} />
                <Text style={styles.costText}>{PULL_COST_COINS}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Done</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(46,28,40,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    // Above GuideOverlay's 200 so a guide beat can never sit on top of this.
    zIndex: 300,
  },
  card: {
    width: '84%',
    maxWidth: 340,
    borderRadius: 28,
    borderWidth: 2,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#2E1C28',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  stage: {
    height: 168,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  name: { fontSize: 26, fontWeight: '900', color: colors.brown900 },
  blurb: {
    fontSize: 13,
    color: colors.brown700,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  primary: {
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: colors.accentBlush,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  primaryText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  costText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
  secondary: {
    flexGrow: 1,
    flexBasis: 0,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  secondaryText: { fontSize: 14, fontWeight: '800', color: colors.brown700 },
  pressed: { opacity: 0.82 },
});
