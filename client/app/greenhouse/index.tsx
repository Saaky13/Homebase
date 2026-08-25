import React, { useEffect, useMemo } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';

import { colors } from '../../constants/colors';
import GreenhouseCanvasHost from '../../components/GreenhouseCanvasHost';
import { useCafeState } from '../../hooks/useCafeState';
import { getPlant, growthStage } from '../../constants/plants';
import {
  greenhouseMaterialFor,
  isNightAt,
} from '../../constants/greenhousePalette';
import { PixelText } from '../../components/pixel';
import { PIXEL_FONT, PIXEL_FONT_FILE, PX } from '../../constants/pixelTheme';
import { getTodayDateKey } from '../../utils/date';

/**
 * A one-line read on the room, above the glass.
 *
 * Deliberately the only chrome: everything else — picking, planting, watering,
 * harvesting — happens inside the room itself. This just answers the question
 * you walked in with, which is "does anything need me today".
 */
function StatusStrip() {
  const { state } = useCafeState();
  const todayKey = getTodayDateKey();
  const plants = state.greenhouse.plants;
  // Checked per render rather than on a timer: the strip re-renders whenever
  // the state moves, and a stale half-hour at dusk costs nothing up here.
  const material = greenhouseMaterialFor(isNightAt());

  const summary = useMemo(() => {
    const dead = plants.filter((p) => p.dead).length;
    const dry = plants.filter(
      (p) => !p.dead && p.lastWateredDate !== todayKey
    ).length;
    const ready = plants.reduce((sum, p) => sum + p.pendingCoins, 0);
    const mature = plants.filter((p) => {
      const spec = getPlant(p.species);
      return (
        spec && !p.dead && growthStage(p.waterCount, spec.daysToMature) === 'mature'
      );
    }).length;
    return { dead, dry, ready, mature };
  }, [plants, todayKey]);

  if (!plants.length) {
    return (
      <View style={[styles.strip, { backgroundColor: material.face, borderBottomColor: material.faceDk }]}>
        <PixelText size={12} color={material.ink}>
          Nothing planted yet
        </PixelText>
        <PixelText plain size={11} color={material.inkDim} style={styles.stripText}>
          Tap the pot to pick a seed, then drag it onto a bench.
        </PixelText>
      </View>
    );
  }

  return (
    <View style={[styles.strip, { backgroundColor: material.face, borderBottomColor: material.faceDk }]}>
      <PixelText size={12} color={material.ink}>
        {summary.dry > 0
          ? `${summary.dry} ${summary.dry === 1 ? 'plant needs' : 'plants need'} water`
          : 'All watered today'}
      </PixelText>
      <View style={styles.chips}>
        {summary.mature > 0 ? (
          <View style={[styles.chip, styles.chipMint]}>
            <PixelText size={12} color="#2F6B54">
              {summary.mature} mature
            </PixelText>
          </View>
        ) : null}
        {summary.ready > 0 ? (
          <View style={[styles.chip, styles.chipGold]}>
            <PixelText size={12} color="#7A6230">
              {summary.ready} to collect
            </PixelText>
          </View>
        ) : null}
        {summary.dead > 0 ? (
          <View style={[styles.chip, styles.chipDust]}>
            <PixelText size={12} color="#8A7867">
              {summary.dead} husk{summary.dead === 1 ? '' : 's'}
            </PixelText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function GreenhouseTab() {
  const { setGuideContext } = useCafeState();

  // Same pattern as the hub and the habit form: the room's overlays are on the
  // pixel kit now, so the face loads here and the screen holds its first paint
  // until it resolves — a late swap reflows every label.
  const [fontLoaded] = useFonts({ [PIXEL_FONT]: PIXEL_FONT_FILE });

  useEffect(() => {
    setGuideContext('greenhouse');
  }, [setGuideContext]);

  if (!fontLoaded) {
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusStrip />
      <GreenhouseCanvasHost />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  stripText: { flexShrink: 1 },
  chips: { flexDirection: 'row', gap: 5, marginLeft: 'auto' },
  chip: {
    borderRadius: 0,
    paddingHorizontal: PX * 4,
    paddingVertical: PX,
  },
  chipMint: { backgroundColor: '#D9F5EA' },
  chipGold: { backgroundColor: '#FFE7A3' },
  chipDust: { backgroundColor: '#EDE3D7' },
});
