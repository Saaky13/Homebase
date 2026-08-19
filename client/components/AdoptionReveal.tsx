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
import { CupSprite } from './CupSprite';
import { catsFavoring, preferencesFor } from '../constants/affinity';
import { DRINKS } from '../constants/drinks';
import type { Prize } from '../constants/gacha';
import { CoinIcon } from './Icons';
import { RARITY_STYLE, type Rarity } from '../constants/catSprites';
import { colors } from '../constants/colors';

/**
 * How much a drink twinkles. Cats carry their own `sparkles` count as part of
 * the sprite; a recipe has no sprite to hang one off, so the rarity decides —
 * and only the top two get any, which is what keeps them meaning something.
 */
const DRINK_SPARKLES: Record<Rarity, number> = {
  common: 0,
  rare: 0,
  epic: 0,
  legendary: 5,
  ultra: 9,
};

/** Longer, more syncopated buzz the rarer the prize. */
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
  prize,
  ownedCats,
  recipes,
  coins,
  cost,
  remaining,
  onClose,
  onAgain,
}: {
  /** What the crank just produced, or null when nothing is being revealed. */
  prize: Prize | null;
  /** So a drink's admirers can show which of them you actually have. */
  ownedCats: string[];
  /** So a cat's favourite can say whether you can actually pour it. */
  recipes: string[];
  coins: number;
  /** Price of the *next* pull of this kind, which climbs as you collect. */
  cost: number;
  /** How many of this kind are still unpulled, so the footer can adapt. */
  remaining: number;
  onClose: () => void;
  onAgain: () => void;
}) {
  // Kept separate from `prize` so the exit animation has something to play
  // against. GuideOverlay returns null the moment its flag flips, which is why
  // its own exit animation never actually runs.
  const [shown, setShown] = useState<Prize | null>(null);

  const scrim = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  const rarity = prize
    ? prize.kind === 'cat'
      ? prize.cat.rarity
      : prize.drink.rarity
    : null;

  useEffect(() => {
    if (prize) {
      setShown(prize);
      Vibration.vibrate(HAPTICS[rarity ?? 'common'] ?? HAPTICS.common);
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
  }, [prize, rarity, shown, scrim, pop]);

  if (!shown) return null;

  const isCat = shown.kind === 'cat';
  const shownRarity = isCat ? shown.cat.rarity : shown.drink.rarity;
  const style = RARITY_STYLE[shownRarity];
  const sparkles = isCat ? shown.cat.sparkles : DRINK_SPARKLES[shownRarity];
  const canPullAgain = coins >= cost && remaining > 0;

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
          {!!sparkles && <Sparkles count={sparkles} color={style.ring} />}
          {shown.kind === 'cat' ? (
            <CatSprite catId={shown.cat.id} size={128} />
          ) : (
            <CupSprite drink={shown.drink.id} width={86} />
          )}
        </View>

        {shown.kind === 'cat' ? (
          <>
            <Text style={styles.name}>{shown.cat.name}</Text>
            <Text style={styles.blurb}>
              {shown.cat.name} is settling into town. Say hello on the map.
            </Text>

            {/* The first thing worth knowing about a cat you just pulled. A
                legendary whose drink you don't own yet is the next thing you
                want, which is the whole point of showing it here. */}
            <View style={[styles.lovesRow, { borderColor: style.ring }]}>
              <CupSprite drink={preferencesFor(shown.cat).favorite} width={22} />
              <View>
                <Text style={styles.lovesLabel}>LOVES</Text>
                <Text style={styles.lovesName}>
                  {DRINKS[preferencesFor(shown.cat).favorite].name}
                </Text>
                {/* The pull that sells the next pull. A cat arriving with a
                    drink you can't pour is the clearest reason the machine
                    has a second hopper. */}
                {!recipes.includes(preferencesFor(shown.cat).favorite) && (
                  <Text style={styles.lovesMissing}>not on your menu yet</Text>
                )}
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.name}>{shown.drink.name}</Text>
            <Text style={styles.blurb}>{shown.drink.note}</Text>

            {/* The mirror of the cat card's LOVES row: which of your cats have
                been waiting for this. An empty row is information too — you
                pulled a recipe nobody you own wants yet. */}
            <View style={[styles.lovesRow, { borderColor: style.ring }]}>
              <View>
                <Text style={styles.lovesLabel}>ON THE MENU</Text>
                <Text style={styles.lovesName}>
                  {shown.drink.pearls} pearls · {shown.drink.baseCoins} coins
                </Text>
              </View>
            </View>

            <View style={styles.fanRow}>
              {catsFavoring(shown.drink.id).map((fan) => (
                <CatSprite
                  key={fan.id}
                  catId={fan.id}
                  size={30}
                  locked={!ownedCats.includes(fan.id)}
                />
              ))}
            </View>
          </>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={onAgain}
            disabled={!canPullAgain}
            // Deliberately not the rarity ring: Common's ring is a neutral grey,
            // which made a live button look disabled.
            style={({ pressed }) => [
              styles.primary,
              !canPullAgain && styles.disabled,
              pressed && canPullAgain && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>
              {isCat ? 'Adopt again' : 'Brew again'}
            </Text>
            {canPullAgain && (
              <View style={styles.costRow}>
                <CoinIcon size={12} />
                <Text style={styles.costText}>{cost}</Text>
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
  lovesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    alignSelf: 'center',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1.5,
    backgroundColor: colors.paper,
    marginTop: 12,
  },
  lovesLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.mediumGray,
  },
  lovesName: { fontSize: 13, fontWeight: '800', color: colors.brown900 },
  lovesMissing: { fontSize: 10, fontWeight: '700', color: colors.coral },
  fanRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
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
