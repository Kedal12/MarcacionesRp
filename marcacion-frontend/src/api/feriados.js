import api from "./axios"; // Asegúrate que tu instancia de axios esté aquí
import dayjs from "dayjs"; // Necesario para formatear la fecha

/**
 * Obtiene la lista de feriados, opcionalmente filtrados por año.
 * @param {number} [year] - Año opcional para filtrar.
 * @returns {Promise<Array<object>>} - Promesa con el array de feriados [{ fecha, nombre, laborable }].
 */
export const getFeriados = async (year) => {
  const params = year ? { year } : {};
  const { data } = await api.get("/api/feriados", { params });
  return data;
};

/**
 * Crea o actualiza un feriado para una fecha específica.
 * @param {DateOnly|dayjs|string} fecha - La fecha del feriado (se formateará a YYYY-MM-DD).
 * @param {object} dto - Datos del feriado { nombre: string, laborable: boolean }.
 * @returns {Promise<object>} - Promesa con la respuesta de la API.
 */
export const createOrUpdateFeriado = async (fecha, dto) => {
  // Asegura que la fecha esté en formato YYYY-MM-DD para la URL
  const fechaFormateada = dayjs(fecha).format("YYYY-MM-DD");
  const { data } = await api.post(`/api/feriados/${fechaFormateada}`, dto);
  return data;
};

/**
 * Elimina un feriado específico.
 * @param {DateOnly|dayjs|string} fecha - La fecha del feriado a eliminar (se formateará a YYYY-MM-DD).
 * @returns {Promise<void>} - Promesa vacía.
 */
export const deleteFeriado = async (fecha) => {
  const fechaFormateada = dayjs(fecha).format("YYYY-MM-DD");
  await api.delete(`/api/feriados/${fechaFormateada}`);
};