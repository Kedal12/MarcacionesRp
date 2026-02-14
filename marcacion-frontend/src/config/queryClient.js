// src/config/queryClient.js
import { QueryClient } from '@tanstack/react-query';

/**
 * Configuración centralizada de React Query
 * Optimizado para reducir llamadas innecesarias y mejorar performance
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000, // Antes era cacheTime (deprecated en v5)
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnMount: 'always', // Siempre refetch al montar si está stale
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * ✅ Query Keys UNIFICADAS - Usar SIEMPRE estas keys
 * IMPORTANTE: No hardcodear arrays de strings en los hooks
 */
export const queryKeys = {
  // ═══════════════════════════════════════════════════════════════
  // CORRECCIONES
  // ═══════════════════════════════════════════════════════════════
  correcciones: {
    all: ['correcciones'],
    lists: () => [...queryKeys.correcciones.all, 'list'],
    list: (filters) => [...queryKeys.correcciones.lists(), filters],
    // ✅ Key única para "mis correcciones" - NO CAMBIAR
    mis: () => ['correcciones', 'mis'],
    detail: (id) => [...queryKeys.correcciones.all, 'detail', id],
  },

  // ═══════════════════════════════════════════════════════════════
  // AUSENCIAS
  // ═══════════════════════════════════════════════════════════════
  ausencias: {
    all: ['ausencias'],
    lists: () => [...queryKeys.ausencias.all, 'list'],
    list: (filters) => [...queryKeys.ausencias.lists(), filters],
    // ✅ Key única para "mis ausencias" - NO CAMBIAR
    mis: () => ['ausencias', 'mis'],
    detail: (id) => [...queryKeys.ausencias.all, 'detail', id],
  },

  // ═══════════════════════════════════════════════════════════════
  // USUARIOS
  // ═══════════════════════════════════════════════════════════════
  usuarios: {
    all: ['usuarios'],
    lists: () => [...queryKeys.usuarios.all, 'list'],
    list: (filters) => [...queryKeys.usuarios.lists(), filters],
    detail: (id) => [...queryKeys.usuarios.all, 'detail', id],
    sede: () => ['usuarios', 'sede'], // Usuarios de la sede del admin
  },

  // ═══════════════════════════════════════════════════════════════
  // MARCACIONES
  // ═══════════════════════════════════════════════════════════════
  marcaciones: {
    all: ['marcaciones'],
    lists: () => [...queryKeys.marcaciones.all, 'list'],
    list: (filters) => [...queryKeys.marcaciones.lists(), filters],
    detail: (id) => [...queryKeys.marcaciones.all, 'detail', id],
  },

  // ═══════════════════════════════════════════════════════════════
  // SEDES
  // ═══════════════════════════════════════════════════════════════
  sedes: {
    all: ['sedes'],
    lists: () => [...queryKeys.sedes.all, 'list'],
    list: (filters) => [...queryKeys.sedes.lists(), filters],
    detail: (id) => [...queryKeys.sedes.all, 'detail', id],
  },

  // ═══════════════════════════════════════════════════════════════
  // HORARIOS
  // ═══════════════════════════════════════════════════════════════
  horarios: {
    all: ['horarios'],
    lists: () => [...queryKeys.horarios.all, 'list'],
    list: (filters) => [...queryKeys.horarios.lists(), filters],
    detail: (id) => [...queryKeys.horarios.all, 'detail', id],
  },

  // ═══════════════════════════════════════════════════════════════
  // FERIADOS
  // ═══════════════════════════════════════════════════════════════
  feriados: {
    all: ['feriados'],
    lists: () => [...queryKeys.feriados.all, 'list'],
    list: (filters) => [...queryKeys.feriados.lists(), filters],
    detail: (id) => [...queryKeys.feriados.all, 'detail', id],
  },

  // ═══════════════════════════════════════════════════════════════
  // ASIGNACIONES
  // ═══════════════════════════════════════════════════════════════
  asignaciones: {
    all: ['asignaciones'],
    lists: () => [...queryKeys.asignaciones.all, 'list'],
    list: (filters) => [...queryKeys.asignaciones.lists(), filters],
  },

  // ═══════════════════════════════════════════════════════════════
  // REPORTES
  // ═══════════════════════════════════════════════════════════════
  reportes: {
    all: ['reportes'],
    horas: (filters) => [...queryKeys.reportes.all, 'horas', filters],
  },

  // ═══════════════════════════════════════════════════════════════
  // AUDITORÍA
  // ═══════════════════════════════════════════════════════════════
  auditoria: {
    all: ['auditoria'],
    lists: () => [...queryKeys.auditoria.all, 'list'],
    list: (filters) => [...queryKeys.auditoria.lists(), filters],
  },
};

/**
 * ✅ Helpers para invalidar queries - Centralizados
 */
export const invalidateQueries = {
  // ─────────────────────────────────────────────────────────────
  // CORRECCIONES
  // ─────────────────────────────────────────────────────────────
  allCorrecciones: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.correcciones.all }),

  misCorrecciones: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.correcciones.mis() }),

  listCorrecciones: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.correcciones.lists() }),

  // ─────────────────────────────────────────────────────────────
  // AUSENCIAS
  // ─────────────────────────────────────────────────────────────
  allAusencias: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.ausencias.all }),

  misAusencias: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.ausencias.mis() }),

  listAusencias: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.ausencias.lists() }),

  // ─────────────────────────────────────────────────────────────
  // USUARIOS
  // ─────────────────────────────────────────────────────────────
  allUsuarios: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all }),

  // ─────────────────────────────────────────────────────────────
  // MARCACIONES
  // ─────────────────────────────────────────────────────────────
  allMarcaciones: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.marcaciones.all }),

  // ─────────────────────────────────────────────────────────────
  // SEDES
  // ─────────────────────────────────────────────────────────────
  allSedes: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.sedes.all }),
};

/**
 * Prefetch helpers para pre-cargar datos
 */
export const prefetchQueries = {
  usuarios: async (fetchFn, filters = {}) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.usuarios.list(filters),
      queryFn: () => fetchFn(filters),
      staleTime: 10 * 60 * 1000,
    });
  },

  sedes: async (fetchFn) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.sedes.all,
      queryFn: fetchFn,
      staleTime: 30 * 60 * 1000,
    });
  },
};
