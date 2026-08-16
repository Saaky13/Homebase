import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import '../web/globals.css';

import { useColorScheme } from '../hooks/use-color-scheme';
import { CafeProvider } from '../hooks/useCafeState';
import GuideOverlay from '../components/GuideOverlay';
import TopBar from '../components/TopBar';

export const unstable_settings = {
  initialRouteName: 'index',
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // Every screen measures the notch and home indicator through this, so it
    // has to sit above the bar and the guide, not just around the Stack.
    <SafeAreaProvider>
      <CafeProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* The bar and the guide sit outside the Stack so they survive
              navigation — the town, café, market and hub all share them. */}
          <View style={styles.root}>
            <TopBar />
            <GuideOverlay />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="cafe/index" />
              <Stack.Screen name="shop/index" />
              <Stack.Screen name="habits/index" />
              <Stack.Screen name="cats/index" />
              <Stack.Screen name="habit-form" options={{ presentation: 'card' }} />
            </Stack>
          </View>
          {/* Dark glyphs, always: the palette is a fixed warm light one, so
              honouring the system's dark mode would hide the clock. */}
          <StatusBar style="dark" />
        </ThemeProvider>
      </CafeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF7F2' },
});
