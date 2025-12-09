import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { loginMobile as apiLoginMobile, me as apiMe } from '@/src/api/auth';
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
}

interface AuthContextType {
  token: string | null;
  user: UserData | null;
  isLoading: boolean;
  loginWithDocument: (numeroDocumento: string) => Promise<boolean>;
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

  // ✅ NUEVO: Login solo con número de documento
  const loginWithDocument = async (numeroDocumento: string): Promise<boolean> => {
    setAuthState((s) => ({ ...s, isLoading: true, user: null }));
    try {
      console.log('[Auth] Iniciando login con documento...');
      
      const response = await apiLoginMobile(numeroDocumento);
      
      if (!response.token) {
        throw new Error('No se recibió token del servidor.');
      }

      // Guardamos el token
      await tokenCache.saveToken(TOKEN_KEY, response.token);

      // Usamos los datos del usuario que vienen en la respuesta
      const userData: UserData = {
        id: response.usuario.id,
        email: response.usuario.email,
        rol: response.usuario.rol,
        nombreCompleto: response.usuario.nombreCompleto,
        numeroDocumento: response.usuario.numeroDocumento,
        sedeNombre: response.usuario.sedeNombre ?? undefined,
      };

      setAuthState({ token: response.token, user: userData, isLoading: false });
      console.log('[Auth] Login exitoso:', userData.nombreCompleto);
      return true;
    } catch (error: any) {
      console.error('[Auth] Error en login:', error?.message ?? error);
      await tokenCache.deleteToken(TOKEN_KEY);
      setAuthState({ token: null, user: null, isLoading: false });
      throw error;
    }
  };

  // Acción: Logout
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
      logout,
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ===== Hook =====
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return ctx;
};