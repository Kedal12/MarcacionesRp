import api from "./axios"; // Asegúrate que tu instancia de axios esté aquí
import dayjs from "dayjs"; // Para formatear fechas y horas

/**
 * Crea una nueva solicitud de corrección (Empleado).
 * @param {object} dto - Datos de la corrección.
 * @param {DateOnly|dayjs|string} dto.fecha - Fecha de la marcación a corregir.
 * @param {'entrada'|'salida'} dto.tipo - Tipo de marcación.
 * @param {string} dto.horaSolicitada - Hora solicitada en formato "HH:mm" o "HH:mm:ss".
 * @param {string} dto.motivo - Justificación.
 * @returns {Promise<object>} - Promesa con la corrección creada.
 */
export const crearCorreccion = async (dto) => {
  // Formatea fecha a YYYY-MM-DD y hora a HH:mm:ss antes de enviar
  const payload = {
    ...dto,
    fecha: dayjs(dto.fecha).format("YYYY-MM-DD"),
    // Asegura que la hora tenga segundos para TimeSpan en backend
    horaSolicitada: dayjs(dto.horaSolicitada, "HH:mm").format("HH:mm:ss"), // Asume input HH:mm
  };
  const { data } = await api.post("/api/correcciones", payload);
  return data;
};

/**
 * Lista las correcciones según filtros (Admin).
 * @param {object} filtro - Filtros opcionales.
 * @param {number} [filtro.idUsuario]
 * @param {number} [filtro.idSede]
 * @param {DateOnly|dayjs|string} [filtro.desde] - Rango para buscar por Fecha de corrección.
 * @param {DateOnly|dayjs|string} [filtro.hasta]
 * @param {string} [filtro.estado] - "pendiente", "aprobada", "rechazada".
 * @returns {Promise<Array<object>>} - Promesa con la lista de correcciones (CorreccionListadoDto).
 */
export const listarCorrecciones = async (filtro = {}) => {
  // Formatea fechas del filtro si existen
  const params = { ...filtro };
  if (filtro.desde) {
    params.desde = dayjs(filtro.desde).format("YYYY-MM-DD");
  }
  if (filtro.hasta) {
    params.hasta = dayjs(filtro.hasta).format("YYYY-MM-DD");
  }
  // Limpia IDs inválidos
  if(isNaN(parseInt(params.idUsuario)) || params.idUsuario <= 0) delete params.idUsuario;
  if(isNaN(parseInt(params.idSede)) || params.idSede <= 0) delete params.idSede;


  const { data } = await api.get("/api/correcciones", { params });
  // Backend devuelve CorreccionListadoDto:
  // [{ id, idUsuario, nombreUsuario, fecha, tipo, horaSolicitada, motivo, estado, createdAt, nombreRevisor, reviewedAt }]
  return data;
};

/**
 * Obtiene las correcciones del usuario actualmente logueado (Empleado).
 * Llama a listarCorrecciones filtrando por el ID del usuario.
 * @param {number} idUsuarioLogueado - El ID del usuario que está consultando.
 * @returns {Promise<Array<object>>} - Promesa con la lista de correcciones del usuario.
 */
export const getMisCorrecciones = async (idUsuarioLogueado) => {
    if (!idUsuarioLogueado || isNaN(parseInt(idUsuarioLogueado))) {
         console.warn("getMisCorrecciones requiere un idUsuarioLogueado válido.");
         return Promise.resolve([]);
    }
    // Reutiliza listarCorrecciones filtrando por usuario.
    // Asume que el backend permite esto o tienes un endpoint /api/correcciones/mias
    const data = await listarCorrecciones({ idUsuario: idUsuarioLogueado });
    return data;
};

/**
 * Aprueba una solicitud de corrección (Admin).
 * @param {number} id - ID de la corrección.
 * @returns {Promise<void>}
 */
export const aprobarCorreccion = async (id) => {
  await api.put(`/api/correcciones/${id}/aprobar`);
};

/**
 * Rechaza una solicitud de corrección (Admin).
 * @param {number} id - ID de la corrección.
 * @returns {Promise<void>}
 */
export const rechazarCorreccion = async (id) => {
  await api.put(`/api/correcciones/${id}/rechazar`);
};

/**
 * Elimina una solicitud de corrección (Opcional, si implementado en backend).
 * @param {number} id - ID de la corrección a eliminar.
 * @returns {Promise<void>}
 */
export const borrarCorreccion = async (id) => {
    // Asegúrate de tener el endpoint DELETE /api/correcciones/{id} en el backend
    await api.delete(`/api/correcciones/${id}`);
};