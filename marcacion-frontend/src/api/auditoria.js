    import api from "./axios";
    import dayjs from "dayjs";

    /**
     * Obtiene los registros de auditoría con filtros y paginación.
     * @param {object} filtro - Filtros opcionales.
     * @param {number} [filtro.idUsuarioAdmin]
     * @param {string} [filtro.accion]
     * @param {string} [filtro.entidad]
     * @param {number} [filtro.entidadId]
     * @param {Date|dayjs|string} [filtro.desde]
     * @param {Date|dayjs|string} [filtro.hasta]
     * @param {number} [filtro.page]
     * @param {number} [filtro.pageSize]
     * @returns {Promise<object>} - Promesa con la respuesta paginada { items: [], total, page, pageSize }.
     */
    export const getAuditorias = async (filtro = {}) => {
      // Clona y limpia filtros antes de enviar
      const params = { ...filtro };

      // Formatea fechas si existen
      if (params.desde) {
        params.desde = dayjs(params.desde).startOf('day').toISOString(); // Envía ISO (DateTimeOffset)
      }
      if (params.hasta) {
        params.hasta = dayjs(params.hasta).endOf('day').toISOString();
      }
      // Limpia valores vacíos o inválidos
      if (!params.idUsuarioAdmin || isNaN(parseInt(params.idUsuarioAdmin))) delete params.idUsuarioAdmin;
      if (!params.accion) delete params.accion;
      if (!params.entidad) delete params.entidad;
      if (!params.entidadId || isNaN(parseInt(params.entidadId))) delete params.entidadId;
      if (!params.page || isNaN(parseInt(params.page))) delete params.page;
      if (!params.pageSize || isNaN(parseInt(params.pageSize))) delete params.pageSize;


      const { data } = await api.get("/api/auditoria", { params });
      // Backend devuelve PagedResponse<AuditoriaListadoDto>
      return data;
    };