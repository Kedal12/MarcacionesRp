// src/api/marcaciones.ts
import dayjs, { Dayjs } from 'dayjs';
import api from './axios';

// ===================== Tipos / Interfaces =====================

/**
 * Estructura de una marcación devuelta por la API.
 * El backend envía ambos valores: UTC y Local (Bogotá).
 */
export interface Marcacion {
  id: number;
  idUsuario?: number;
  tipo: 'entrada' | 'salida';

  // Tiempos
  fechaHoraUtc: string;      // ISO (UTC) - por si lo necesitas para reportes
  fechaHoraLocal: string;    // ISO con hora local de Bogotá  👈 Úsalo para mostrar

  // Ubicación
  latitud?: number | null;
  longitud?: number | null;

  // Almuerzo
  inicioAlmuerzoUtc?: string | null;
  inicioAlmuerzoLocal?: string | null;  // 👈 Úsalo para mostrar
  finAlmuerzoUtc?: string | null;
  finAlmuerzoLocal?: string | null;     // 👈 Úsalo para mostrar
  tiempoAlmuerzoMinutos?: number | null;

  // (Opcional) datos del usuario si el backend los incluye
  usuario?: {
    id: number;
    nombreCompleto: string;
    email: string;
  };
}

/** Datos necesarios para crear una nueva marcación */
export interface MarcacionCreacionDto {
  tipo: 'entrada' | 'salida';
  latitud: number;
  longitud: number;
}

/** DTO para marcar inicio/fin de almuerzo */
export interface AlmuerzoDto {
  latitud: number;
  longitud: number;
}

/** Filtros para obtener marcaciones del propio usuario */
export interface MarcacionesFiltros {
  // Aceptamos Date / Dayjs / string. Idealmente ya en ISO-UTC si el caller lo prepara.
  desde?: Date | Dayjs | string;
  hasta?: Date | Dayjs | string;
  page?: number;
  pageSize?: number;
}

/** Respuesta paginada { total, items } */
export interface MarcacionesResponse {
  items: Marcacion[];
  total: number;
}

/** Estado del almuerzo (el backend ahora también puede enviar campos Local) */
export interface EstadoAlmuerzo {
  estado: 'sin_entrada' | 'sin_almuerzo' | 'almuerzo_en_curso' | 'almuerzo_completado';
  message: string;

  inicioAlmuerzoUtc?: string | null;
  inicioAlmuerzoLocal?: string | null; // 👈 Úsalo para mostrar

  finAlmuerzoUtc?: string | null;
  finAlmuerzoLocal?: string | null;    // 👈 Úsalo para mostrar

  tiempoAlmuerzoMinutos?: number | null;
}

// ===================== Funciones de la API =====================

/**
 * Crea una nueva marcación (POST /api/marcaciones).
 * El backend devolverá los campos *Local* listos para mostrar.
 */
export const crearMarcacion = async (
  marcacionData: MarcacionCreacionDto
): Promise<Marcacion> => {
  try {
    const { data } = await api.post<Marcacion>('/api/marcaciones', marcacionData);
    return data;
  } catch (error: any) {
    console.error('Error en crearMarcacion API:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Obtiene el historial de marcaciones DEL PROPIO USUARIO (GET /api/marcaciones/mis).
 * Devuelve { total, items } y cada item trae fecha/hora en UTC y Local (Bogotá).
 *
 * Nota: el caller puede pasar `desde` y `hasta` ya preparados (por ejemplo, con
 * nowInBogota().startOf('day').utc().toISOString()).
 */
export const getMisMarcaciones = async (
  filtros: MarcacionesFiltros = {}
): Promise<MarcacionesResponse> => {
  const params: Record<string, string | number> = {};

  if (filtros.desde) {
    params.desde = dayjs(filtros.desde).toISOString();
  }
  if (filtros.hasta) {
    params.hasta = dayjs(filtros.hasta).toISOString();
  }
  if (typeof filtros.page === 'number') {
    params.page = filtros.page;
  }
  if (typeof filtros.pageSize === 'number') {
    params.pageSize = filtros.pageSize;
  }

  try {
    const { data } = await api.get<MarcacionesResponse>('/api/marcaciones/mis', { params });
    return data;
  } catch (error: any) {
    console.error('Error en getMisMarcaciones API:', error.response?.data || error.message);
    throw error;
  }
};

// =================== Funciones para Almuerzo ===================

/** Marca el inicio del almuerzo (POST /api/marcaciones/almuerzo/inicio) */
export const iniciarAlmuerzo = async (almuerzoData: AlmuerzoDto): Promise<any> => {
  try {
    const { data } = await api.post('/api/marcaciones/almuerzo/inicio', almuerzoData);
    return data;
  } catch (error: any) {
    console.error('Error en iniciarAlmuerzo API:', error.response?.data || error.message);
    throw error;
  }
};

/** Marca el fin del almuerzo (POST /api/marcaciones/almuerzo/fin) */
export const finalizarAlmuerzo = async (almuerzoData: AlmuerzoDto): Promise<any> => {
  try {
    const { data } = await api.post('/api/marcaciones/almuerzo/fin', almuerzoData);
    return data;
  } catch (error: any) {
    console.error('Error en finalizarAlmuerzo API:', error.response?.data || error.message);
    throw error;
  }
};

/** Obtiene el estado actual del almuerzo (GET /api/marcaciones/almuerzo/estado) */
export const obtenerEstadoAlmuerzo = async (): Promise<EstadoAlmuerzo> => {
  try {
    const { data } = await api.get<EstadoAlmuerzo>('/api/marcaciones/almuerzo/estado');
    return data;
  } catch (error: any) {
    console.error('Error en obtenerEstadoAlmuerzo API:', error.response?.data || error.message);
    throw error;
  }
};
