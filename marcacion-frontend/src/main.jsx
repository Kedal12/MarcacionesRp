// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { SnackbarProvider } from "notistack";
import theme from "./theme";
import { AuthProvider } from "./auth/AuthContext";

import App from "./App";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MarcacionesList from "./pages/MarcacionesList";
import Usuarios from "./pages/Usuarios";
import Sedes from "./pages/Sedes";
import Horarios from "./pages/Horarios";
import Feriados from "./pages/Feriados";
import MisAusencias from "./pages/MisAusencias";
import AusenciasAdmin from "./pages/AusenciasAdmin";
import ReporteHoras from "./pages/ReporteHoras";
import Asignaciones from "./pages/Asignaciones";
import MisCorrecciones from "./pages/MisCorrecciones";
import CorreccionesAdmin from "./pages/CorreccionesAdmin";
import AuditoriaPage from "./pages/Auditoria";
import ProtectedRoute from "./auth/ProtectedRoute";

import "leaflet/dist/leaflet.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={2500}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Público */}
              <Route path="/login" element={<Login />} />

              {/* Privado (requiere sesión) */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <App />
                  </ProtectedRoute>
                }
              >
                {/* Comunes para cualquier usuario logueado */}
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

                {/* Fallback dentro de la app */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>

              {/* Fallback global */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>
);
