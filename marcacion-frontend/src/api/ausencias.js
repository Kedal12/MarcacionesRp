import api from "./axios"; // Asegúrate que tu instancia de axios esté aquí
import dayjs from "dayjs"; // Para formatear fechas

/**
 * Crea una nueva solicitud de ausencia (Empleado).
 * @param {object} dto - Datos de la ausencia.
 * @param {string} dto.tipo - Tipo de ausencia ("vacaciones", "enfermedad", etc.).
 * @param {DateOnly|dayjs|string} dto.desde - Fecha de inicio.
 * @param {DateOnly|dayjs|string} dto.hasta - Fecha de fin.
 * @param {string} [dto.observacion] - Motivo opcional.
 * @returns {Promise<object>} - Promesa con la ausencia creada.
 */
export const crearAusencia = async (dto) => {
  // Formatea fechas a YYYY-MM-DD antes de enviar
  const payload = {
    ...dto,
    desde: dayjs(dto.desde).format("YYYY-MM-DD"),
    hasta: dayjs(dto.hasta).format("YYYY-MM-DD"),
  };
  const { data } = await api.post("/api/ausencias", payload);
  return data;
};

/**
 * Lista las ausencias según filtros (Admin).
 * @param {object} filtro - Filtros opcionales.
 * @param {number} [filtro.idUsuario]
 * @param {number} [filtro.idSede]
 * @param {DateOnly|dayjs|string} [filtro.desde] - Rango para buscar solapamientos.
 * @param {DateOnly|dayjs|string} [filtro.hasta]
 * @param {string} [filtro.estado] - "pendiente", "aprobada", "rechazada".
 * @returns {Promise<Array<object>>} - Promesa con la lista de ausencias (AusenciaListadoDto).
 */
export const listarAusencias = async (filtro = {}) => {
  // Formatea fechas del filtro si existen
  const params = { ...filtro };
  if (filtro.desde) {
    params.desde = dayjs(filtro.desde).format("YYYY-MM-DD");
  }
  if (filtro.hasta) {
    params.hasta = dayjs(filtro.hasta).format("YYYY-MM-DD");
  }
  // Asegúrate de que los IDs numéricos sean válidos o no se envíen
  if(isNaN(parseInt(params.idUsuario)) || params.idUsuario <= 0) delete params.idUsuario;
  if(isNaN(parseInt(params.idSede)) || params.idSede <= 0) delete params.idSede;


  const { data } = await api.get("/api/ausencias", { params });
  // El backend devuelve AusenciaListadoDto:
  // [{ id, idUsuario, nombreUsuario, tipo, desde, hasta, observacion, estado, createdAt, nombreAprobador }]
  return data;
};

/**
 * Obtiene las ausencias del usuario actualmente logueado (Empleado).
 * Llama a listarAusencias filtrando por el ID del usuario (requiere obtenerlo).
 * @param {number} idUsuarioLogueado - El ID del usuario que está consultando.
 * @returns {Promise<Array<object>>} - Promesa con la lista de ausencias del usuario (AusenciaListadoDto).
 */
export const getMisAusencias = async (idUsuarioLogueado) => {
    // Reutiliza listarAusencias filtrando por el ID del usuario logueado.
    // Asume que el backend permite a un usuario normal llamar a GET /api/ausencias
    // si incluye su propio idUsuario en el filtro, o que ProtectedRoute lo maneja.
    // Si no, necesitarías un endpoint dedicado como /api/ausencias/mias.
    if (!idUsuarioLogueado || isNaN(parseInt(idUsuarioLogueado))) {
         console.warn("getMisAusencias requiere un idUsuarioLogueado válido.");
         return Promise.resolve([]); // Devuelve vacío si no hay ID
    }
    const data = await listarAusencias({ idUsuario: idUsuarioLogueado });
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
 * Elimina una solicitud de ausencia (Admin o Empleado para sus pendientes/rechazadas).
 * @param {number} id - ID de la ausencia a eliminar.
 * @returns {Promise<void>}
 */
export const borrarAusencia = async (id) => {
    await api.delete(`/api/ausencias/${id}`);
};
