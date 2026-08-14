import React, { useMemo } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useRouter } from 'expo-router';

import TownSurface from './TownSurface';
import {
  BUILDINGS, buildTownGrid, FOUNTAIN, MAP_PX_H, MAP_PX_W, TILE,
} from '../town/map';
import {
  DAY_PALETTE, DAY_ROOFS, isNightAt, nightPalette, nightRoofs,
} from '../town/palette';

/** Tap target around the fountain — the Growth Hub entrance. */
const FOUNTAIN_HIT = {
  x: FOUNTAIN.tx * TILE - 34,
  y: FOUNTAIN.ty * TILE - 34,
  w: 68,
  h: 62,
};

export default function TownMap({ night }: { night?: boolean }) {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isNight = night ?? isNightAt();
  // The grid comes from stable noise, so it only needs building once.
  const grid = useMemo(() => buildTownGrid(), []);

  // The map is 384px wide; narrower phones scale it down rather than clip.
  const scale = Math.min(1, width / MAP_PX_W);

  // Recomputing these on every render would defeat the surface's memoised
  // picture on native, since they are dependencies of it.
  const palette = useMemo(() => (isNight ? nightPalette() : DAY_PALETTE), [isNight]);
  const roofs = useMemo(() => (isNight ? nightRoofs() : DAY_ROOFS), [isNight]);

  const labelBox = isNight ? styles.labelNight : styles.labelDay;
  const labelText = isNight ? styles.labelTextNight : styles.labelTextDay;

  const renderLabel = (key: string, cx: number, top: number, text: string, big?: boolean) => (
    <View
      key={key}
      pointerEvents="none"
      style={[styles.labelWrap, { left: cx - 40, top }]}
    >
      <View style={[labelBox, big && styles.hubLabel]}>
        <Text style={[labelText, big && styles.hubLabelText]}>{text}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { backgroundColor: isNight ? '#4A5570' : '#A8C98C' },
      ]}
    >
      <View style={{ width: MAP_PX_W * scale, height: MAP_PX_H * scale }}>
        {/* Web paints into a <canvas>; iOS and Android paint the identical
            artwork through Skia. Metro picks the platform variant. */}
        <TownSurface
          grid={grid}
          palette={palette}
          roofs={roofs}
          isNight={isNight}
          scale={scale}
        />

        {/* Transparent hit targets rather than canvas hit-testing: the specs
            already carry footprints, so press states and accessibility
            labels come for free. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Growth Hub"
          onPress={() => router.push('/habits')}
          style={({ pressed }) => [
            styles.hit,
            {
              left: FOUNTAIN_HIT.x * scale,
              top: FOUNTAIN_HIT.y * scale,
              width: FOUNTAIN_HIT.w * scale,
              height: FOUNTAIN_HIT.h * scale,
            },
            pressed && styles.hitPressed,
          ]}
        />

        {BUILDINGS.filter((b) => b.route).map((b) => (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={b.label ?? b.id}
            onPress={() => router.push(b.route as any)}
            style={({ pressed }) => [
              styles.hit,
              {
                left: b.tx * TILE * scale,
                top: b.ty * TILE * scale,
                width: b.tw * TILE * scale,
                height: b.th * TILE * scale,
              },
              pressed && styles.hitPressed,
            ]}
          />
        ))}

        {BUILDINGS.filter((b) => b.label).map((b) =>
          renderLabel(
            b.id,
            (b.tx * TILE + (b.tw * TILE) / 2) * scale,
            (b.ty * TILE + b.th * TILE + 1) * scale,
            b.label as string
          )
        )}

        {renderLabel(
          'growth-hub',
          FOUNTAIN.tx * TILE * scale,
          (FOUNTAIN.ty * TILE + 30) * scale,
          'Growth Hub',
          true
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  hit: { position: 'absolute' },
  hitPressed: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 4 },
  labelWrap: { position: 'absolute', width: 80, alignItems: 'center' },
  labelDay: {
    backgroundColor: 'rgba(255,247,242,0.62)',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  labelNight: {
    backgroundColor: 'rgba(40,44,74,0.62)',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  labelTextDay: { fontSize: 8, color: 'rgba(94,58,70,0.9)' },
  labelTextNight: { fontSize: 8, color: 'rgba(226,220,238,0.92)' },
  hubLabel: { paddingHorizontal: 7, paddingVertical: 2 },
  hubLabelText: { fontSize: 9 },
});
