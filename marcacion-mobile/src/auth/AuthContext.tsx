import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// Se importan las nuevas funciones de API para biometría
import {
  loginFacial as apiLoginFacial,
  loginMobile as apiLoginMobile,
  me as apiMe
} from '@/src/api/auth';
import { tokenCache } from '@/src/utils/tokenStorage';

const TOKEN_KEY = 'auth-token';

// ===== Tipos =====
interface UserData {
  id: string | number;
  email: string;
  rol: 'admin' | 'empleado' | string;
  nombreCompleto: string;
  numeroDocumento?: string;
  idSede?: number;
  sedeNombre?: string;
  biometriaHabilitada?: boolean; // Campo necesario para lógica en UI
}

interface AuthContextType {
  token: string | null;
  user: UserData | null;
  isLoading: boolean;
  loginWithDocument: (numeroDocumento: string) => Promise<boolean>;
  loginWithFace: (numeroDocumento: string, fotoBase64: string) => Promise<boolean>; // Nuevo método
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

// ===== Provider =====
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<{
    token: string | null;
    user: UserData | null;
    isLoading: boolean;
  }>({
    token: null,
    user: null,
    isLoading: true,
  });

  // Bootstrap inicial: lee token usando tokenCache
  useEffect(() => {
    const bootstrapAsync = async () => {
      setAuthState((s) => ({ ...s, isLoading: true }));
      try {
        const userToken = await tokenCache.getToken(TOKEN_KEY);
        
        if (userToken) {
          console.log('[Auth] Token encontrado, validando con /me...');
          const userData = await apiMe(); 
          setAuthState({ token: userToken, user: userData, isLoading: false });
          console.log('[Auth] Usuario cargado:', userData.nombreCompleto);
        } else {
          console.log('[Auth] No se encontró token');
          setAuthState({ token: null, user: null, isLoading: false });
        }
      } catch (e: any) {
        console.error('[Auth] Error en bootstrap:', e?.message ?? e);
        await tokenCache.deleteToken(TOKEN_KEY);
        setAuthState({ token: null, user: null, isLoading: false });
      }
    };
    bootstrapAsync();
  }, []);

  // Login tradicional por documento
  const loginWithDocument = async (numeroDocumento: string): Promise<boolean> => {
    setAuthState((s) => ({ ...s, isLoading: true, user: null }));
    try {
      console.log('[Auth] Iniciando login con documento...');
      const response = await apiLoginMobile(numeroDocumento);
      
      if (!response.token) throw new Error('No se recibió token del servidor.');

      await tokenCache.saveToken(TOKEN_KEY, response.token);

      const userData: UserData = {
        id: response.usuario.id,
        email: response.usuario.email,
        rol: response.usuario.rol,
        nombreCompleto: response.usuario.nombreCompleto,
        numeroDocumento: response.usuario.numeroDocumento,
        sedeNombre: response.usuario.sedeNombre ?? undefined,
      };

      setAuthState({ token: response.token, user: userData, isLoading: false });
      return true;
    } catch (error: any) {
      console.error('[Auth] Error en login:', error?.message ?? error);
      await tokenCache.deleteToken(TOKEN_KEY);
      setAuthState({ token: null, user: null, isLoading: false });
      throw error;
    }
  };

  // ✅ NUEVO: Login con reconocimiento facial
  const loginWithFace = async (numeroDocumento: string, fotoBase64: string): Promise<boolean> => {
    setAuthState((s) => ({ ...s, isLoading: true, user: null }));
    try {
      console.log('[Auth] Iniciando login facial...');
      
      const response = await apiLoginFacial(numeroDocumento, fotoBase64);
      
      if (!response.token) throw new Error('No se recibió token.');

      await tokenCache.saveToken(TOKEN_KEY, response.token);

      // Mapeo de datos del usuario desde la respuesta facial
      const userData: UserData = {
        id: response.user.id,
        email: response.user.email,
        rol: response.user.rol,
        nombreCompleto: response.user.nombreCompleto,
        numeroDocumento: response.user.numeroDocumento,
        sedeNombre: response.user.sedeNombre ?? undefined,
        biometriaHabilitada: response.user.biometriaHabilitada
      };

      setAuthState({ token: response.token, user: userData, isLoading: false });
      console.log('[Auth] Login facial exitoso:', userData.nombreCompleto);
      return true;
    } catch (error: any) {
      console.error('[Auth] Error en login facial:', error?.message ?? error);
      await tokenCache.deleteToken(TOKEN_KEY);
      setAuthState({ token: null, user: null, isLoading: false });
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    setAuthState((s) => ({ ...s, isLoading: true }));
    try {
      await tokenCache.deleteToken(TOKEN_KEY);
      setAuthState({ token: null, user: null, isLoading: false });
      console.log('[Auth] Logout exitoso');
    } catch (e: any) {
      console.error('[Auth] Error en logout:', e?.message ?? e);
      setAuthState({ token: null, user: null, isLoading: false });
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      token: authState.token,
      user: authState.user,
      isLoading: authState.isLoading,
      loginWithDocument,
      loginWithFace, // Se expone el nuevo método
      logout,
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  return ctx;
};