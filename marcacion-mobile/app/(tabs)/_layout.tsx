import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { HapticTab } from '@/src/components/haptic-tab';

// ✅ Colores corporativos "La Media Naranja"
const CorporateColors = {
  primary: '#e9501e',
  primaryDark: '#cc3625',
  secondary: '#fab626',
  white: '#ffffff',
  background: '#fff8f5',
  tabInactive: '#999999',
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  // Calcular altura dinámica basada en el safe area
  const bottomPadding = Math.max(insets.bottom, 10);
  const tabBarHeight = 55 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        // ✅ Color del ícono/texto activo (naranja corporativo)
        tabBarActiveTintColor: CorporateColors.primary,
        // ✅ Color del ícono/texto inactivo
        tabBarInactiveTintColor: CorporateColors.tabInactive,
        headerShown: false,
        tabBarButton: HapticTab,
        // ✅ Estilo de la barra de tabs
        tabBarStyle: {
          backgroundColor: CorporateColors.white,
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          // Sombra según plataforma
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
            },
            android: {
              elevation: 10,
            },
          }),
        },
        // ✅ Estilo del label
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          paddingBottom: 2,
        },
        // ✅ Estilo del ícono
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tablero"
        options={{
          title: 'Tablero',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="horarios"
        options={{
          title: 'Horarios',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}