// src/components/ProgressOverlay.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Colores corporativos
const CorporateColors = {
  primary: '#e9501e',
  primaryDark: '#cc3625',
  secondary: '#fab626',
  white: '#ffffff',
  success: '#4caf50',
  error: '#D9534F',
  textDark: '#2d2d2d',
  textLight: '#6b7280',
};

export interface ProgressOverlayProps {
  visible: boolean;
  step?: string;
  percent?: number;
  isSuccess?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Overlay de progreso con animaciones
 * Muestra estado actual de operaciones largas
 */
export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  visible,
  step = '',
  percent = 0,
  isSuccess = false,
  isError = false,
  errorMessage = '',
  onCancel,
  onRetry,
  onDismiss,
}) => {
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressWidth, {
      toValue: percent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [percent, progressWidth]);

  const getIcon = (): { name: keyof typeof Ionicons.glyphMap; color: string } | null => {
    if (isSuccess) return { name: 'checkmark-circle', color: CorporateColors.success };
    if (isError) return { name: 'close-circle', color: CorporateColors.error };
    return null;
  };

  const icon = getIcon();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icono o Spinner */}
          <View style={styles.iconContainer}>
            {icon ? (
              <Ionicons name={icon.name} size={64} color={icon.color} />
            ) : (
              <ActivityIndicator size="large" color={CorporateColors.primary} />
            )}
          </View>

          {/* Mensaje */}
          <Text style={[
            styles.step,
            isError && styles.errorText,
            isSuccess && styles.successText,
          ]}>
            {isError ? errorMessage : step}
          </Text>

          {/* Barra de progreso */}
          {!isSuccess && !isError && (
            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressWidth.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}

          {/* Porcentaje */}
          {!isSuccess && !isError && percent > 0 && (
            <Text style={styles.percent}>{Math.round(percent)}%</Text>
          )}

          {/* Botones */}
          <View style={styles.buttons}>
            {/* Botón cancelar (solo durante carga) */}
            {!isSuccess && !isError && onCancel && (
              <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            )}

            {/* Botón reintentar (solo en error) */}
            {isError && onRetry && (
              <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Ionicons name="refresh" size={20} color={CorporateColors.white} />
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
            )}

            {/* Botón cerrar (en error o éxito) */}
            {(isError || isSuccess) && onDismiss && (
              <TouchableOpacity 
                style={[styles.dismissButton, isSuccess && styles.successButton]} 
                onPress={onDismiss}
              >
                <Text style={[styles.dismissText, isSuccess && styles.dismissTextWhite]}>
                  {isSuccess ? 'Continuar' : 'Cerrar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Indicador inline de progreso (para usar en botones)
 */
export interface InlineProgressProps {
  step: string;
  percent: number;
  style?: object;
}

export const InlineProgress: React.FC<InlineProgressProps> = ({ step, percent, style }) => (
  <View style={[styles.inlineContainer, style]}>
    <ActivityIndicator size="small" color={CorporateColors.white} />
    <Text style={styles.inlineText}>{step}</Text>
    {percent > 0 && (
      <Text style={styles.inlinePercent}>{Math.round(percent)}%</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: CorporateColors.white,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  step: {
    fontSize: 16,
    color: CorporateColors.textDark,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  errorText: {
    color: CorporateColors.error,
  },
  successText: {
    color: CorporateColors.success,
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: CorporateColors.primary,
    borderRadius: 3,
  },
  percent: {
    fontSize: 14,
    color: CorporateColors.textLight,
    marginBottom: 16,
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelText: {
    color: CorporateColors.textLight,
    fontSize: 14,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CorporateColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  retryText: {
    color: CorporateColors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  successButton: {
    backgroundColor: CorporateColors.success,
  },
  dismissText: {
    color: CorporateColors.textDark,
    fontSize: 14,
    fontWeight: '600',
  },
  dismissTextWhite: {
    color: CorporateColors.white,
  },
  
  // Inline styles
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineText: {
    color: CorporateColors.white,
    fontSize: 14,
  },
  inlinePercent: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
});

export default ProgressOverlay;
