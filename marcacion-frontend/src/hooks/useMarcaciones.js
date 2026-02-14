// src/hooks/useMarcaciones.js
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { getMarcaciones } from '../api/marcaciones';

export function useMarcaciones(params = {}) {
  // Clonamos y limpiamos parámetros para evitar enviar strings vacíos o nulos al API
  const cleanParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return useQuery({
    queryKey: queryKeys.marcaciones.list(cleanParams),
    queryFn: () => getMarcaciones(cleanParams),
    staleTime: 1 * 60 * 1000, 
    // En versiones nuevas de TanStack Query se usa placeholderData
    placeholderData: (previousData) => previousData,
    enabled: true 
  });
}