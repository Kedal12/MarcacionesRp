import api, { storeToken } from './axios';

// ============================================================================
// INTERFACES PARA LAS RESPUESTAS DE LA API
// ============================================================================

interface LoginResponse {
  token: string;
}

interface LoginMobileResponse {
  token: string;
  usuario: {
    id: number;
    nombreCompleto: string;
    email: string;
    rol: string;
    numeroDocumento: string;
    sedeNombre: string | null;
    biometriaHabilitada: boolean;
  };
}

interface MeResponse {
  id: string | number;
  email: string;
  rol: 'admin' | 'empleado' | string;
  nombreCompleto: string;
  idSede?: number;
  sedeNombre?: string;
  biometriaHabilitada: boolean;
}

// ✅ NUEVO: Interfaces para autenticación facial
interface VerificarDocResponse {
  mensaje: string;
  userId: number;
  nombreCompleto: string;
}

interface LoginFacialResponse {
  token: string;
  user: {
    id: number;
    nombreCompleto: string;
    email: string;
    rol: string;
    numeroDocumento: string;
    sedeNombre: string | null;
    biometriaHabilitada: boolean;
  };
  confidence: number;
}

interface RegisterResponse {
  mensaje: string;
  id: number;
}

interface UsuarioData {
  nombreCompleto: string;
  email: string;
  password: string;
  rol?: string;
  idSede?: number;
}

// ============================================================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================================================

/**
 * Realiza el login del usuario (web - email + password).
 */
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const { data } = await api.post<LoginResponse>('/api/auth/login', { email, password });
    if (data.token) await storeToken(data.token);
    return data;
  } catch (error: any) {
    console.error("Error en login API:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * ✅ NUEVO (PASO 1 FACIAL): Verifica si el documento existe y tiene biometría habilitada.
 */
export const verificarDocumento = async (numeroDocumento: string): Promise<VerificarDocResponse> => {
  try {
    const { data } = await api.post<VerificarDocResponse>('/api/auth/verificar-documento', { 
      numeroDocumento: numeroDocumento.trim() 
    });
    return data;
  } catch (error: any) {
    console.error("Error en verificarDocumento API:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * ✅ NUEVO (PASO 2 FACIAL): Login con reconocimiento facial enviando la captura en Base64.
 */
export const loginFacial = async (numeroDocumento: string, fotoBase64: string): Promise<LoginFacialResponse> => {
  try {
    const { data } = await api.post<LoginFacialResponse>('/api/auth/login-facial', { 
      numeroDocumento: numeroDocumento.trim(),
      fotoBase64 
    });
    
    if (data.token) {
      await storeToken(data.token);
    }
    
    return data;
  } catch (error: any) {
    console.error("Error en loginFacial API:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Login móvil tradicional (solo documento/password).
 */
export const loginMobile = async (numeroDocumento: string): Promise<LoginMobileResponse> => {
  try {
    const { data } = await api.post<LoginMobileResponse>('/api/auth/login-mobile', { 
      numeroDocumento: numeroDocumento.trim() 
    });
    
    if (data.token) {
      await storeToken(data.token);
    }
    
    return data;
  } catch (error: any) {
    console.error("Error en loginMobile API:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Obtiene la información del usuario autenticado.
 */
export const me = async (): Promise<MeResponse> => {
  try {
    const { data } = await api.get<MeResponse>('/api/auth/me');
    return data;
  } catch (error: any) {
    console.error("Error en me API:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Registra un nuevo usuario (Desde panel admin).
 */
export const register = async (usuarioData: UsuarioData): Promise<RegisterResponse> => {
  try {
    const { data } = await api.post<RegisterResponse>('/api/auth/register', usuarioData);
    return data;
  } catch (error: any) {
    console.error("Error en register API:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Cambia la contraseña del usuario autenticado.
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  try {
    await api.post('/api/auth/change-password', { currentPassword, newPassword });
  } catch (error: any) {
    console.error("Error en changePassword API:", error.response?.data || error.message);
    throw error;
  }
};