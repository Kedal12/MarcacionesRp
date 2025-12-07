import api from "./axios"; // Asegúrate que tu instancia de axios esté aquí

/**
 * Obtiene el reporte de horas trabajadas.
 * @param {object} params - Los parámetros de filtro.
 * @param {number} [params.idUsuario] - ID del usuario (opcional).
 * @param {number} [params.idSede] - ID de la sede (opcional).
 * @param {string} [params.desde] - Fecha 'desde' en formato ISO UTC (start of day).
 * @param {string} [params.hasta] - Fecha 'hasta' en formato ISO UTC (end of day).
 * @returns {Promise<Array<object>>} - Promesa con el array de resultados del reporte.
 */
export const getHoras = async (params) => {
  // Limpia parámetros vacíos o inválidos antes de enviar
  const cleanParams = {};
  if (params.idUsuario && !isNaN(parseInt(params.idUsuario))) {
    cleanParams.idUsuario = parseInt(params.idUsuario);
  }
  if (params.idSede && !isNaN(parseInt(params.idSede))) {
    cleanParams.idSede = parseInt(params.idSede);
  }
  if (params.desde) {
    cleanParams.desde = params.desde;
  }
  if (params.hasta) {
    cleanParams.hasta = params.hasta;
  }

  const { data } = await api.get("/api/reportes/horas", { params: cleanParams });
  return data; // El backend ya devuelve el array de resultados
};
