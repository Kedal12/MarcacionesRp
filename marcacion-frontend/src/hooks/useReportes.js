// src/hooks/useReportes.js
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { queryKeys } from '../config/queryClient';
import { getHoras, descargarExcelAsistencia } from '../api/reportes';

/**
 * Hook para obtener reporte de horas
 * @param {object} params - Parámetros de filtro
 * @param {string} params.numeroDocumento - Número de documento
 * @param {number} params.idSede - ID de la sede
 * @param {string} params.desde - Fecha desde
 * @param {string} params.hasta - Fecha hasta
 * @returns {object} Query con data, isLoading, error, refetch
 */
export function useReporteHoras(params = {}) {
  const cleanParams = { ...params };

  // Limpiar parámetros vacíos
  Object.keys(cleanParams).forEach(key => {
    if (cleanParams[key] === '' || cleanParams[key] === null || cleanParams[key] === undefined) {
      delete cleanParams[key];
    }
  });

  return useQuery({
    queryKey: queryKeys.reportes.horas(cleanParams),
    queryFn: () => getHoras(cleanParams),
    staleTime: 2 * 60 * 1000, // 2 minutos
    cacheTime: 5 * 60 * 1000,
    keepPreviousData: true,
    // Solo ejecutar si hay filtros mínimos
    enabled: !!(cleanParams.desde && cleanParams.hasta),
  });
}

/**
 * Hook para descargar reporte de asistencia en Excel
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useDescargarExcel() {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: descargarExcelAsistencia,
    
    onSuccess: (response, variables) => {
      // Crear blob y descargar archivo
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Nombre del archivo con fecha
      const filename = `reporte_asistencia_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      enqueueSnackbar('Reporte descargado exitosamente', { variant: 'success' });
    },

    onError: (error) => {
      console.error('Error descargando Excel:', error);
      const message = error?.response?.data || 'Error al descargar el reporte';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook combinado para gestión de reportes
 * @param {object} params - Parámetros de filtro
 * @returns {object} Todas las operaciones disponibles
 */
export function useGestionReportes(params = {}) {
  const reporteQuery = useReporteHoras(params);
  const descargarMutation = useDescargarExcel();

  return {
    // Query data
    reporte: reporteQuery.data || [],
    isLoading: reporteQuery.isLoading,
    error: reporteQuery.error,
    refetch: reporteQuery.refetch,
    
    // Mutations
    descargar: descargarMutation.mutate,
    descargarAsync: descargarMutation.mutateAsync,
    isDownloading: descargarMutation.isLoading,
  };
}
