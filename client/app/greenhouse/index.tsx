import React, { useEffect, useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/colors';
import GreenhouseCanvasHost from '../../components/GreenhouseCanvasHost';
import { useCafeState } from '../../hooks/useCafeState';
import { getPlant, growthStage } from '../../constants/plants';
import { getTodayDateKey } from '../../utils/date';

/**
 * A one-line read on the room, above the glass.
 *
 * Deliberately the only chrome: everything else — buying, planting, watering,
 * harvesting — happens inside the room itself. This just answers the question
 * you walked in with, which is "does anything need me today".
 */
function StatusStrip() {
  const { state } = useCafeState();
  const todayKey = getTodayDateKey();
  const plants = state.greenhouse.plants;

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
      <View style={styles.strip}>
        <Text style={styles.stripLead}>Nothing planted yet</Text>
        <Text style={styles.stripText}>
          Tap the seed rack, then drag the pot onto a bench.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.strip}>
      <Text style={styles.stripLead}>
        {summary.dry > 0
          ? `${summary.dry} ${summary.dry === 1 ? 'plant needs' : 'plants need'} water`
          : 'All watered today'}
      </Text>
      <View style={styles.chips}>
        {summary.mature > 0 ? (
          <View style={[styles.chip, styles.chipMint]}>
            <Text style={[styles.chipText, styles.chipMintText]}>
              {summary.mature} mature
            </Text>
          </View>
        ) : null}
        {summary.ready > 0 ? (
          <View style={[styles.chip, styles.chipGold]}>
            <Text style={[styles.chipText, styles.chipGoldText]}>
              {summary.ready} to collect
            </Text>
          </View>
        ) : null}
        {summary.dead > 0 ? (
          <View style={[styles.chip, styles.chipDust]}>
            <Text style={[styles.chipText, styles.chipDustText]}>
              {summary.dead} husk{summary.dead === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function GreenhouseTab() {
  const { setGuideContext } = useCafeState();

  useEffect(() => {
    setGuideContext('greenhouse');
  }, [setGuideContext]);

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
    backgroundColor: '#FFF9F0',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(94,58,70,0.12)',
  },
  stripLead: { fontSize: 12, fontWeight: '800', color: '#4A3427' },
  stripText: { fontSize: 11, color: '#8F7C72', flexShrink: 1 },
  chips: { flexDirection: 'row', gap: 5, marginLeft: 'auto' },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 10, fontWeight: '800' },
  chipMint: { backgroundColor: '#D9F5EA' },
  chipMintText: { color: '#2F6B54' },
  chipGold: { backgroundColor: '#FFE7A3' },
  chipGoldText: { color: '#7A6230' },
  chipDust: { backgroundColor: '#EDE3D7' },
  chipDustText: { color: '#8A7867' },
});
