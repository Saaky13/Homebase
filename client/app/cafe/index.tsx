import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import CafeCanvasHost from '../../components/CafeCanvasHost';
import PopularityMeter from '../../components/PopularityMeter';

export default function CafeTab() {
  const insets = useSafeAreaInsets();

  return (
    // The café floor is a fixed-size canvas, so the home-indicator gap has to
    // be reserved on the container — there is no scroll content to pad.
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <PopularityMeter />
      <CafeCanvasHost />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
});
