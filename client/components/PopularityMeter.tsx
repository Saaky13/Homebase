import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCafeState } from '../hooks/useCafeState';
import { colors } from '../constants/colors';
import {
  MAX_POPULARITY,
  displayPopularity,
  MAX_CAFE_MULTIPLIER,
} from '../constants/popularity';

/**
 * The café's live standing, shown next to the queue it drives.
 *
 * Two things this is careful about:
 *
 * 1. 100 is not the expected state. A solid-but-imperfect routine settles
 *    around 60–70, and that is healthy — so the meter reads as a level rather
 *    than as progress toward a goal it is failing to reach.
 * 2. Decay is surfaced, not hidden. When the user has been away, the loss is
 *    stated outright rather than quietly presenting a lower number.
 */
export default function PopularityMeter() {
  const { state, popularityLostWhileAway, cafeMultiplier } = useCafeState();

  const shown = displayPopularity(state.popularity);
  const fillPercent = (shown / MAX_POPULARITY) * 100;
  const lost = popularityLostWhileAway
    ? displayPopularity(popularityLostWhileAway)
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Popularity</Text>

        <View style={styles.valueRow}>
          {lost !== null && (
            <Text style={styles.lost} accessibilityLabel={`Down ${lost} while away`}>
              ▼ {lost} while away
            </Text>
          )}
          <Text style={styles.value}>{shown}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPercent}%` }]} />
      </View>

      <Text style={styles.caption}>
        {describeStanding(shown)}
        {cafeMultiplier > 1 &&
          `  ·  café ×${cafeMultiplier.toFixed(2).replace(/0$/, '')}`}
      </Text>
    </View>
  );
}

/**
 * Wording matters here: the low end describes a quiet café rather than telling
 * the user they have failed, and the top is framed as rare rather than as the
 * default target.
 */
function describeStanding(value: number): string {
  if (value >= 95) return 'Packed — the whole town knows this place';
  if (value >= 70) return 'Bustling';
  if (value >= 40) return 'Steady regulars';
  if (value >= 15) return 'Quiet, but the door keeps opening';
  return 'Slow day — a few cats still wander in';
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.paper,
    borderBottomWidth: 2,
    borderBottomColor: colors.brown300,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    color: colors.brown900,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lost: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  value: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.brown900,
  },
  track: {
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.lightGray,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  fill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.accentBlush,
  },
  caption: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600',
    color: colors.mediumGray,
  },
});
