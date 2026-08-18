import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { useCafeState } from '../hooks/useCafeState';
import { getTodayDateKey } from '../utils/date';
import { colors } from '../constants/colors';
import {
  MAX_POPULARITY,
  clampPopularity,
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
  const { state, updateState, popularityLostWhileAway, cafeMultiplier } = useCafeState();

  // Dev-only: drag anywhere on the track to set the standing outright.
  //
  // Popularity is the one number you cannot reach by playing for a minute — it
  // only climbs through real days of habits and focus, and it decays back down
  // between them. Spawn pacing and group size are both driven off it, so
  // testing a busy café any other way means waiting a week.
  //
  // `popularityLastDecayedDate` moves to today alongside the value: without it,
  // the next settle would apply however many days of decay the save had
  // outstanding and eat the number you just dialled in.
  const trackWidth = useRef(0);

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  }, []);

  const setFromTouch = useCallback(
    (locationX: number) => {
      const width = trackWidth.current;
      if (!width) return;
      const ratio = Math.max(0, Math.min(1, locationX / width));
      updateState({
        popularity: clampPopularity(ratio * MAX_POPULARITY),
        popularityLastDecayedDate: getTodayDateKey(),
      });
    },
    [updateState]
  );

  const setFromTouchRef = useRef(setFromTouch);
  setFromTouchRef.current = setFromTouch;

  // Built once: rebuilding per render would hand an in-flight drag a stale
  // setter, the same reason the café's serve gesture keeps its responder in a ref.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromTouchRef.current(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromTouchRef.current(e.nativeEvent.locationX),
    })
  ).current;

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

      <View
        style={styles.track}
        // The track is 7px tall; without this the dev scrub is a hairline target.
        hitSlop={{ top: 10, bottom: 10 }}
        onLayout={handleTrackLayout}
        {...panResponder.panHandlers}
      >
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
