// src/api/correcciones.js
import api from "./axios";
import dayjs from "dayjs";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * API DE CORRECCIONES - Optimizada
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Crea una nueva solicitud de corrección
 * @param {object} dto - Datos de la corrección
 * @returns {Promise<object>} - Corrección creada
 */
export const crearCorreccion = async (dto) => {
  const payload = {
    fecha: dayjs(dto.fecha).format("YYYY-MM-DD"),
    tipo: dto.tipo,
    horaSolicitada: dto.horaSolicitada.includes(':') 
      ? (dto.horaSolicitada.split(':').length === 2 ? `${dto.horaSolicitada}:00` : dto.horaSolicitada)
      : dto.horaSolicitada,
    motivo: dto.motivo?.trim() || '',
  };

  // Si admin crea para otro usuario
  if (dto.idUsuario && dto.idUsuario > 0) {
    payload.idUsuario = dto.idUsuario;
  }

  const { data } = await api.post("/api/correcciones", payload);
  return data;
};

/**
 * ✅ Obtiene las correcciones del usuario logueado
 * Usa el endpoint dedicado /mis-solicitudes
 * @returns {Promise<Array>}
 */
export const getMisCorrecciones = async () => {
  const { data } = await api.get('/api/correcciones/mis-solicitudes');
  return data;
};

/**
 * Lista correcciones con filtros (Admin)
 * @param {object} filtro - Filtros opcionales
 * @returns {Promise<Array>}
 */
export const listarCorrecciones = async (filtro = {}) => {
  const params = { ...filtro };
  
  if (filtro.desde) params.desde = dayjs(filtro.desde).format("YYYY-MM-DD");
  if (filtro.hasta) params.hasta = dayjs(filtro.hasta).format("YYYY-MM-DD");
  if (isNaN(parseInt(params.idUsuario)) || params.idUsuario <= 0) delete params.idUsuario;
  if (isNaN(parseInt(params.idSede)) || params.idSede <= 0) delete params.idSede;

  const { data } = await api.get("/api/correcciones", { params });
  return data;
};

/**
 * Aprueba una corrección (Admin/SuperAdmin)
 * @param {number} id - ID de la corrección
 */
export const aprobarCorreccion = async (id) => {
  const { data } = await api.put(`/api/correcciones/${id}/aprobar`);
  return data;
};

/**
 * Rechaza una corrección (Admin/SuperAdmin)
 * @param {number} id - ID de la corrección
 */
export const rechazarCorreccion = async (id) => {
  const { data } = await api.put(`/api/correcciones/${id}/rechazar`);
  return data;
};

/**
 * Elimina una corrección
 * @param {number} id - ID de la corrección
 */
export const borrarCorreccion = async (id) => {
  await api.delete(`/api/correcciones/${id}`);
};
