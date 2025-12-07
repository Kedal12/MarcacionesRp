import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';

import { tokenCache } from '@/src/utils/tokenStorage';

export const TOKEN_KEY = 'auth-token'; 

const fromEnv = process.env.EXPO_PUBLIC_API_URL;
const fromConfig = (Constants.expoConfig?.extra as any)?.apiUrl;

const rawApiUrl = fromEnv || fromConfig;

if (!rawApiUrl) {
  console.error(
    '[axios] ERROR: API_URL no está definida. Configúrala en app.json -> extra.apiUrl o en EXPO_PUBLIC_API_URL'
  );
}

const API_URL = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : '';
console.log('[axios] Usando API_URL =', API_URL);

// ===== Instancia Axios =====
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // ✅ AGREGADO: Header para ngrok
    'ngrok-skip-browser-warning': 'true',
  },
});

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// ===== Interceptor de Request =====
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    config.headers = config.headers ?? {};

    // ✅ Asegurarse de que el header de ngrok siempre esté presente
    (config.headers as any)['ngrok-skip-browser-warning'] = 'true';

    const token = await tokenCache.getToken(TOKEN_KEY);
    
    if (token) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError): Promise<never> => {
    console.error('[axios][request] error:', error.message);
    return Promise.reject(error);
  }
);

// ===== Interceptor de Response =====
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<never> => {
    const status = error.response?.status;
    const originalRequest = error.config as RetryableRequest | undefined;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      console.warn('[axios][response] 401 detectado: limpiando token');
      originalRequest._retry = true;
      try {
        await tokenCache.deleteToken(TOKEN_KEY);
      } catch (e) {
        console.error('[axios] Error borrando token tras 401:', e);
      }
      return Promise.reject(new Error('Unauthorized - Token limpiado'));
    }

    console.error(
      '[axios][response] error:',
      error.response?.data ?? error.message
    );
    return Promise.reject(error);
  }
);

export default api;

// ===== Helpers de token =====
export const storeToken = async (token: string): Promise<void> => {
  try {
    await tokenCache.saveToken(TOKEN_KEY, token);
  } catch (e) {
    console.error('[axios] Error guardando token:', e);
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await tokenCache.deleteToken(TOKEN_KEY);
  } catch (e) {
    console.error('[axios] Error borrando token:', e);
  }
};

export const getToken = async (): Promise<string | null> => {
  try {
    return await tokenCache.getToken(TOKEN_KEY);
  } catch (e) {
    console.error('[axios] Error obteniendo token:', e);
    return null;
  }
};