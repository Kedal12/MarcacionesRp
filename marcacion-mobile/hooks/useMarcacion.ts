// src/hooks/useMarcacion.ts
import { useState, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import api from '../api/axios';

/**
 * Estados del proceso de marcación
 */
export const MARCACION_STATES = {
  IDLE: 'idle',
  GETTING_LOCATION: 'getting_location',
  SENDING: 'sending',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type MarcacionState = typeof MARCACION_STATES[keyof typeof MARCACION_STATES];

export interface MarcacionProgress {
  step: string;
  percent: number;
}

export interface MarcacionResponse {
  id: number;
  idUsuario: number;
  tipo: string;
  fechaHora: string;
  fechaHoraLocal: string;
  latitudMarcacion: number;
  longitudMarcacion: number;
}

export interface UseMarcacionOptions {
  timeout?: number;
  onSuccess?: (data: MarcacionResponse, tipo: 'entrada' | 'salida') => void;
  onError?: (error: Error) => void;
}

interface LocationResult {
  latitud: number;
  longitud: number;
  precision: number;
}

/**
 * Hook optimizado para marcaciones
 */
export function useMarcacion(options: UseMarcacionOptions = {}) {
  const {
    timeout = 15000,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<MarcacionState>(MARCACION_STATES.IDLE);
  const [progress, setProgress] = useState<MarcacionProgress>({ step: '', percent: 0 });
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * ✅ Obtiene ubicación OPTIMIZADA
   * - Usa Balanced en lugar de High (más rápido)
   * - Usa caché de 30 segundos
   */
  const obtenerUbicacion = async (timeoutMs: number = 8000): Promise<LocationResult> => {
    // Verificar permisos
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permiso de ubicación denegado');
    }

    const location = await Location.getCurrentPositionAsync({
      // ✅ Balanced es suficiente para geocerca de 50m y es MUCHO más rápido
      accuracy: Location.Accuracy.Balanced,
      // ✅ Usar caché de ubicación reciente (30 segundos)
      // @ts-ignore - Esta opción existe pero no está en los tipos
      maxAge: 30000,
    });

    return {
      latitud: location.coords.latitude,
      longitud: location.coords.longitude,
      precision: location.coords.accuracy ?? 0,
    };
  };

  /**
   * Ejecuta una marcación (entrada/salida)
   */
  const marcar = useCallback(async (tipo: 'entrada' | 'salida'): Promise<MarcacionResponse> => {
    try {
      setError(null);
      
      // PASO 1: Obtener ubicación
      setState(MARCACION_STATES.GETTING_LOCATION);
      setProgress({ step: 'Obteniendo ubicación...', percent: 30 });

      const startGps = Date.now();
      const ubicacion = await obtenerUbicacion(8000);
      console.log(`[Marcacion] GPS: ${Date.now() - startGps}ms, Precisión: ${ubicacion.precision}m`);

      // PASO 2: Enviar al servidor
      setState(MARCACION_STATES.SENDING);
      setProgress({ step: 'Registrando...', percent: 70 });

      abortControllerRef.current = new AbortController();
      
      const startRequest = Date.now();
      const response = await api.post<MarcacionResponse>('/api/marcaciones', {
        tipo,
        latitud: ubicacion.latitud,
        longitud: ubicacion.longitud,
      }, {
        signal: abortControllerRef.current.signal,
        timeout,
      });
      
      console.log(`[Marcacion] Request: ${Date.now() - startRequest}ms`);

      // PASO 3: Éxito
      setState(MARCACION_STATES.SUCCESS);
      setProgress({ step: '¡Registrado!', percent: 100 });

      onSuccess?.(response.data, tipo);

      // Reset después de 2 segundos
      setTimeout(() => {
        setState(MARCACION_STATES.IDLE);
        setProgress({ step: '', percent: 0 });
      }, 2000);

      return response.data;

    } catch (err: any) {
      console.error('[Marcacion] Error:', err);
      
      const errorMessage = err.response?.data || err.message || 'Error al marcar';
      const marcacionError = new Error(
        typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)
      );
      
      setError(marcacionError);
      setState(MARCACION_STATES.ERROR);
      onError?.(marcacionError);
      
      // Reset después de 3 segundos
      setTimeout(() => {
        setState(MARCACION_STATES.IDLE);
        setProgress({ step: '', percent: 0 });
      }, 3000);

      throw marcacionError;
    }
  }, [timeout, onSuccess, onError]);

  const marcarEntrada = useCallback(() => marcar('entrada'), [marcar]);
  const marcarSalida = useCallback(() => marcar('salida'), [marcar]);

  const cancelar = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(MARCACION_STATES.IDLE);
    setProgress({ step: '', percent: 0 });
  }, []);

  const reset = useCallback(() => {
    setState(MARCACION_STATES.IDLE);
    setProgress({ step: '', percent: 0 });
    setError(null);
  }, []);

  return {
    state,
    progress,
    error,
    
    isLoading: [
      MARCACION_STATES.GETTING_LOCATION,
      MARCACION_STATES.SENDING,
    ].includes(state as any),
    isSuccess: state === MARCACION_STATES.SUCCESS,
    isError: state === MARCACION_STATES.ERROR,
    
    marcar,
    marcarEntrada,
    marcarSalida,
    cancelar,
    reset,
  };
}

export default useMarcacion;
