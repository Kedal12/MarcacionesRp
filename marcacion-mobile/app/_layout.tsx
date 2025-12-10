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

// ✅ Colores corporativos "La Media Naranja"
const CorporateColors = {
  primary: '#e9501e',      // Naranja principal
  primaryDark: '#cc3625',  // Rojo/Naranja oscuro
  secondary: '#fab626',    // Amarillo/Dorado
  white: '#ffffff',
  background: '#fff8f5',   // Fondo suave con tono naranja
  success: '#4caf50',
  warning: '#fab626',
  error: '#d32f2f',
};

// ✅ Tema personalizado para @rneui con colores corporativos
const theme = createTheme({
  lightColors: {
    primary: CorporateColors.primary,
    // @ts-ignore - RNE tiene tipos incompletos para colores custom
    secondary: CorporateColors.secondary,
    success: CorporateColors.success,
    warning: CorporateColors.warning,
    error: CorporateColors.error,
    background: CorporateColors.background,
  },
  darkColors: {
    primary: CorporateColors.primary,
    // @ts-ignore
    secondary: CorporateColors.secondary,
    success: CorporateColors.success,
    warning: CorporateColors.warning,
    error: CorporateColors.error,
  },
  mode: 'light',
  components: {
    Button: {
      buttonStyle: {
        borderRadius: 10,
      },
      titleStyle: {
        fontWeight: '700',
      },
    },
    Card: {
      containerStyle: {
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
    },
  },
});

// ✅ Tema de navegación personalizado con colores corporativos
const CorporateLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: CorporateColors.primary,
    background: CorporateColors.white,
    card: CorporateColors.white,
    text: '#2d2d2d',
    border: '#e0e0e0',
    notification: CorporateColors.primary,
  },
};

const CorporateDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: CorporateColors.primary,
    notification: CorporateColors.primary,
  },
};

function InitialLayout() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const first = segments[0] ?? '';
    const inAuthGroup = first === '(auth)';
    const inTabs = first === '(tabs)';

    const inAllowedDetails = first === 'ausencias' || first === 'tardanzas' || first === 'modal';

    if (token) {
      if (!(inTabs || inAllowedDetails)) {
        router.replace('/(tabs)');
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    }
  }, [token, isLoading, segments, router]);

  if (isLoading) return <LoadingIndicator />;

  return (
    <Stack
      screenOptions={{
        // ✅ Header con colores corporativos
        headerStyle: {
          backgroundColor: CorporateColors.primary,
        },
        headerTintColor: CorporateColors.white,
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerShadowVisible: false,
      }}
    >
      {/* Grupo de autenticación */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />

      {/* Grupo de tabs */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Detalles con header corporativo */}
      <Stack.Screen
        name="ausencias"
        options={{ 
          title: 'Detalle de Ausencias', 
          headerBackTitle: 'Volver',
        }}
      />
      <Stack.Screen
        name="tardanzas"
        options={{ 
          title: 'Detalle de Tardanzas', 
          headerBackTitle: 'Volver',
        }}
      />

      {/* Pantalla modal */}
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
          <NavTheme value={colorScheme === 'dark' ? CorporateDarkTheme : CorporateLightTheme}>
            <InitialLayout />
            <StatusBar style="light" />
          </NavTheme>
        </ThemeProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}