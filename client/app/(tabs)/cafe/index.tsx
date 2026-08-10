import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../constants/colors';
import CafeCanvasHost from '../../../components/CafeCanvasHost';
import PopularityMeter from '../../../components/PopularityMeter';

export default function CafeTab() {
  return (
    <SafeAreaView style={styles.container}>
      <PopularityMeter />
      <CafeCanvasHost />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
});
