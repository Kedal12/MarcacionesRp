import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, CircularProgress, Box } from "@mui/material";
import { SnackbarProvider } from "notistack";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import theme from "./theme";
import { AuthProvider } from "./auth/AuthContext";
import { queryClient } from "./config/queryClient";

import App from "./App";
import ProtectedRoute from "./auth/ProtectedRoute";

import "leaflet/dist/leaflet.css";

// ✅ Componente de carga
const LoadingFallback = () => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "60vh",
    }}
  >
    <CircularProgress />
  </Box>
);

// ✅ Lazy loading de todas las páginas
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MarcacionesList = lazy(() => import("./pages/MarcacionesList"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Sedes = lazy(() => import("./pages/Sedes"));
const Horarios = lazy(() => import("./pages/Horarios"));
const Feriados = lazy(() => import("./pages/Feriados"));
const MisAusencias = lazy(() => import("./pages/MisAusencias"));
const AusenciasAdmin = lazy(() => import("./pages/AusenciasAdmin"));
const ReporteHoras = lazy(() => import("./pages/ReporteHoras"));
const Asignaciones = lazy(() => import("./pages/Asignaciones"));
const MisCorrecciones = lazy(() => import("./pages/MisCorrecciones"));
const CorreccionesAdmin = lazy(() => import("./pages/CorreccionesAdmin"));
const AuditoriaPage = lazy(() => import("./pages/Auditoria"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          autoHideDuration={2500}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Público */}
                  <Route path="/login" element={<Login />} />

                  {/* Privado */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <App />
                      </ProtectedRoute>
                    }
                  >
                    {/* Comunes */}
                    <Route index element={<Dashboard />} />
                    <Route path="marcaciones" element={<MarcacionesList />} />
                    <Route path="ausencias" element={<MisAusencias />} />
                    <Route path="mis-correcciones" element={<MisCorrecciones />} />

                    {/* Admin + Superadmin */}
                    <Route
                      path="usuarios"
                      element={
                        <ProtectedRoute roles={["admin", "superadmin"]}>
                          <Usuarios />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="asignaciones"
                      element={
                        <ProtectedRoute roles={["admin", "superadmin"]}>
                          <Asignaciones />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="reportes/horas"
                      element={
                        <ProtectedRoute roles={["admin", "superadmin"]}>
                          <ReporteHoras />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="ausenciasadmin"
                      element={
                        <ProtectedRoute roles={["admin", "superadmin"]}>
                          <AusenciasAdmin />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="correcciones-admin"
                      element={
                        <ProtectedRoute roles={["admin", "superadmin"]}>
                          <CorreccionesAdmin />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="horarios"
                      element={
                        <ProtectedRoute roles={["admin", "superadmin"]}>
                          <Horarios />
                        </ProtectedRoute>
                      }
                    />

                    {/* Sólo Superadmin */}
                    <Route
                      path="sedes"
                      element={
                        <ProtectedRoute roles={["superadmin"]}>
                          <Sedes />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="feriados"
                      element={
                        <ProtectedRoute roles={["superadmin"]}>
                          <Feriados />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="auditoria"
                      element={
                        <ProtectedRoute roles={["superadmin"]}>
                          <AuditoriaPage />
                        </ProtectedRoute>
                      }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </SnackbarProvider>
      </ThemeProvider>
      {/* ✅ React Query DevTools - solo visible en desarrollo */}
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>
);
