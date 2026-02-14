import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { queryKeys } from '../config/queryClient';
import {
  getSedes,
  getSedesAll,
  crearSede,
  actualizarSede,
  actualizarCoordenadas,
  eliminarSede,
} from '../api/sedes';

/**
 * Hook para obtener lista paginada de sedes
 * @param {object} params - Parámetros de paginación y búsqueda
 */
export function useSedes(params = {}) {
  return useQuery({
    queryKey: queryKeys.sedes.list(params),
    queryFn: () => getSedes(params),
    staleTime: 1000 * 60 * 10, // 10 minutos
    cacheTime: 1000 * 60 * 15,
    keepPreviousData: true, // Evita parpadeos al cambiar de página
  });
}

/**
 * Hook para obtener todas las sedes (ideal para Selects/Dropdowns)
 */
export function useSedesAll() {
  return useQuery({
    queryKey: queryKeys.sedes.all,
    queryFn: getSedesAll,
    // Como las sedes son datos maestros que cambian poco, extendemos la validez
    staleTime: 1000 * 60 * 30, // 30 minutos
    cacheTime: 1000 * 60 * 60, // 1 hora en caché
  });
}

/**
 * Hook para crear una nueva sede
 */
export function useCrearSede() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: crearSede,
    onSuccess: () => {
      enqueueSnackbar('Sede creada exitosamente', { variant: 'success' });
      // Invalidamos todas las referencias de sedes para forzar recarga
      queryClient.invalidateQueries({ queryKey: queryKeys.sedes._def });
    },
    onError: (error) => {
      const message = error?.response?.data?.mensaje || 'Error al crear la sede';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para actualizar una sede
 */
export function useActualizarSede() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, dto }) => actualizarSede(id, dto),
    onSuccess: () => {
      enqueueSnackbar('Sede actualizada correctamente', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.sedes._def });
    },
    onError: (error) => {
      const message = error?.response?.data?.mensaje || 'Error al actualizar';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para actualizar coordenadas de una sede
 */
export function useActualizarCoordenadas() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, dto }) => actualizarCoordenadas(id, dto),
    onSuccess: () => {
      enqueueSnackbar('Coordenadas sincronizadas', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.sedes._def });
    },
    onError: (error) => {
      const message = error?.response?.data?.mensaje || 'Error al actualizar coordenadas';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para eliminar una sede
 */
export function useEliminarSede() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: eliminarSede,
    onSuccess: () => {
      enqueueSnackbar('Sede eliminada de forma lógica', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.sedes._def });
    },
    onError: (error) => {
      const message = error?.response?.data?.mensaje || 'Error al eliminar';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}