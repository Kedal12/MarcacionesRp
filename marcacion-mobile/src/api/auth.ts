import api, { storeToken } from './axios';

// --- Interfaces para las respuestas de la API ---
interface LoginResponse {
  token: string;
}

// ✅ NUEVO: Response para login mobile
interface LoginMobileResponse {
  token: string;
  usuario: {
    id: number;
    nombreCompleto: string;
    email: string;
    rol: string;
    numeroDocumento: string;
    sedeNombre: string | null;
  };
}

interface MeResponse {
  id: string | number;
  email: string;
  rol: 'admin' | 'empleado' | string;
  nombreCompleto: string;
  idSede?: number;
  sedeNombre?: string;
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

/**
 * Realiza el login del usuario (web - email + password).
 * @param email - Email del usuario.
 * @param password - Contraseña del usuario.
 * @returns Respuesta con el token JWT.
 */
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const { data } = await api.post<LoginResponse>('/api/auth/login', { email, password });
    
    if (data.token) {
      await storeToken(data.token);
    }
    
    return data;
  } catch (error: any) {
    console.error("Error en login API:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * ✅ NUEVO: Realiza el login móvil solo con número de documento.
 * @param numeroDocumento - Número de documento del empleado.
 * @returns Respuesta con el token JWT y datos del usuario.
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
 * @returns Datos del usuario logueado.
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
 * Registra un nuevo usuario.
 * @param usuarioData - Datos del usuario a registrar.
 * @returns Respuesta con mensaje e id del usuario creado.
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
 * @param currentPassword - Contraseña actual.
 * @param newPassword - Nueva contraseña.
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  try {
    await api.post('/api/auth/change-password', { currentPassword, newPassword });
  } catch (error: any) {
    console.error("Error en changePassword API:", error.response?.data || error.message);
    throw error;
  }
};