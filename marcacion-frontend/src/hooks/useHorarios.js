// src/hooks/useHorarios.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { queryKeys } from '../config/queryClient';
import {
  getHorarios,
  getHorario,
  crearHorario,
  actualizarHorario,
  upsertDetalles,
  eliminarHorario,
  getAsignacionesByUsuario,
  asignarHorario,
  eliminarAsignacion,
} from '../api/horarios';

/**
 * Hook para obtener lista de horarios
 * @returns {object} Query con data, isLoading, error, refetch
 */
export function useHorarios() {
  return useQuery({
    queryKey: queryKeys.horarios.all,
    queryFn: getHorarios,
    staleTime: 10 * 60 * 1000, // 10 minutos
    cacheTime: 15 * 60 * 1000,
  });
}

/**
 * Hook para obtener un horario específico
 * @param {number} id - ID del horario
 * @param {boolean} enabled - Si la query está habilitada
 * @returns {object} Query con data, isLoading, error
 */
export function useHorario(id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.horarios.detail(id),
    queryFn: () => getHorario(id),
    staleTime: 5 * 60 * 1000,
    enabled: enabled && !!id,
  });
}

/**
 * Hook para obtener asignaciones de un usuario
 * @param {number} idUsuario - ID del usuario
 * @returns {object} Query con asignaciones
 */
export function useAsignacionesUsuario(idUsuario) {
  return useQuery({
    queryKey: queryKeys.asignaciones.list({ idUsuario }),
    queryFn: () => getAsignacionesByUsuario(idUsuario),
    staleTime: 5 * 60 * 1000,
    enabled: !!idUsuario,
  });
}

/**
 * Hook para crear un horario
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useCrearHorario() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: crearHorario,
    
    onSuccess: () => {
      enqueueSnackbar('Horario creado', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.horarios.all });
    },

    onError: (error) => {
      const message = error?.response?.data || 'Error al crear horario';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para actualizar un horario
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useActualizarHorario() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, dto }) => actualizarHorario(id, dto),
    
    onSuccess: (data, variables) => {
      enqueueSnackbar('Horario actualizado', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.horarios.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.horarios.detail(variables.id) });
    },

    onError: (error) => {
      const message = error?.response?.data || 'Error al actualizar';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para actualizar detalles de horario
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useUpsertDetalles() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, detalles }) => upsertDetalles(id, detalles),
    
    onSuccess: (data, variables) => {
      enqueueSnackbar('Detalles actualizados', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.horarios.detail(variables.id) });
    },

    onError: (error) => {
      const message = error?.response?.data || 'Error al actualizar detalles';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para eliminar un horario
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useEliminarHorario() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: eliminarHorario,
    
    onSuccess: () => {
      enqueueSnackbar('Horario eliminado', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.horarios.all });
    },

    onError: (error) => {
      const message = error?.response?.data || 'Error al eliminar';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para asignar horario a usuario
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useAsignarHorario() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: asignarHorario,
    
    onSuccess: () => {
      enqueueSnackbar('Horario asignado', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.asignaciones.all });
    },

    onError: (error) => {
      const message = error?.response?.data || 'Error al asignar horario';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

/**
 * Hook para eliminar una asignación
 * @returns {object} Mutation con mutate, mutateAsync, isLoading, error
 */
export function useEliminarAsignacion() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: eliminarAsignacion,
    
    onSuccess: () => {
      enqueueSnackbar('Asignación eliminada', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.asignaciones.all });
    },

    onError: (error) => {
      const message = error?.response?.data || 'Error al eliminar asignación';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}
