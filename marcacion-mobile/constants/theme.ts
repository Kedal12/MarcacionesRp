/**
 * LA MEDIA NARANJA - Colores Corporativos
 * Colores principales: #cc3625, #e9501e, #fab626
 */

import { Platform } from 'react-native';

// Colores corporativos
export const CorporateColors = {
  primary: '#e9501e',      // Naranja principal
  primaryDark: '#cc3625',  // Rojo/Naranja oscuro
  secondary: '#fab626',    // Amarillo/Dorado
  white: '#ffffff',
  textDark: '#2d2d2d',
  textLight: '#555555',
  background: '#fff5f2',   // Fondo suave con tono naranja
  success: '#4caf50',
  error: '#d32f2f',
  warning: '#fab626',
};

const tintColorLight = CorporateColors.primary;
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: CorporateColors.textDark,
    background: CorporateColors.white,
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    // Colores corporativos adicionales
    primary: CorporateColors.primary,
    primaryDark: CorporateColors.primaryDark,
    secondary: CorporateColors.secondary,
    success: CorporateColors.success,
    error: CorporateColors.error,
    warning: CorporateColors.warning,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    // Colores corporativos adicionales
    primary: CorporateColors.primary,
    primaryDark: CorporateColors.primaryDark,
    secondary: CorporateColors.secondary,
    success: CorporateColors.success,
    error: CorporateColors.error,
    warning: CorporateColors.warning,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});