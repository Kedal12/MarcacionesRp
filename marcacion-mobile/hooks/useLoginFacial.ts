// src/hooks/useLoginFacial.ts
import { useState, useCallback, useRef } from 'react';
import { optimizarImagen, comprimirAgresivo } from '../utils/imageOptimizer';
import api from '../api/axios';

/**
 * Estados del proceso de login facial
 */
export const LOGIN_STATES = {
  IDLE: 'idle',
  CAPTURING: 'capturing',
  OPTIMIZING: 'optimizing',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type LoginState = typeof LOGIN_STATES[keyof typeof LOGIN_STATES];

export interface LoginProgress {
  step: string;
  percent: number;
}

export interface LoginFacialResponse {
  token: string;
  user: {
    id: number;
    nombreCompleto: string;
    email: string;
    rol: string;
    numeroDocumento: string;
    nombreSede?: string;
    biometriaHabilitada: boolean;
  };
  confidence: number;
}

export interface UseLoginFacialOptions {
  timeout?: number;
  maxRetries?: number;
  onSuccess?: (data: LoginFacialResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook optimizado para login facial
 */
export function useLoginFacial(options: UseLoginFacialOptions = {}) {
  const {
    timeout = 30000,
    maxRetries = 2,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<LoginState>(LOGIN_STATES.IDLE);
  const [progress, setProgress] = useState<LoginProgress>({ step: '', percent: 0 });
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loginFacial = useCallback(async (
    numeroDocumento: string, 
    photoUri: string
  ): Promise<LoginFacialResponse> => {
    let retries = 0;

    const ejecutar = async (): Promise<LoginFacialResponse> => {
      try {
        setError(null);
        
        // PASO 1: Optimizar imagen
        setState(LOGIN_STATES.OPTIMIZING);
        setProgress({ step: 'Optimizando foto...', percent: 20 });

        const startOptimize = Date.now();
        const optimized = await optimizarImagen(photoUri);
        console.log(`[LoginFacial] Optimización: ${Date.now() - startOptimize}ms, ${optimized.sizeKB}KB`);

        // Si muy grande, comprimir más
        let base64Final = optimized.base64;
        if (optimized.sizeKB > 150) {
          setProgress({ step: 'Comprimiendo...', percent: 30 });
          const compressed = await comprimirAgresivo(photoUri, 100);
          base64Final = compressed.base64;
        }

        // PASO 2: Enviar al servidor
        setState(LOGIN_STATES.UPLOADING);
        setProgress({ step: 'Verificando rostro...', percent: 50 });

        abortControllerRef.current = new AbortController();
        const timeoutId = setTimeout(() => {
          abortControllerRef.current?.abort();
        }, timeout);

        const startUpload = Date.now();
        
        const response = await api.post<LoginFacialResponse>('/api/auth/login-facial', {
          numeroDocumento,
          fotoBase64: base64Final,
        }, {
          signal: abortControllerRef.current.signal,
          timeout,
        });

        clearTimeout(timeoutId);
        console.log(`[LoginFacial] Request: ${Date.now() - startUpload}ms`);

        // PASO 3: Éxito
        setState(LOGIN_STATES.SUCCESS);
        setProgress({ step: '¡Verificado!', percent: 100 });

        onSuccess?.(response.data);
        return response.data;

      } catch (err: any) {
        console.error('[LoginFacial] Error:', err);

        if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
          if (retries < maxRetries) {
            retries++;
            console.log(`[LoginFacial] Reintento ${retries}/${maxRetries}...`);
            setProgress({ step: `Reintentando (${retries}/${maxRetries})...`, percent: 10 });
            return ejecutar();
          }
          
          const timeoutError = new Error('Tiempo agotado. Verifica tu conexión.');
          setError(timeoutError);
          setState(LOGIN_STATES.ERROR);
          onError?.(timeoutError);
          throw timeoutError;
        }

        const errorMessage = err.response?.data?.mensaje || 
                           err.response?.data?.message || 
                           err.message || 
                           'Error en autenticación facial';

        const serverError = new Error(errorMessage);
        setError(serverError);
        setState(LOGIN_STATES.ERROR);
        onError?.(serverError);
        throw serverError;
      }
    };

    return ejecutar();
  }, [timeout, maxRetries, onSuccess, onError]);

  const cancelar = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(LOGIN_STATES.IDLE);
    setProgress({ step: '', percent: 0 });
  }, []);

  const reset = useCallback(() => {
    setState(LOGIN_STATES.IDLE);
    setProgress({ step: '', percent: 0 });
    setError(null);
  }, []);

  return {
    state,
    progress,
    error,
    
    isLoading: [
      LOGIN_STATES.CAPTURING,
      LOGIN_STATES.OPTIMIZING,
      LOGIN_STATES.UPLOADING,
      LOGIN_STATES.PROCESSING,
    ].includes(state as any),
    isSuccess: state === LOGIN_STATES.SUCCESS,
    isError: state === LOGIN_STATES.ERROR,
    
    loginFacial,
    cancelar,
    reset,
    
    setCapturing: () => {
      setState(LOGIN_STATES.CAPTURING);
      setProgress({ step: 'Capturando foto...', percent: 10 });
    },
  };
}

export default useLoginFacial;
