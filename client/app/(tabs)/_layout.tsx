import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CurrencyBar from '../../components/CurrencyBar';
import GuideOverlay from '../../components/GuideOverlay';

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <CurrencyBar />
      <GuideOverlay />

      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: '#FEF7F0',
          },
          tabBarStyle: {
            backgroundColor: '#FEF7F0',
            borderTopColor: 'rgba(107, 83, 68, 0.1)',
            borderTopWidth: 0.5,
            paddingBottom: 8,
            paddingTop: 8,
            height: 74,
          },
        }}
      >
        <Tabs.Screen
          name="habits/index"
          options={{
            title: 'Growth Hub',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar-check" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="cafe/index"
          options={{
            title: 'Café',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="coffee" size={size} color={color} />
            ),
          }}
          
        />

        <Tabs.Screen
          name="shop/index"
          options={{
            title: 'Shop',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="store" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF7F0',
  },
});