import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import TownMap from '../components/TownMap';
import { useCafeState } from '../hooks/useCafeState';

/**
 * The town is the app's home screen. Buildings navigate to the screens that
 * used to be tabs, so this route is the hub the tab bar used to be.
 */
export default function TownScreen() {
  const { setGuideContext } = useCafeState();

  useEffect(() => {
    setGuideContext('town:map');
  }, [setGuideContext]);

  return (
    // No safe-area edges here: TopBar already covers the notch, and TownMap
    // pads its own scroll content past the home indicator.
    <View style={styles.container}>
      <TownMap />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#A8C98C' },
});
