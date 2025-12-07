import api from './axios';

// --- INTERFACES (Nuevas y existentes) ---

// Para getHorarios, crearHorario, etc.
export interface Horario {
  id: number;
  nombre: string;
  activo: boolean;
}

// Para getHorario (detalle)
export interface HorarioDetalleCompleto {
  id: number;
  nombre: string;
  activo: boolean;
  detalles: {
    id: number;
    diaSemana: number;
    laborable: boolean;
    horaEntrada: string | null; // "HH:mm:ss"
    horaSalida: string | null; // "HH:mm:ss"
    toleranciaMin: number;
    redondeoMin: number;
    descansoMin: number;
  }[];
}

// Para la nueva función getMisHorariosSemana
export interface HorarioDetalle {
  id: number; // ID del detalle o asignación
  dia: string; // "YYYY-MM-DD"
  desde: string; // "HH:mm:ss"
  hasta: string; // "HH:mm:ss"
  sedeNombre: string | null;
  observacion: string | null;
}

export interface HorariosSemanaResponse {
  items: HorarioDetalle[];
  // Añade otras propiedades de paginación si tu backend las devuelve
}

export interface AsignacionDto {
    idUsuario: number;
    idHorario: number;
    desde: string; // "YYYY-MM-DD"
    hasta: string | null;
}

export interface Asignacion {
    id: number;
    idUsuario: number;
    idHorario: number;
    horario: string; // Nombre del horario
    desde: string; // "YYYY-MM-DD"
    hasta: string | null;
}

// --- FUNCIONES API (Existentes) ---

export async function getHorarios(): Promise<Horario[]> {
  const { data } = await api.get("/api/horarios");
  return data;
}
export async function getHorario(id: number): Promise<HorarioDetalleCompleto> {
  const { data } = await api.get(`/api/horarios/${id}`);
  return data;
}
export async function crearHorario(dto: { nombre: string; activo: boolean }): Promise<Horario> {
  const { data } = await api.post("/api/horarios", dto);
  return data;
}
export async function actualizarHorario(id: number, dto: { nombre: string; activo: boolean }): Promise<void> {
  await api.put(`/api/horarios/${id}`, dto);
}
export async function upsertDetalles(id: number, detalles: any[]): Promise<void> {
  await api.put(`/api/horarios/${id}/detalles`, { detalles });
}
export async function eliminarHorario(id: number): Promise<void> {
  await api.delete(`/api/horarios/${id}`);
}

// Asignaciones
export async function getAsignaciones(idUsuario: number): Promise<Asignacion[]> {
  const { data } = await api.get("/api/asignaciones", { params: { idUsuario }});
  return data;
}
export async function asignarHorario(dto: AsignacionDto): Promise<Asignacion> {
  const { data } = await api.post("/api/asignaciones", dto, { headers: { "Content-Type": "application/json" }});
  return data;
}
export async function eliminarAsignacion(id: number): Promise<void> {
  await api.delete(`/api/asignaciones/${id}`);
}

// --- NUEVA FUNCIÓN API ---

/**
 * Obtiene los horarios asignados (detalles) para un usuario en un rango de fechas.
 * @param params - Objeto con { desdeISO, hastaISO }
 * @returns Promesa con un objeto { items: HorarioDetalle[] }
 */
export const getMisHorariosSemana = async (params: { desdeISO: string; hastaISO: string }): Promise<HorariosSemanaResponse> => {
  try {
    // Asume un endpoint /api/horarios/mis-horarios-semana o similar
    // Si el endpoint es diferente, ajusta la URL
    // Este endpoint debe ser creado en el backend
    const { data } = await api.get('/api/horarios/mis-horarios-semana', { params });
    return data;
  } catch (error: any) {
    console.error("Error en getMisHorariosSemana API:", error.response?.data || error.message);
    throw error;
  }
};