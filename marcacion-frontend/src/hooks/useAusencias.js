// src/hooks/useAusencias.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { queryKeys, invalidateQueries } from '../config/queryClient';
import {
  getMisAusencias,
  crearAusencia,
  borrarAusencia,
  listarAusencias,
  aprobarAusencia,
  rechazarAusencia,
  getUsuariosSede,
} from '../api/ausencias';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOOKS DE AUSENCIAS - Optimizados con QueryKeys Consistentes
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * ✅ Hook para obtener MIS ausencias (usuario logueado)
 * Usa queryKeys.ausencias.mis() → ['ausencias', 'mis']
 */
export function useMisAusencias() {
  return useQuery({
    queryKey: queryKeys.ausencias.mis(),
    queryFn: getMisAusencias,
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
}

/**
 * ✅ Hook para listar ausencias (Admin)
 * Usa queryKeys.ausencias.list(filters)
 */
export function useAusencias(filters = {}) {
  return useQuery({
    queryKey: queryKeys.ausencias.list(filters),
    queryFn: () => listarAusencias(filters),
    staleTime: 2 * 60 * 1000,
    enabled: Object.keys(filters).length > 0,
  });
}

/**
 * ✅ Hook para obtener usuarios de la sede (selector admin)
 */
export function useUsuariosSede(enabled = true) {
  return useQuery({
    queryKey: queryKeys.usuarios.sede(),
    queryFn: getUsuariosSede,
    staleTime: 10 * 60 * 1000, // 10 minutos
    enabled,
  });
}

/**
 * ✅ Hook para CREAR ausencia con Optimistic Update
 */
export function useCrearAusencia() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: crearAusencia,

    onMutate: async (newAusencia) => {
      // 1. Cancelar queries en vuelo
      await queryClient.cancelQueries({ queryKey: queryKeys.ausencias.mis() });

      // 2. Snapshot del estado actual
      const previousData = queryClient.getQueryData(queryKeys.ausencias.mis());

      // 3. Optimistic update
      queryClient.setQueryData(queryKeys.ausencias.mis(), (old = []) => {
        const optimisticEntry = {
          id: `temp-${Date.now()}`,
          tipo: newAusencia.tipo,
          desde: newAusencia.desde,
          hasta: newAusencia.hasta,
          observacion: newAusencia.observacion,
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
        queryClient.setQueryData(queryKeys.ausencias.mis(), context.previousData);
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
      invalidateQueries.misAusencias();
      invalidateQueries.listAusencias();
    },
  });
}

/**
 * ✅ Hook para ELIMINAR ausencia con Optimistic Update
 */
export function useBorrarAusencia() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: borrarAusencia,

    onMutate: async (ausenciaId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.ausencias.mis() });

      const previousData = queryClient.getQueryData(queryKeys.ausencias.mis());

      // Remover optimistamente
      queryClient.setQueryData(queryKeys.ausencias.mis(), (old = []) =>
        old.filter((a) => a.id !== ausenciaId)
      );

      return { previousData };
    },

    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.ausencias.mis(), context.previousData);
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
      invalidateQueries.misAusencias();
      invalidateQueries.listAusencias();
    },
  });
}

/**
 * ✅ Hook para APROBAR ausencia (Admin)
 */
export function useAprobarAusencia() {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: aprobarAusencia,

    onSuccess: () => {
      enqueueSnackbar('Ausencia aprobada', { variant: 'success' });
      invalidateQueries.allAusencias();
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
 * ✅ Hook para RECHAZAR ausencia (Admin)
 */
export function useRechazarAusencia() {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: rechazarAusencia,

    onSuccess: () => {
      enqueueSnackbar('Ausencia rechazada', { variant: 'info' });
      invalidateQueries.allAusencias();
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
 * ✅ HOOK COMBINADO - Gestión completa de ausencias del usuario
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function useGestionAusencias() {
  const query = useMisAusencias();
  const crear = useCrearAusencia();
  const borrar = useBorrarAusencia();

  return {
    // Query
    ausencias: query.data || [],
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
