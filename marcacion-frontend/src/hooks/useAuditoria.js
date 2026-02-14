// src/hooks/useAuditoria.js
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { getAuditorias } from '../api/auditoria';

/**
 * Hook para obtener registros de auditoría
 * @param {object} filtro - Filtros opcionales
 * @param {number} filtro.idUsuarioAdmin - ID del admin
 * @param {string} filtro.accion - Acción realizada
 * @param {string} filtro.entidad - Entidad afectada
 * @param {number} filtro.entidadId - ID de la entidad
 * @param {string} filtro.desde - Fecha desde
 * @param {string} filtro.hasta - Fecha hasta
 * @param {number} filtro.page - Página actual
 * @param {number} filtro.pageSize - Elementos por página
 * @returns {object} Query con data, isLoading, error, refetch
 */
export function useAuditorias(filtro = {}) {
  const cleanFiltro = { ...filtro };

  // Limpiar parámetros vacíos
  Object.keys(cleanFiltro).forEach(key => {
    if (cleanFiltro[key] === '' || cleanFiltro[key] === null || cleanFiltro[key] === undefined) {
      delete cleanFiltro[key];
    }
  });

  return useQuery({
    queryKey: queryKeys.auditoria.list(cleanFiltro),
    queryFn: () => getAuditorias(cleanFiltro),
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000,
    keepPreviousData: true,
    // Los registros de auditoría son de solo lectura, podemos cachearlos más tiempo
  });
}

/**
 * Hook para obtener auditorías con paginación automática
 * @param {object} params - Parámetros de filtro y paginación
 * @returns {object} Query con data paginada, isLoading, error, refetch
 */
export function useAuditoriasPaginadas(params = {}) {
  const { page = 1, pageSize = 20, ...filters } = params;

  return useAuditorias({
    ...filters,
    page,
    pageSize,
  });
}
