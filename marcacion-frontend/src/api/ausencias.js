// src/api/ausencias.js
import api from "./axios";
import dayjs from "dayjs";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * API DE AUSENCIAS - Optimizada
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Crea una nueva solicitud de ausencia
 * @param {object} dto - Datos de la ausencia
 * @returns {Promise<object>} - Ausencia creada
 */
export const crearAusencia = async (dto) => {
  const payload = {
    tipo: dto.tipo,
    desde: dayjs(dto.desde).format("YYYY-MM-DD"),
    hasta: dayjs(dto.hasta).format("YYYY-MM-DD"),
    observacion: dto.observacion?.trim() || null,
  };

  // Si admin crea para otro usuario
  if (dto.idUsuario && dto.idUsuario > 0) {
    payload.idUsuario = dto.idUsuario;
  }

  const { data } = await api.post("/api/ausencias", payload);
  return data;
};

/**
 * ✅ NUEVO: Obtiene las ausencias del usuario logueado
 * Usa el endpoint dedicado /mis-solicitudes (requiere agregarlo al backend)
 * @returns {Promise<Array>}
 */
export const getMisAusencias = async () => {
  const { data } = await api.get('/api/ausencias/mis-solicitudes');
  return data;
};

/**
 * Lista ausencias con filtros (Admin)
 * @param {object} filtro - Filtros opcionales
 * @returns {Promise<Array>}
 */
export const listarAusencias = async (filtro = {}) => {
  const params = { ...filtro };
  
  if (filtro.desde) params.desde = dayjs(filtro.desde).format("YYYY-MM-DD");
  if (filtro.hasta) params.hasta = dayjs(filtro.hasta).format("YYYY-MM-DD");
  if (isNaN(parseInt(params.idUsuario)) || params.idUsuario <= 0) delete params.idUsuario;
  if (isNaN(parseInt(params.idSede)) || params.idSede <= 0) delete params.idSede;

  const { data } = await api.get("/api/ausencias", { params });
  return data;
};

/**
 * Obtiene usuarios de la sede del admin (para selector)
 * @returns {Promise<Array<{id, nombreCompleto, numeroDocumento}>>}
 */
export const getUsuariosSede = async () => {
  const { data } = await api.get("/api/ausencias/usuarios-sede");
  return data;
};

/**
 * Aprueba una ausencia (Admin)
 * @param {number} id - ID de la ausencia
 */
export const aprobarAusencia = async (id) => {
  await api.put(`/api/ausencias/${id}/aprobar`);
};

/**
 * Rechaza una ausencia (Admin)
 * @param {number} id - ID de la ausencia
 */
export const rechazarAusencia = async (id) => {
  await api.put(`/api/ausencias/${id}/rechazar`);
};

/**
 * Elimina una ausencia
 * @param {number} id - ID de la ausencia
 */
export const borrarAusencia = async (id) => {
  await api.delete(`/api/ausencias/${id}`);
};
