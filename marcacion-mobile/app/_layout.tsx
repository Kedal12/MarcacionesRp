import { DarkTheme, DefaultTheme, ThemeProvider as NavTheme } from '@react-navigation/native';
import { ThemeProvider, createTheme } from '@rneui/themed';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import LoadingIndicator from '@/src/components/LoadingIndicator';

// Tema personalizado para @rneui
const theme = createTheme({
  lightColors: {
    primary: '#007AFF',
    // @ts-ignore - RNE tiene tipos incompletos para colores custom
    success: '#28a745',
    warning: '#ffc107',
    background: '#f4f6f8',
  },
  mode: 'light',
});

function InitialLayout() {
  const { token, isLoading } = useAuth();
  const segments = useSegments(); // p.ej. ['(tabs)', 'tablero'] o ['ausencias']
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const first = segments[0] ?? '';
    const inAuthGroup = first === '(auth)';
    const inTabs = first === '(tabs)';

    // Permitir pantallas fuera de tabs sin redirigir
    const inAllowedDetails = first === 'ausencias' || first === 'tardanzas' || first === 'modal';

    if (token) {
      // Si está autenticado, manda a tabs cuando no esté en tabs ni en pantallas permitidas
      if (!(inTabs || inAllowedDetails)) {
        router.replace('/(tabs)');
      }
    } else {
      // Si NO está autenticado y no está en el grupo de auth, envía a login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    }
  }, [token, isLoading, segments, router]);

  if (isLoading) return <LoadingIndicator />;

  // *** IMPORTANTE: usar Stack aquí para que aparezca el header y el botón de volver ***
  return (
    <Stack>
      {/* Grupo de autenticación */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />.

      {/* Grupo de tabs */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Detalles con header y back automático */}
      <Stack.Screen
        name="ausencias"
        options={{ title: 'Detalle de Ausencias', headerBackTitle: 'Volver' }}
      />
      <Stack.Screen
        name="tardanzas"
        options={{ title: 'Detalle de Tardanzas', headerBackTitle: 'Volver' }}
      />

      {/* Si tienes alguna pantalla modal suelta */}
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <ThemeProvider theme={theme}>
          <NavTheme value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <InitialLayout />
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </NavTheme>
        </ThemeProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
