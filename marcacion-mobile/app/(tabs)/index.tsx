// src/app/(tabs)/index.tsx
import { Button, Card, Icon, Text } from '@rneui/themed';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, AppStateStatus, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { nowInBogota } from '@/src/utils/date';

import {
  crearMarcacion,
  finalizarAlmuerzo,
  getMisMarcaciones,
  iniciarAlmuerzo,
  obtenerEstadoAlmuerzo,
  type EstadoAlmuerzo,
  type Marcacion,
  type MarcacionCreacionDto,
} from '@/src/api/marcaciones';
import { useAuth } from '@/src/auth/AuthContext';
import LoadingIndicator from '@/src/components/LoadingIndicator';

// ✅ Colores corporativos "La Media Naranja"
const CorporateColors = {
  primary: '#e9501e',
  primaryDark: '#cc3625',
  secondary: '#fab626',
  white: '#ffffff',
  background: '#fff8f5',
  success: '#4caf50',
  warning: '#f59e0b',
  textDark: '#2d2d2d',
  textLight: '#6b7280',
};

export default function HomeScreen() {
  const { user, logout, token, isLoading: authLoading } = useAuth();

  const [lastMarcacion, setLastMarcacion] = useState<Marcacion | null>(null);
  const [estadoAlmuerzo, setEstadoAlmuerzo] = useState<EstadoAlmuerzo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingAlmuerzo, setIsSubmittingAlmuerzo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const nextMarkType: 'entrada' | 'salida' =
    !lastMarcacion || lastMarcacion.tipo === 'salida' ? 'entrada' : 'salida';

  const buttonLabel = `Marcar ${nextMarkType === 'entrada' ? 'Entrada' : 'Salida'}`;
  // ✅ Colores corporativos para botones
  const buttonColor = nextMarkType === 'entrada' ? CorporateColors.success : CorporateColors.primary;

  const fetchLastMarcacion = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const startLocal = nowInBogota().startOf('day');
      const todayStart = startLocal.utc().toISOString();
      const todayEnd = startLocal.add(1, 'day').utc().toISOString();

      const response = await getMisMarcaciones({
        desde: todayStart,
        hasta: todayEnd,
        pageSize: 1,
      });

      setLastMarcacion(response.items?.[0] ?? null);

      const estadoAlmuerzoData = await obtenerEstadoAlmuerzo();
      setEstadoAlmuerzo(estadoAlmuerzoData);
    } catch (err: any) {
      console.error('Error fetching marcaciones:', err);
      setError('No se pudo obtener el estado actual de marcación.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && token) {
      fetchLastMarcacion();
    }
  }, [authLoading, token, fetchLastMarcacion]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && !authLoading && token) {
        fetchLastMarcacion();
      }
    });
    return () => subscription.remove();
  }, [authLoading, token, fetchLastMarcacion]);

  const handleMarcar = async () => {
    setIsSubmitting(true);
    setError(null);
    setLocationError(null);

    if (!token) {
      setIsSubmitting(false);
      Alert.alert('Sesión', 'Tu sesión no está activa. Inicia sesión nuevamente.');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const msg = 'Permiso de ubicación denegado. No se puede marcar.';
        setLocationError(msg);
        Alert.alert('Permiso Requerido', 'Necesitamos acceso a tu ubicación para registrar la marcación.');
        setIsSubmitting(false);
        return;
      }

      let location: Location.LocationObject;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch (locationErr: any) {
        console.error('Error obteniendo ubicación:', locationErr);
        const msg = 'No se pudo obtener la ubicación actual. Intenta de nuevo.';
        setLocationError(msg);
        Alert.alert('Error de Ubicación', 'No pudimos obtener tu ubicación. Revisa GPS/señal e inténtalo de nuevo.');
        setIsSubmitting(false);
        return;
      }

      const marcacionData: MarcacionCreacionDto = {
        tipo: nextMarkType,
        latitud: location.coords.latitude,
        longitud: location.coords.longitude,
      };

      const nuevaMarcacion = await crearMarcacion(marcacionData);

      const hm = nuevaMarcacion?.fechaHoraLocal
        ? dayjs(nuevaMarcacion.fechaHoraLocal).format('HH:mm')
        : '--:--';

      Alert.alert(
        'Éxito',
        `Marcación de ${nextMarkType === 'entrada' ? 'Entrada' : 'Salida'} registrada a las ${hm}.`
      );

      setLastMarcacion(nuevaMarcacion);
      setError(null);

      const estado = await obtenerEstadoAlmuerzo();
      setEstadoAlmuerzo(estado);
    } catch (err: any) {
      console.error('Error al marcar:', err?.response?.data || err?.message);
      let errorMessage = `Error al registrar la marcación de ${nextMarkType}. Intenta de nuevo.`;
      if (err?.response?.status === 400 && typeof err.response.data === 'string') {
        errorMessage = err.response.data;
      } else if (err?.response?.status === 401) {
        errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.';
      }
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAlmuerzo = async (accion: 'inicio' | 'fin') => {
    setIsSubmittingAlmuerzo(true);
    setError(null);
    setLocationError(null);

    if (!token) {
      setIsSubmittingAlmuerzo(false);
      Alert.alert('Sesión', 'Tu sesión no está activa. Inicia sesión nuevamente.');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const msg = 'Permiso de ubicación denegado.';
        setLocationError(msg);
        Alert.alert('Permiso Requerido', 'Necesitamos acceso a tu ubicación.');
        setIsSubmittingAlmuerzo(false);
        return;
      }

      let location: Location.LocationObject;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch (locationErr: any) {
        console.error('Error obteniendo ubicación:', locationErr);
        const msg = 'No se pudo obtener la ubicación actual.';
        setLocationError(msg);
        Alert.alert('Error de Ubicación', 'No pudimos obtener tu ubicación.');
        setIsSubmittingAlmuerzo(false);
        return;
      }

      const almuerzoData = {
        latitud: location.coords.latitude,
        longitud: location.coords.longitude,
      };

      if (accion === 'inicio') {
        await iniciarAlmuerzo(almuerzoData);
        Alert.alert('Éxito', 'Inicio de almuerzo registrado correctamente.');
      } else {
        const resultado = await finalizarAlmuerzo(almuerzoData);
        Alert.alert('Éxito', `Fin de almuerzo registrado. Duración: ${resultado.tiempoAlmuerzoMinutos} minutos.`);
      }

      const estado = await obtenerEstadoAlmuerzo();
      setEstadoAlmuerzo(estado);
      await fetchLastMarcacion();
    } catch (err: any) {
      console.error('Error en almuerzo:', err?.response?.data || err?.message);
      let errorMessage = 'Error al registrar el almuerzo. Intenta de nuevo.';
      if (err?.response?.status === 400 && typeof err.response.data === 'string') {
        errorMessage = err.response.data;
      }
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmittingAlmuerzo(false);
    }
  };

  if (authLoading || (isLoading && !lastMarcacion)) {
    return <LoadingIndicator />;
  }

  const ultimaLocalISO = lastMarcacion?.fechaHoraLocal ?? null;
  const displayTime = ultimaLocalISO ? dayjs(ultimaLocalISO).format('HH:mm') : '--:--';
  const displayFromNow = ultimaLocalISO ? dayjs(ultimaLocalISO).fromNow() : '--';

  const inicioAlmuerzoISO = estadoAlmuerzo?.inicioAlmuerzoLocal ?? null;
  const displayAlmuerzoTime = inicioAlmuerzoISO ? dayjs(inicioAlmuerzoISO).format('HH:mm') : '--:--';

  return (
    <View style={styles.container}>
      {/* ✅ Header con gradiente corporativo */}
      <LinearGradient
        colors={[CorporateColors.primaryDark, CorporateColors.primary, CorporateColors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>¡Hola, {user?.nombreCompleto || 'Usuario'}!</Text>

            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.dateText}>{nowInBogota().format('dddd, D [de] MMMM')}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Contenido */}
      <View style={styles.content}>
        {/* Card de última marcación */}
        <Card containerStyle={styles.card}>
          <View style={styles.lastMarkContainer}>
            <Icon
              name={lastMarcacion?.tipo === 'entrada' ? 'log-in' : 'log-out'}
              type="ionicon"
              color={lastMarcacion?.tipo === 'entrada' ? CorporateColors.success : CorporateColors.primary}
              size={22}
            />
            <Text style={styles.lastMarkText}>
              {lastMarcacion
                ? `Última marca: ${lastMarcacion.tipo === 'entrada' ? 'Entrada' : 'Salida'} ${displayFromNow} (${displayTime})`
                : 'No hay marcaciones registradas hoy.'}
            </Text>
          </View>

          {estadoAlmuerzo?.estado === 'almuerzo_en_curso' && (
            <View style={styles.almuerzoEnCursoContainer}>
              <Icon name="fast-food" type="ionicon" color={CorporateColors.warning} size={20} />
              <Text style={styles.almuerzoEnCursoText}>
                Almuerzo en curso desde las {displayAlmuerzoTime}
              </Text>
            </View>
          )}

          {estadoAlmuerzo?.estado === 'almuerzo_completado' && (
            <View style={styles.almuerzoCompletadoContainer}>
              <Icon name="checkmark-circle" type="ionicon" color={CorporateColors.success} size={20} />
              <Text style={styles.almuerzoCompletadoText}>
                Almuerzo completado: {estadoAlmuerzo.tiempoAlmuerzoMinutos} minutos
              </Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
          {locationError && <Text style={[styles.errorText, { color: CorporateColors.warning }]}>{locationError}</Text>}
        </Card>

        {/* ✅ Botón de marcar con color corporativo */}
        <Button
          title={buttonLabel}
          onPress={handleMarcar}
          buttonStyle={[styles.markButton, { backgroundColor: buttonColor }]}
          containerStyle={styles.buttonContainer}
          disabled={isSubmitting || isLoading || isSubmittingAlmuerzo}
          loading={isSubmitting}
          icon={
            <Icon
              name={nextMarkType === 'entrada' ? 'log-in' : 'log-out'}
              type="ionicon"
              size={25}
              color="white"
              iconStyle={{ marginRight: 10 }}
            />
          }
          titleStyle={styles.buttonTitle}
        />

        {/* Botón de almuerzo - inicio */}
        {lastMarcacion?.tipo === 'entrada' && estadoAlmuerzo?.estado === 'sin_almuerzo' && (
          <Button
            title="Iniciar Almuerzo"
            onPress={() => handleAlmuerzo('inicio')}
            buttonStyle={[styles.almuerzoButton, { backgroundColor: CorporateColors.secondary }]}
            containerStyle={styles.buttonContainer}
            disabled={isSubmitting || isSubmittingAlmuerzo}
            loading={isSubmittingAlmuerzo}
            icon={<Icon name="fast-food-outline" type="ionicon" size={22} color={CorporateColors.textDark} iconStyle={{ marginRight: 10 }} />}
            titleStyle={[styles.almuerzoButtonTitle, { color: CorporateColors.textDark }]}
          />
        )}

        {/* Botón de almuerzo - fin */}
        {estadoAlmuerzo?.estado === 'almuerzo_en_curso' && (
          <Button
            title="Finalizar Almuerzo"
            onPress={() => handleAlmuerzo('fin')}
            buttonStyle={[styles.almuerzoButton, { backgroundColor: CorporateColors.success }]}
            containerStyle={styles.buttonContainer}
            disabled={isSubmitting || isSubmittingAlmuerzo}
            loading={isSubmittingAlmuerzo}
            icon={<Icon name="checkmark-circle-outline" type="ionicon" size={22} color="white" iconStyle={{ marginRight: 10 }} />}
            titleStyle={styles.almuerzoButtonTitle}
          />
        )}

        {/* Botón cerrar sesión */}
        <Button
          title="Cerrar Sesión"
          type="clear"
          onPress={logout}
          containerStyle={{ marginTop: 15 }}
          titleStyle={{ color: CorporateColors.textLight }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CorporateColors.background,
  },
  header: {
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: CorporateColors.white,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  logo: {
    width: 130,
    height: 55,
    marginVertical: 10,
  },
  dateText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    marginBottom: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 0,
  },
  lastMarkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  lastMarkText: {
    color: CorporateColors.textDark,
    fontSize: 14,
    textAlign: 'center',
    flex: 1,
  },
  almuerzoEnCursoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 12,
  },
  almuerzoEnCursoText: {
    color: '#92400e',
    fontSize: 14,
    textAlign: 'center',
    flex: 1,
    fontWeight: '600',
  },
  almuerzoCompletadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 12,
  },
  almuerzoCompletadoText: {
    color: '#065f46',
    fontSize: 14,
    textAlign: 'center',
    flex: 1,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    marginVertical: 8,
  },
  markButton: {
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: CorporateColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  almuerzoButton: {
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  almuerzoButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CorporateColors.white,
  },
  errorText: {
    color: CorporateColors.primaryDark,
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
  },
});