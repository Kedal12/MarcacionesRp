// src/hooks/useFeriados.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { queryKeys } from '../config/queryClient';
import {
  getFeriados,
  createOrUpdateFeriado,
  deleteFeriado,
} from '../api/feriados';

/**
 * Hook para obtener lista de feriados
 * @param {number} year - Año opcional para filtrar
 * @returns {object} Query con data, isLoading, error, refetch
 */
export function useFeriados(year) {
  return useQuery({
    queryKey: queryKeys.feriados.list({ year }),
    queryFn: () => getFeriados(year),
    staleTime: 30 * 60 * 1000, // 30 minutos - feriados no cambian frecuentemente
    cacheTime: 60 * 60 * 1000, // 1 hora en caché
  });
}

/**
 * Hook para crear o actualizar un feriado
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useCrearOActualizarFeriado() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({ fecha, dto }) => createOrUpdateFeriado(fecha, dto),
    
    onSuccess: () => {
      enqueueSnackbar('Feriado guardado', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.feriados.all });
    },

    onError: (error) => {
      const message = error?.response?.data || 'Error al guardar feriado';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para eliminar un feriado
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useEliminarFeriado() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: deleteFeriado,
    
    onMutate: async (fecha) => {
      // Cancelar queries pendientes
      await queryClient.cancelQueries({ queryKey: queryKeys.feriados.all });

      // Snapshot del estado anterior
      const previousFeriados = queryClient.getQueryData(queryKeys.feriados.all);

      // Optimistic update - remover del caché
      queryClient.setQueriesData({ queryKey: queryKeys.feriados.all }, (old) => {
        if (!old) return old;
        return old.filter((f) => f.fecha !== fecha);
      });

      return { previousFeriados };
    },

    onError: (error, variables, context) => {
      // Rollback en caso de error
      if (context?.previousFeriados) {
        queryClient.setQueryData(queryKeys.feriados.all, context.previousFeriados);
      }
      
      const message = error?.response?.data || 'Error al eliminar feriado';
      enqueueSnackbar(message, { variant: 'error' });
    },

    onSuccess: () => {
      enqueueSnackbar('Feriado eliminado', { variant: 'success' });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feriados.all });
    },
  });
}
