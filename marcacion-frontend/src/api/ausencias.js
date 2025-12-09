import api from "./axios";
import dayjs from "dayjs";

/**
 * Crea una nueva solicitud de ausencia.
 * @param {object} dto - Datos de la ausencia.
 * @param {number} [dto.idUsuario] - ID del usuario (opcional, para admins creando para otros).
 * @param {string} dto.tipo - Tipo de ausencia ("vacaciones", "enfermedad", etc.).
 * @param {DateOnly|dayjs|string} dto.desde - Fecha de inicio.
 * @param {DateOnly|dayjs|string} dto.hasta - Fecha de fin.
 * @param {string} [dto.observacion] - Motivo opcional.
 * @returns {Promise<object>} - Promesa con la ausencia creada.
 */
export const crearAusencia = async (dto) => {
  const payload = {
    tipo: dto.tipo,
    desde: dayjs(dto.desde).format("YYYY-MM-DD"),
    hasta: dayjs(dto.hasta).format("YYYY-MM-DD"),
    observacion: dto.observacion,
  };

  // ✅ NUEVO: Si se especifica un usuario, incluirlo en el payload
  if (dto.idUsuario && dto.idUsuario > 0) {
    payload.idUsuario = dto.idUsuario;
  }

  const { data } = await api.post("/api/ausencias", payload);
  return data;
};

/**
 * Lista las ausencias según filtros (Admin).
 * @param {object} filtro - Filtros opcionales.
 * @param {number} [filtro.idUsuario]
 * @param {number} [filtro.idSede]
 * @param {DateOnly|dayjs|string} [filtro.desde]
 * @param {DateOnly|dayjs|string} [filtro.hasta]
 * @param {string} [filtro.estado] - "pendiente", "aprobada", "rechazada".
 * @returns {Promise<Array<object>>} - Promesa con la lista de ausencias.
 */
export const listarAusencias = async (filtro = {}) => {
  const params = { ...filtro };
  if (filtro.desde) {
    params.desde = dayjs(filtro.desde).format("YYYY-MM-DD");
  }
  if (filtro.hasta) {
    params.hasta = dayjs(filtro.hasta).format("YYYY-MM-DD");
  }
  if (isNaN(parseInt(params.idUsuario)) || params.idUsuario <= 0) delete params.idUsuario;
  if (isNaN(parseInt(params.idSede)) || params.idSede <= 0) delete params.idSede;

  const { data } = await api.get("/api/ausencias", { params });
  return data;
};

/**
 * Obtiene las ausencias del usuario actualmente logueado.
 * @param {number} idUsuarioLogueado - El ID del usuario que está consultando.
 * @returns {Promise<Array<object>>} - Promesa con la lista de ausencias del usuario.
 */
export const getMisAusencias = async (idUsuarioLogueado) => {
  if (!idUsuarioLogueado || isNaN(parseInt(idUsuarioLogueado))) {
    console.warn("getMisAusencias requiere un idUsuarioLogueado válido.");
    return Promise.resolve([]);
  }
  const data = await listarAusencias({ idUsuario: idUsuarioLogueado });
  return data;
};

/**
 * ✅ NUEVO: Obtiene la lista de usuarios de la sede del admin (para el selector).
 * @returns {Promise<Array<{id: number, nombreCompleto: string, numeroDocumento: string}>>}
 */
export const getUsuariosSede = async () => {
  const { data } = await api.get("/api/ausencias/usuarios-sede");
  return data;
};

/**
 * Aprueba una solicitud de ausencia (Admin).
 * @param {number} id - ID de la ausencia.
 * @returns {Promise<void>}
 */
export const aprobarAusencia = async (id) => {
  await api.put(`/api/ausencias/${id}/aprobar`);
};

/**
 * Rechaza una solicitud de ausencia (Admin).
 * @param {number} id - ID de la ausencia.
 * @returns {Promise<void>}
 */
export const rechazarAusencia = async (id) => {
  await api.put(`/api/ausencias/${id}/rechazar`);
};

/**
 * Elimina una solicitud de ausencia.
 * @param {number} id - ID de la ausencia a eliminar.
 * @returns {Promise<void>}
 */
export const borrarAusencia = async (id) => {
  await api.delete(`/api/ausencias/${id}`);
};