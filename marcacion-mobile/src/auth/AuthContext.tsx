import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { login as apiLogin, me as apiMe } from '@/src/api/auth';

// ❌ ELIMINAMOS ESTA IMPORTACIÓN QUE CAUSABA EL ERROR (porque usaba SecureStore directo)
// import { getToken, removeToken, storeToken } from '@/src/api/axios';

// ✅ IMPORTAMOS TU NUEVA UTILIDAD (Asegúrate de que la ruta sea correcta)
import { tokenCache } from '@/src/utils/tokenStorage';

// Definimos una clave constante para guardar el token
const TOKEN_KEY = 'auth-token';

// ===== Tipos =====
interface UserData {
  id: string | number;
  email: string;
  rol: 'admin' | 'empleado' | string;
  nombreCompleto: string;
  idSede?: number;
  sedeNombre?: string;
}

interface AuthContextType {
  token: string | null;
  user: UserData | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
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
        // ✅ CAMBIO: Usamos tokenCache en lugar de getToken()
        const userToken = await tokenCache.getToken(TOKEN_KEY);
        
        if (userToken) {
          console.log('[Auth] Token encontrado, validando con /me...');
          // Nota: Aquí asumimos que apiMe usa axios y el interceptor inyectará el token.
          // (Ver nota al final sobre axios)
          const userData = await apiMe(); 
          setAuthState({ token: userToken, user: userData, isLoading: false });
          console.log('[Auth] Usuario cargado:', userData.email);
        } else {
          console.log('[Auth] No se encontró token');
          setAuthState({ token: null, user: null, isLoading: false });
        }
      } catch (e: any) {
        console.error('[Auth] Error en bootstrap:', e?.message ?? e);
        // ✅ CAMBIO: Usamos tokenCache
        await tokenCache.deleteToken(TOKEN_KEY);
        setAuthState({ token: null, user: null, isLoading: false });
      }
    };
    bootstrapAsync();
  }, []);

  // Acción: Login
  const login = async (email: string, password: string): Promise<boolean> => {
    setAuthState((s) => ({ ...s, isLoading: true, user: null }));
    try {
      const { token } = await apiLogin(email, password);
      if (!token) {
        throw new Error('No se recibió token del servidor.');
      }

      // ✅ CAMBIO: Guardamos usando la utilidad compatible con Web/Móvil
      await tokenCache.saveToken(TOKEN_KEY, token);

      // Carga datos del usuario
      const userData = await apiMe();

      setAuthState({ token, user: userData, isLoading: false });
      return true;
    } catch (error: any) {
      console.error('[Auth] Error en login:', error?.message ?? error);
      // ✅ CAMBIO: Borrado seguro
      await tokenCache.deleteToken(TOKEN_KEY);
      setAuthState({ token: null, user: null, isLoading: false });
      throw error;
    }
  };

  // Acción: Logout
  const logout = async (): Promise<void> => {
    setAuthState((s) => ({ ...s, isLoading: true }));
    try {
      // ✅ CAMBIO: Borrado seguro
      await tokenCache.deleteToken(TOKEN_KEY);
      setAuthState({ token: null, user: null, isLoading: false });
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
      login,
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