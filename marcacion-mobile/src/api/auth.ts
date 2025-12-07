import api, { storeToken } from './axios';

// --- Interfaces para las respuestas de la API ---
interface LoginResponse {
  token: string;
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
 * Realiza el login del usuario.
 * @param email - Email del usuario.
 * @param password - Contraseña del usuario.
 * @returns Respuesta con el token JWT.
 */
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const { data } = await api.post<LoginResponse>('/api/auth/login', { email, password });
    
    // Guarda el token en SecureStore
    if (data.token) {
      await storeToken(data.token);
    }
    
    return data; // { token: "..." }
  } catch (error: any) {
    console.error("Error en login API:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Obtiene la información del usuario autenticado.
 * @returns Datos del usuario logueado.
 */
export const me = async (): Promise<MeResponse> => {
  try {
    // El interceptor en axios.js añadirá automáticamente el token
    const { data } = await api.get<MeResponse>('/api/auth/me');
    return data; // { id, email, rol, nombreCompleto, ... }
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
    return data; // { mensaje: "Usuario creado exitosamente.", id: ... }
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