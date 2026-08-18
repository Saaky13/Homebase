import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { colors } from '../constants/colors';

/**
 * Web entrypoint for the greenhouse — the same seam the café uses.
 *
 * On web, Skia is CanvasKit: a WebAssembly module whose `Skia` object is
 * undefined until it loads. Importing GreenhouseCanvas statically here is
 * enough to blow up on the first `Skia.*` call, so WithSkiaWeb defers it.
 *
 * The native build resolves GreenhouseCanvasHost.native.tsx instead, where
 * Skia is linked into the binary and none of this is needed.
 */
export default function GreenhouseCanvasHost() {
  return (
    <WithSkiaWeb
      getComponent={() => import('./GreenhouseCanvas')}
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brown500} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
