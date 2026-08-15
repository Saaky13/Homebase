import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { colors } from '../constants/colors';

/**
 * Web entrypoint for the café.
 *
 * On web, Skia is CanvasKit — a WebAssembly module. The `Skia` object is
 * undefined until that finishes loading, so CafeCanvas must not be imported
 * statically here: merely evaluating it early is enough to blow up on the
 * first `Skia.*` call. WithSkiaWeb defers the import until CanvasKit is ready.
 *
 * The native build resolves CafeCanvasHost.native.tsx instead and skips all
 * of this, since Skia is linked into the binary there.
 *
 * The load is scoped to this screen so the rest of the app never waits on a
 * WASM payload it doesn't use.
 */
export default function CafeCanvasHost() {
  return (
    <WithSkiaWeb
      getComponent={() => import('./CafeCanvas')}
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brown500} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
