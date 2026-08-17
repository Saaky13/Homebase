import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCafeState } from '../hooks/useCafeState';
import { colors } from '../constants/colors';
import {
  MAX_POPULARITY,
  displayPopularity,
} from '../constants/popularity';
import { PopularityIcon } from './Icons';

/**
 * The café's live standing, shown as one line above the room.
 *
 * It used to be a three-row block — label, track, caption — costing about 86px
 * before the café even started. The standing *is* the label now, so the same
 * information fits on a single row and the room gets the height back.
 *
 * Two things this is still careful about:
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
      <PopularityIcon size={12} />
      <Text style={styles.standing} numberOfLines={1}>
        {describeStanding(shown)}
      </Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPercent}%` }]} />
      </View>

      {lost !== null && (
        <Text style={styles.lost} accessibilityLabel={`Down ${lost} while away`}>
          ▼{lost}
        </Text>
      )}

      {cafeMultiplier > 1 && (
        <Text style={styles.multiplier}>
          ×{cafeMultiplier.toFixed(2).replace(/0$/, '')}
        </Text>
      )}

      <Text style={styles.value}>{shown}</Text>
    </View>
  );
}

/**
 * Wording matters here: the low end describes a quiet café rather than telling
 * the user they have failed, and the top is framed as rare rather than as the
 * default target.
 */
function describeStanding(value: number): string {
  if (value >= 95) return 'Packed out';
  if (value >= 70) return 'Bustling';
  if (value >= 40) return 'Steady regulars';
  if (value >= 15) return 'Quiet, door still opening';
  return 'Slow day';
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.paper,
    borderBottomWidth: 2,
    borderBottomColor: colors.brown300,
  },
  standing: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brown900,
  },
  track: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.lightGray,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.accentBlush,
  },
  lost: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger,
  },
  multiplier: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accentTeal,
  },
  value: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.brown900,
    minWidth: 20,
    textAlign: 'right',
  },
});
