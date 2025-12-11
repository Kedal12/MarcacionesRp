// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Navegación existente
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  
  // ✅ Iconos para tabs (nombres simplificados)
  'list.bullet': 'list',
  'chart.bar.fill': 'bar-chart',
  'calendar': 'event',
  'clock.fill': 'schedule',
  
  // Iconos adicionales útiles
  'person.fill': 'person',
  'gearshape.fill': 'settings',
  'bell.fill': 'notifications',
  'location.fill': 'location-on',
  'checkmark.circle.fill': 'check-circle',
  'xmark.circle.fill': 'cancel',
  'plus.circle.fill': 'add-circle',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'magnifyingglass': 'search',
  'trash.fill': 'delete',
  'pencil': 'edit',
  'info.circle.fill': 'info',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name];
  
  // Si no existe el mapeo, mostrar un icono por defecto
  if (!iconName) {
    console.warn(`IconSymbol: No mapping found for "${name}"`);
    return <MaterialIcons color={color} size={size} name="help-outline" style={style} />;
  }
  
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}