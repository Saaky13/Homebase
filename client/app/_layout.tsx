import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../web/globals.css';

import { useColorScheme } from '../hooks/use-color-scheme';
import { CafeProvider } from '../hooks/useCafeState'; // 👈 ADD THIS

export const unstable_settings = {
  initialRouteName: '(tabs)',
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <CafeProvider> {/* 👈 WRAP EVERYTHING */}
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="habit-form" options={{ presentation: 'card' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </CafeProvider>
  );
}