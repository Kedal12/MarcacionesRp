// src/app/(tabs)/index.tsx
import { Button, Card, Icon, Text } from '@rneui/themed';
import dayjs from 'dayjs';
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
  const buttonColor = nextMarkType === 'entrada' ? '#28a745' : '#ffc107';

  const fetchLastMarcacion = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Límites del día en Bogotá → enviados en UTC al backend
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

      // ✅ Mostrar HORA LOCAL que ya viene del backend
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

  // ==== UI: usar SIEMPRE los campos *Local* que ya vienen desde el backend ====
  const ultimaLocalISO = lastMarcacion?.fechaHoraLocal ?? null;
  const displayTime = ultimaLocalISO ? dayjs(ultimaLocalISO).format('HH:mm') : '--:--';
  const displayFromNow = ultimaLocalISO ? dayjs(ultimaLocalISO).fromNow() : '--';

  const inicioAlmuerzoISO = estadoAlmuerzo?.inicioAlmuerzoLocal ?? null;
  const displayAlmuerzoTime = inicioAlmuerzoISO ? dayjs(inicioAlmuerzoISO).format('HH:mm') : '--:--';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <Card containerStyle={stylesHome.heroCard}>
          <Text h3 style={stylesHome.hello}>¡Hola, {user?.nombreCompleto || 'Usuario'}!</Text>

          <Image
            source={require('../../assets/images/logo.png')}
            style={stylesHome.logo}
            resizeMode="contain"
          />

          <Text style={stylesHome.dateText}>{nowInBogota().format('dddd, D [de] MMMM')}</Text>

          <View style={stylesHome.lastMarkContainer}>
            <Icon
              name={lastMarcacion?.tipo === 'entrada' ? 'log-in' : 'log-out'}
              type="ionicon"
              color={lastMarcacion?.tipo === 'entrada' ? 'green' : 'orange'}
              size={20}
            />
            <Text style={stylesHome.lastMarkText}>
              {lastMarcacion
                ? `Última marca: ${lastMarcacion.tipo === 'entrada' ? 'Entrada' : 'Salida'} ${displayFromNow} (${displayTime})`
                : 'No hay marcaciones registradas hoy.'}
            </Text>
          </View>

          {estadoAlmuerzo?.estado === 'almuerzo_en_curso' && (
            <View style={stylesHome.almuerzoEnCursoContainer}>
              <Icon name="fast-food" type="ionicon" color="#f59e0b" size={20} />
              <Text style={stylesHome.almuerzoEnCursoText}>
                Almuerzo en curso desde las {displayAlmuerzoTime}
              </Text>
            </View>
          )}

          {estadoAlmuerzo?.estado === 'almuerzo_completado' && (
            <View style={stylesHome.almuerzoCompletadoContainer}>
              <Icon name="checkmark-circle" type="ionicon" color="#10b981" size={20} />
              <Text style={stylesHome.almuerzoCompletadoText}>
                Almuerzo completado: {estadoAlmuerzo.tiempoAlmuerzoMinutos} minutos
              </Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
          {locationError && <Text style={[styles.errorText, { color: 'orange' }]}>{locationError}</Text>}
        </Card>

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
          titleStyle={{ fontSize: 18, fontWeight: 'bold' }}
        />

        {lastMarcacion?.tipo === 'entrada' && estadoAlmuerzo?.estado === 'sin_almuerzo' && (
          <Button
            title="Iniciar Almuerzo"
            onPress={() => handleAlmuerzo('inicio')}
            buttonStyle={[styles.almuerzoButton, { backgroundColor: '#f59e0b' }]}
            containerStyle={styles.buttonContainer}
            disabled={isSubmitting || isSubmittingAlmuerzo}
            loading={isSubmittingAlmuerzo}
            icon={<Icon name="fast-food-outline" type="ionicon" size={22} color="white" iconStyle={{ marginRight: 10 }} />}
            titleStyle={{ fontSize: 16, fontWeight: '600' }}
          />
        )}

        {estadoAlmuerzo?.estado === 'almuerzo_en_curso' && (
          <Button
            title="Finalizar Almuerzo"
            onPress={() => handleAlmuerzo('fin')}
            buttonStyle={[styles.almuerzoButton, { backgroundColor: '#10b981' }]}
            containerStyle={styles.buttonContainer}
            disabled={isSubmitting || isSubmittingAlmuerzo}
            loading={isSubmittingAlmuerzo}
            icon={<Icon name="checkmark-circle-outline" type="ionicon" size={22} color="white" iconStyle={{ marginRight: 10 }} />}
            titleStyle={{ fontSize: 16, fontWeight: '600' }}
          />
        )}

        <Button
          title="Cerrar Sesión"
          type="clear"
          onPress={logout}
          containerStyle={{ marginTop: 10 }}
          titleStyle={{ color: 'grey' }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6f8' },
  container: { flex: 1, alignItems: 'center', padding: 20 },
  buttonContainer: { width: '80%', marginVertical: 10 },
  markButton: {
    paddingVertical: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  almuerzoButton: {
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 4,
  },
  errorText: { color: 'red', marginTop: 10, textAlign: 'center', fontSize: 14 },
});

const stylesHome = StyleSheet.create({
  heroCard: { width: '92%', borderRadius: 16, marginBottom: 20 },
  hello: { textAlign: 'center', marginBottom: 10, fontWeight: '900' },
  logo: { width: 120, height: 60, alignSelf: 'center', marginVertical: 6 },
  dateText: { textAlign: 'center', color: '#6b7280', marginBottom: 8, fontWeight: '600' },
  lastMarkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  lastMarkText: { color: '#374151', fontSize: 14, textAlign: 'center', flex: 1 },
  almuerzoEnCursoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 10,
  },
  almuerzoEnCursoText: { color: '#92400e', fontSize: 14, textAlign: 'center', flex: 1, fontWeight: '600' },
  almuerzoCompletadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 10,
  },
  almuerzoCompletadoText: { color: '#065f46', fontSize: 14, textAlign: 'center', flex: 1, fontWeight: '600' },
});
