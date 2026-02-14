import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { queryKeys } from '../config/queryClient';
import { getUsuarios, cambiarEstadoUsuario, eliminarUsuario, resetPassword } from '../api/usuarios';

/**
 * Hook para obtener lista de usuarios con filtros y paginación
 * @param {object} params - Parámetros de búsqueda y paginación
 */
export function useUsuarios(params = {}) {
  const { 
    page = 1, 
    pageSize = 20, 
    idSede, 
    search,
    numeroDocumento,
    activo,
    enabled = true 
  } = params;

  // Construcción de filtros para la QueryKey y la API
  const filters = {
    page,
    pageSize,
  };

  if (idSede !== undefined && idSede !== null && idSede !== '') {
    filters.idSede = Number(idSede);
  }

  if (search && search.trim()) {
    filters.search = search.trim();
  }

  if (numeroDocumento && numeroDocumento.trim()) {
    filters.numeroDocumento = numeroDocumento.trim();
  }

  // Manejo de filtro activo (soporta booleanos y strings del Select)
  if (activo !== undefined && activo !== 'all' && activo !== '') {
    filters.activo = activo === 'true' || activo === true;
  }

  return useQuery({
      queryKey: queryKeys.usuarios.list(filters),
      queryFn: () => getUsuarios(filters),
      staleTime: 30000, // Reducir a 30s para ver cambios más rápido
      gcTime: 10 * 60 * 1000, // Reemplaza cacheTime en versiones nuevas de TanStack
      placeholderData: (previousData) => previousData, // Reemplaza keepPreviousData
      enabled,
  });
}

/**
 * Hook con Actualización Optimista para cambiar el estado (Activo/Inactivo)
 * Cambia la UI instantáneamente antes de que la API responda.
 */
export function useUsuariosMutation() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, activo }) => cambiarEstadoUsuario(id, activo),
    
    onMutate: async (updatedUser) => {
      // Cancelamos búsquedas activas para que no sobrescriban el cambio manual
      await queryClient.cancelQueries({ queryKey: queryKeys.usuarios._def });

      // Guardamos el estado previo para hacer rollback en caso de error
      const previousData = queryClient.getQueryData(queryKeys.usuarios._def);

      // Actualizamos el caché de todas las queries de usuarios de forma optimista
      queryClient.setQueriesData({ queryKey: queryKeys.usuarios._def }, (old) => {
        if (!old || !old.items) return old;
        return {
          ...old,
          items: old.items.map((u) =>
            u.id === updatedUser.id ? { ...u, activo: updatedUser.activo } : u
          ),
        };
      });

      return { previousData };
    },

    onError: (err, variables, context) => {
      // Si hay error, revertimos al estado guardado en onMutate
      queryClient.setQueryData(queryKeys.usuarios._def, context.previousData);
      const message = err?.response?.data || 'Error al actualizar estado';
      enqueueSnackbar(message, { variant: 'error' });
    },

    onSettled: () => {
      // Sincronizamos con el servidor al terminar (éxito o error)
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios._def });
    },
  });
}

/**
 * Hook para obtener lista simple de usuarios (para selectores)
 */
export function useUsuariosSimple(options = {}) {
  const { enabled = true, idSede } = options;
  const filters = { page: 1, pageSize: 1000 };
  
  if (idSede !== undefined && idSede !== null && idSede !== '') {
    filters.idSede = Number(idSede);
  }

  return useQuery({
    queryKey: queryKeys.usuarios.list({ simple: true, ...filters }),
    queryFn: () => getUsuarios(filters),
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    enabled,
  });
}

/**
 * Hook para obtener un usuario específico por ID
 */
export function useUsuario(userId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.usuarios.detail(userId),
    queryFn: () => getUsuarios({ page: 1, pageSize: 1 }).then(res => 
      res.items?.find(u => u.id === userId)
    ),
    staleTime: 5 * 60 * 1000,
    enabled: enabled && !!userId,
  });
}

/**
 * Hook para prefetch de usuarios
 * Útil para cargar la siguiente página cuando el usuario pasa el mouse sobre el botón
 */
export function usePrefetchUsuarios() {
  const queryClient = useQueryClient();

  return (filters = {}) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.usuarios.list(filters),
      queryFn: () => getUsuarios(filters),
      staleTime: 10 * 60 * 1000,
    });
  };
}

/**
 * Hook para eliminar usuarios de forma optimista
 */
export function useEliminarUsuario() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: eliminarUsuario,
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.usuarios._def });
      const previousData = queryClient.getQueryData(queryKeys.usuarios._def);

      queryClient.setQueriesData({ queryKey: queryKeys.usuarios._def }, (old) => {
        if (!old || !old.items) return old;
        return {
          ...old,
          items: old.items.filter((u) => u.id !== userId),
          total: old.total - 1
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      enqueueSnackbar('Usuario eliminado correctamente', { variant: 'success' });
    },
    onError: (err, userId, context) => {
      queryClient.setQueryData(queryKeys.usuarios._def, context.previousData);
      enqueueSnackbar('No se pudo eliminar el usuario', { variant: 'error' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios._def });
    },
  });
}

/**
 * Hook para restablecer contraseña
 */
export function useResetPassword() {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    // CAMBIO: Enviamos 'newPassword' para que C# lo reconozca
    mutationFn: ({ id, password }) => resetPassword(id, password), 
    onSuccess: () => {
      enqueueSnackbar('Contraseña restablecida con éxito', { variant: 'success' });
    },
    onError: (err) => {
      // Capturamos el error específico del backend (ej: "Mínimo 6 caracteres")
      const msg = err?.response?.data || 'Error al restablecer contraseña';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  });
}