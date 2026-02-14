// src/hooks/useCorrecciones.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { queryKeys, invalidateQueries } from '../config/queryClient';
import {
  getMisCorrecciones,
  crearCorreccion,
  borrarCorreccion,
  listarCorrecciones,
  aprobarCorreccion,
  rechazarCorreccion,
} from '../api/correcciones';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOOKS DE CORRECCIONES - Optimizados con QueryKeys Consistentes
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * ✅ Hook para obtener MIS correcciones (usuario logueado)
 * Usa queryKeys.correcciones.mis() → ['correcciones', 'mis']
 */
export function useMisCorrecciones() {
  return useQuery({
    queryKey: queryKeys.correcciones.mis(),
    queryFn: getMisCorrecciones,
    staleTime: 30 * 1000, // 30 segundos - correcciones pueden cambiar
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
}

/**
 * ✅ Hook para listar correcciones (Admin)
 * Usa queryKeys.correcciones.list(filters)
 */
export function useCorrecciones(filters = {}) {
  return useQuery({
    queryKey: queryKeys.correcciones.list(filters),
    queryFn: () => listarCorrecciones(filters),
    staleTime: 2 * 60 * 1000,
    enabled: Object.keys(filters).length > 0,
  });
}

/**
 * ✅ Hook para CREAR corrección con Optimistic Update
 */
export function useCrearCorreccion() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: crearCorreccion,

    onMutate: async (newCorreccion) => {
      // 1. Cancelar queries en vuelo
      await queryClient.cancelQueries({ queryKey: queryKeys.correcciones.mis() });

      // 2. Snapshot del estado actual
      const previousData = queryClient.getQueryData(queryKeys.correcciones.mis());

      // 3. Optimistic update
      queryClient.setQueryData(queryKeys.correcciones.mis(), (old = []) => {
        const optimisticEntry = {
          id: `temp-${Date.now()}`,
          fecha: newCorreccion.fecha,
          tipo: newCorreccion.tipo,
          horaSolicitada: newCorreccion.horaSolicitada,
          motivo: newCorreccion.motivo,
          estado: 'pendiente',
          createdAt: new Date().toISOString(),
          isOptimistic: true,
        };
        return [optimisticEntry, ...old];
      });

      return { previousData };
    },

    onError: (error, variables, context) => {
      // Rollback en caso de error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.correcciones.mis(), context.previousData);
      }
      enqueueSnackbar(
        error?.response?.data?.message || error?.response?.data || 'Error al crear solicitud',
        { variant: 'error' }
      );
    },

    onSuccess: () => {
      enqueueSnackbar('Solicitud enviada correctamente', { variant: 'success' });
    },

    onSettled: () => {
      // Siempre refrescar datos reales del servidor
      invalidateQueries.misCorrecciones();
      invalidateQueries.listCorrecciones();
    },
  });
}

/**
 * ✅ Hook para ELIMINAR corrección con Optimistic Update
 */
export function useBorrarCorreccion() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: borrarCorreccion,

    onMutate: async (correccionId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.correcciones.mis() });

      const previousData = queryClient.getQueryData(queryKeys.correcciones.mis());

      // Remover optimistamente
      queryClient.setQueryData(queryKeys.correcciones.mis(), (old = []) =>
        old.filter((c) => c.id !== correccionId)
      );

      return { previousData };
    },

    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.correcciones.mis(), context.previousData);
      }
      enqueueSnackbar(
        error?.response?.data || 'Error al eliminar solicitud',
        { variant: 'error' }
      );
    },

    onSuccess: () => {
      enqueueSnackbar('Solicitud eliminada', { variant: 'success' });
    },

    onSettled: () => {
      invalidateQueries.misCorrecciones();
      invalidateQueries.listCorrecciones();
    },
  });
}

/**
 * ✅ Hook para APROBAR corrección (Admin)
 */
export function useAprobarCorreccion() {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: aprobarCorreccion,

    onSuccess: () => {
      enqueueSnackbar('Corrección aprobada', { variant: 'success' });
      invalidateQueries.allCorrecciones();
      invalidateQueries.allMarcaciones();
    },

    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data || 'Error al aprobar',
        { variant: 'error' }
      );
    },
  });
}

/**
 * ✅ Hook para RECHAZAR corrección (Admin)
 */
export function useRechazarCorreccion() {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: rechazarCorreccion,

    onSuccess: () => {
      enqueueSnackbar('Corrección rechazada', { variant: 'info' });
      invalidateQueries.allCorrecciones();
    },

    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data || 'Error al rechazar',
        { variant: 'error' }
      );
    },
  });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ HOOK COMBINADO - Gestión completa de correcciones del usuario
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function useGestionCorrecciones() {
  const query = useMisCorrecciones();
  const crear = useCrearCorreccion();
  const borrar = useBorrarCorreccion();

  return {
    // Query
    correcciones: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,

    // Crear
    crear: crear.mutate,
    crearAsync: crear.mutateAsync,
    isCreating: crear.isPending,

    // Borrar
    borrar: borrar.mutate,
    borrarAsync: borrar.mutateAsync,
    isDeleting: borrar.isPending,
  };
}
