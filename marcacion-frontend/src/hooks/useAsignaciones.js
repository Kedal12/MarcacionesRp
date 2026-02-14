import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
// Importamos con los nombres exactos de tu archivo api/horarios.js
import { getAsignacionesByUsuario, asignarHorario, eliminarAsignacion } from '../api/horarios';

export function useAsignaciones(userId) {
  return useQuery({
    queryKey: ['asignaciones', userId],
    queryFn: () => getAsignacionesByUsuario(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAsignacionMutation() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: asignarHorario,
    onSuccess: (_, variables) => {
      enqueueSnackbar('Horario asignado con éxito', { variant: 'success' });
      // El parámetro en tu API se llama idUsuario
      queryClient.invalidateQueries(['asignaciones', variables.idUsuario]);
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data || 'Error al asignar horario', { variant: 'error' });
    }
  });
}

export function useEliminarAsignacionMutation() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: eliminarAsignacion,
    onSuccess: () => {
      enqueueSnackbar('Asignación eliminada', { variant: 'success' });
      queryClient.invalidateQueries(['asignaciones']);
    },
    onError: () => {
      enqueueSnackbar('Error al eliminar asignación', { variant: 'error' });
    }
  });
}