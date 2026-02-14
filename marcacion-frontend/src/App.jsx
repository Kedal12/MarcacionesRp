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

  // ✅ CORRECCIÓN: Aseguramos que el rol se compare correctamente con el objeto ROLES
  const role = (user?.rol || "").toLowerCase();
  const isAdmin = role === ROLES.ADMIN;
  const isSuperAdmin = role === ROLES.SUPERADMIN; // Antes decía ROLES.superadmin (en minúscula y fallaba)

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

  useEffect(() => {
    if (user) {
      // Prefetch de datos comunes
      queryClient.prefetchQuery({
        queryKey: ['sedes'],
        queryFn: async () => {
          const response = await api.get('/api/sedes');
          return response.data;
        },
        staleTime: 10 * 60 * 1000,
      });

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
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 800, 
              color: "#fff",
              textShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            Panel Marcación
          </Typography>

          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            <Button component={Link} to="/" sx={navButtonStyle(pathname === "/")}>
              Dashboard
            </Button>

            <Button component={Link} to="/marcaciones" sx={navButtonStyle(pathname.startsWith("/marcaciones"))}>
              Marcaciones
            </Button>

            <Button component={Link} to="/ausencias" sx={navButtonStyle(pathname.startsWith("/ausencias") && !pathname.includes('admin'))}>
              Mis Ausencias
            </Button>

            <Button component={Link} to="/mis-correcciones" sx={navButtonStyle(pathname.startsWith("/mis-correcciones"))}>
              Mis Correcciones
            </Button>

            {/* --- Secciones para Admin y SuperAdmin --- */}
            {(isAdmin || isSuperAdmin) && (
              <>
                <Button component={Link} to="/usuarios" sx={navButtonStyle(pathname.startsWith("/usuarios"))}>
                  Usuarios
                </Button>
                
                <Button component={Link} to="/asignaciones" sx={navButtonStyle(pathname.startsWith("/asignaciones"))}>
                  Asignaciones
                </Button>

                <Button component={Link} to="/reportes/horas" sx={navButtonStyle(pathname.startsWith("/reportes/horas"))}>
                  Reporte Horas
                </Button>

                <Button component={Link} to="/horarios" sx={navButtonStyle(pathname.startsWith("/horarios"))}>
                  {isAdmin ? "Horarios (Sede)" : "Horarios (Global)"}
                </Button>
              </>
            )}

            {/* --- Secciones Exclusivas de SuperAdmin --- */}
            {isSuperAdmin && (
              <>
                <Button component={Link} to="/ausenciasadmin" sx={navButtonStyle(pathname.startsWith("/ausenciasadmin"))}>
                  Gestionar Ausencias
                </Button>

                <Button component={Link} to="/correcciones-admin" sx={navButtonStyle(pathname.startsWith("/correcciones-admin"))}>
                  Gestionar Correcciones
                </Button>

                <Button component={Link} to="/sedes" sx={navButtonStyle(pathname.startsWith("/sedes"))}>
                  Sedes
                </Button>

                <Button component={Link} to="/feriados" sx={navButtonStyle(pathname.startsWith("/feriados"))}>
                  Feriados
                </Button>

                <Button component={Link} to="/auditoria" sx={navButtonStyle(pathname.startsWith("/auditoria"))}>
                  Auditoría
                </Button>
              </>
            )}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {user && (
              <>
                <Typography variant="body2" sx={{ display: { xs: "none", md: "block" }, color: "rgba(255, 255, 255, 0.9)", fontWeight: 500 }}>
                  {user.nombreCompleto || user.email} · <strong>{role}</strong>
                </Typography>

                <IconButton onClick={handleOpen} size="small">
                  <Avatar sx={{ width: 36, height: 36, backgroundColor: "#fff", color: "#e9501e", fontWeight: 700 }}>
                    {user.email?.[0]?.toUpperCase() ?? "U"}
                  </Avatar>
                </IconButton>

                <Menu
                  anchorEl={anchor}
                  open={open}
                  onClose={handleClose}
                  transformOrigin={{ horizontal: "right", vertical: "top" }}
                  anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                >
                  <MenuItem disabled>
                    <Typography variant="body2" fontWeight={600}>{user.nombreCompleto}</Typography>
                  </MenuItem>
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">Rol: {role}</Typography>
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={handleOpenPassDialog}>Cambiar contraseña</MenuItem>
                  <MenuItem onClick={goLogout} sx={{ color: "#cc3625" }}>Cerrar sesión</MenuItem>
                </Menu>
              </>
            )}
            
            <Box component="img" src="/logo-media-naranja.webp" sx={{ height: 55, display: { xs: "none", sm: "block" } }} />
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 3 }}>
        <Outlet />
      </Container>

      <ChangePasswordDialog open={openPassDialog} onClose={() => setOpenPassDialog(false)} />
    </>
  );
}