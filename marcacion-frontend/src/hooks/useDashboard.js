import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics } from '../api/dashboard';

/**
 * Hook para obtener métricas del dashboard filtradas por fecha y sede
 * @param {object} params - { date, idSede }
 */
export function useDashboardMetrics(params) {
  const { date, idSede } = params;

  return useQuery({
    // ✅ CLAVE: Incluir idSede en la queryKey para que el filtro funcione al instante
    queryKey: ['dashboard', 'metrics', { date, idSede }], 
    queryFn: () => getDashboardMetrics({ date, idSede }),
    staleTime: 1000 * 60 * 2, // 2 minutos de frescura
    enabled: !!date, // Solo ejecutar si hay una fecha seleccionada
    keepPreviousData: true, // Evita que la pantalla se ponga en blanco al cambiar de sede
  });
}