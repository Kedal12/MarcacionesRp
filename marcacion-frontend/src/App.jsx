import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, Button, Container, Stack,
  Box, Avatar, Tooltip, IconButton, Menu, MenuItem, Divider
} from "@mui/material";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth/AuthContext";
import ChangePasswordDialog from "./components/ChangePasswordDialog";
import api from "./api/axios";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  EMPLEADO: "empleado"
};

export default function App() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();

  const role = (user?.rol || "").toLowerCase();
  const isAdmin = role === ROLES.ADMIN;
  const isSuperAdmin = role === ROLES.SUPERADMIN;

  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);
  const handleOpen = (e) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const [openPassDialog, setOpenPassDialog] = useState(false);

  const goLogout = () => {
    handleClose();
    logout();
    nav("/login");
  };

  const handleOpenPassDialog = () => {
    handleClose();
    setOpenPassDialog(true);
  };

  // ✅ Prefetch de datos comunes al cargar la app
  useEffect(() => {
    if (user) {
      // Prefetch sedes (datos estáticos usados en dropdowns)
      queryClient.prefetchQuery({
        queryKey: ['sedes'],
        queryFn: async () => {
          const response = await api.get('/api/sedes');
          return response.data;
        },
        staleTime: 10 * 60 * 1000, // Cache por 10 minutos
      });

      // Prefetch horarios para dropdowns
      queryClient.prefetchQuery({
        queryKey: ['horarios'],
        queryFn: async () => {
          const response = await api.get('/api/horarios');
          return response.data;
        },
        staleTime: 5 * 60 * 1000,
      });

      // Si es admin o superadmin, prefetch usuarios (primera página)
      if (isAdmin || isSuperAdmin) {
        queryClient.prefetchQuery({
          queryKey: ['usuarios', 1, ''],
          queryFn: async () => {
            const response = await api.get('/api/usuarios', {
              params: { page: 1, pageSize: 10 }
            });
            return response.data;
          },
          staleTime: 2 * 60 * 1000,
        });
      }
    }
  }, [user, isAdmin, isSuperAdmin, queryClient]);

  // Estilo para botones del navbar
  const navButtonStyle = (isActive) => ({
    color: "#fff",
    fontWeight: isActive ? 700 : 500,
    backgroundColor: isActive ? "rgba(255, 255, 255, 0.2)" : "transparent",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.15)",
    },
    borderRadius: "8px",
    px: 2,
    py: 0.75,
    fontSize: "0.875rem",
  });

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ 
          background: "linear-gradient(135deg, #cc3625 0%, #e9501e 50%, #fab626 100%)",
          borderBottom: "3px solid rgba(255, 255, 255, 0.2)",
        }}
      >
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: 1 }}>
          {/* Título */}
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 800, 
              letterSpacing: 0.2,
              color: "#fff",
              textShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            Panel Marcación
          </Typography>

          {/* Navegación */}
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {/* --- Botones para TODOS los usuarios logueados --- */}
            <Button
              component={Link}
              to="/"
              sx={navButtonStyle(pathname === "/")}
            >
              Dashboard
            </Button>

            <Button
              component={Link}
              to="/marcaciones"
              sx={navButtonStyle(pathname.startsWith("/marcaciones"))}
            >
              Marcaciones
            </Button>

            <Button
              component={Link}
              to="/ausencias"
              sx={navButtonStyle(pathname.startsWith("/ausencias") && !pathname.includes('admin'))}
            >
              Mis Ausencias
            </Button>

            <Button
              component={Link}
              to="/mis-correcciones"
              sx={navButtonStyle(pathname.startsWith("/mis-correcciones"))}
            >
              Mis Correcciones
            </Button>

            {/* --- Botones para ADMINS DE SEDE y SUPERADMINS --- */}
            {(isAdmin || isSuperAdmin) && (
              <>
                <Button
                  component={Link}
                  to="/usuarios"
                  sx={navButtonStyle(pathname.startsWith("/usuarios"))}
                >
                  Usuarios
                </Button>
                
                <Button
                  component={Link}
                  to="/asignaciones"
                  sx={navButtonStyle(pathname.startsWith("/asignaciones"))}
                >
                  Asignaciones
                </Button>

                <Button
                  component={Link}
                  to="/reportes/horas"
                  sx={navButtonStyle(pathname.startsWith("/reportes/horas"))}
                >
                  Reporte Horas
                </Button>

                <Button
                  component={Link}
                  to="/horarios"
                  sx={navButtonStyle(pathname.startsWith("/horarios"))}
                >
                  {isAdmin ? "Horarios (Sede)" : "Horarios (Global)"}
                </Button>
              </>
            )}

            {/* --- Botones SÓLO PARA SUPERADMIN --- */}
            {isSuperAdmin && (
              <>
                <Button
                  component={Link}
                  to="/ausenciasadmin"
                  sx={navButtonStyle(pathname.startsWith("/ausenciasadmin"))}
                >
                  Gestionar Ausencias
                </Button>

                <Button
                  component={Link}
                  to="/correcciones-admin"
                  sx={navButtonStyle(pathname.startsWith("/correcciones-admin"))}
                >
                  Gestionar Correcciones
                </Button>

                <Button
                  component={Link}
                  to="/sedes"
                  sx={navButtonStyle(pathname.startsWith("/sedes"))}
                >
                  Sedes
                </Button>

                <Button
                  component={Link}
                  to="/feriados"
                  sx={navButtonStyle(pathname.startsWith("/feriados"))}
                >
                  Feriados
                </Button>

                <Button
                  component={Link}
                  to="/auditoria"
                  sx={navButtonStyle(pathname.startsWith("/auditoria"))}
                >
                  Auditoría
                </Button>
              </>
            )}
          </Stack>

          {/* Espaciador */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Usuario y Logo al lado derecho */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {user && (
              <>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    display: { xs: "none", md: "block" },
                    color: "rgba(255, 255, 255, 0.9)",
                    fontWeight: 500,
                  }}
                >
                  {user.nombreCompleto || user.email} · {user.rol}
                </Typography>

                <Tooltip title="Cuenta">
                  <IconButton onClick={handleOpen} size="small">
                    <Avatar 
                      sx={{ 
                        width: 36, 
                        height: 36,
                        backgroundColor: "#fff",
                        color: "#e9501e",
                        fontWeight: 700,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                      }}
                    >
                      {user.email?.[0]?.toUpperCase() ?? "U"}
                    </Avatar>
                  </IconButton>
                </Tooltip>

                <Menu
                  anchorEl={anchor}
                  open={open}
                  onClose={handleClose}
                  transformOrigin={{ horizontal: "right", vertical: "top" }}
                  anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                  PaperProps={{
                    sx: {
                      mt: 1,
                      minWidth: 200,
                    }
                  }}
                >
                  <MenuItem disabled>
                    <Typography variant="body2" fontWeight={600}>{user.nombreCompleto}</Typography>
                  </MenuItem>
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                  </MenuItem>
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">Rol: {user.rol}</Typography>
                  </MenuItem>
                  {isAdmin && user.sedeNombre && (
                    <MenuItem disabled>
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: "#e9501e" }}>
                        Sede: {user.sedeNombre}
                      </Typography>
                    </MenuItem>
                  )}
                  <Divider />
                  <MenuItem onClick={handleOpenPassDialog}>
                    Cambiar contraseña
                  </MenuItem>
                  <MenuItem onClick={goLogout} sx={{ color: "#cc3625" }}>
                    Cerrar sesión
                  </MenuItem>
                </Menu>
              </>
            )}

            {!user && (
              <Button 
                variant="contained" 
                onClick={() => nav("/login")}
                sx={{ 
                  backgroundColor: "#fff", 
                  color: "#e9501e",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.9)" }
                }}
              >
                Iniciar sesión
              </Button>
            )}

            {/* Logo a la derecha */}
            <Box
              component="img"
              src="/logo-media-naranja.png"
              alt="La Media Naranja"
              sx={{ 
                height: 55,
                width: "auto",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                display: { xs: "none", sm: "block" },
                ml: 1,
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 3 }}>
        <Outlet />
      </Container>

      <ChangePasswordDialog
        open={openPassDialog}
        onClose={() => setOpenPassDialog(false)}
      />
    </>
  );
}