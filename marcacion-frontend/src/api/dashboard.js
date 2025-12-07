    import api from "./axios";
    import dayjs from "dayjs";

    /**
     * Obtiene las métricas del dashboard para una fecha y sede específicas.
     * @param {object} params - Parámetros de filtro.
     * @param {DateOnly|dayjs|string} params.date - Fecha para las métricas (se enviará como YYYY-MM-DD).
     * @param {number} [params.idSede] - ID de la sede (opcional).
     * @returns {Promise<object>} - Promesa con el objeto DashboardMetricsResponseDto.
     */
    export const getDashboardMetrics = async ({ date, idSede }) => {
      if (!date) {
        // Requiere una fecha
        throw new Error("La fecha es requerida para obtener métricas.");
      }
      const queryParams = {
        date: dayjs(date).format("YYYY-MM-DD"), // Formato esperado por DateOnly en backend
      };
      if (idSede && !isNaN(parseInt(idSede)) && idSede > 0) {
        queryParams.idSede = parseInt(idSede);
      }

      const { data } = await api.get("/api/dashboard/metrics", { params: queryParams });
      // El backend devuelve DashboardMetricsResponseDto:
      // { presentes, ausentes, tarde, sinSalida, marcacionesHoy, topTardanzas: [] }
      return data;
    };
    
