import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { colors } from '../../../constants/colors';
import CafeCanvas from '../../../components/CafeCanvas';

export default function CafeTab() {
  return (
    <SafeAreaView style={styles.container}>
      <CafeCanvas />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
});
