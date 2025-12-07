import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, Button, Container, Stack,
  Box, Avatar, Tooltip, IconButton, Menu, MenuItem, Divider
} from "@mui/material";
import { useState } from "react";
import { useAuth } from "./auth/AuthContext";
import ChangePasswordDialog from "./components/ChangePasswordDialog";

// Definir roles localmente para claridad
const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  EMPLEADO: "empleado"
};

export default function App() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  // Normalizar el rol a minúsculas para comparaciones consistentes
  const role = (user?.rol || "").toLowerCase();
  const isAdmin = role === ROLES.ADMIN;
  const isSuperAdmin = role === ROLES.SUPERADMIN;

  // menú del avatar
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);
  const handleOpen = (e) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  // Estado para controlar el diálogo de cambiar contraseña
  const [openPassDialog, setOpenPassDialog] = useState(false);

  const goLogout = () => {
    handleClose();
    logout();
    nav("/login");
  };

  // Función para abrir el diálogo (y cerrar el menú)
  const handleOpenPassDialog = () => {
    handleClose();
    setOpenPassDialog(true);
  };

  return (
    <>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
            Panel Marcación
          </Typography>

          <Stack direction="row" spacing={1} sx={{ ml: 2, flexWrap: 'wrap' }}>
            {/* --- Botones para TODOS los usuarios logueados --- */}
            <Button
              component={Link}
              to="/"
              variant={pathname === "/" ? "contained" : "text"}
              color="primary"
            >
              Dashboard
            </Button>

            <Button
              component={Link}
              to="/marcaciones"
              variant={pathname.startsWith("/marcaciones") ? "contained" : "text"}
              color="primary"
            >
              Marcaciones
            </Button>

            <Button
              component={Link}
              to="/ausencias"
              variant={pathname.startsWith("/ausencias") && !pathname.includes('admin') ? "contained" : "text"}
              color="primary"
            >
              Mis Ausencias
            </Button>

            <Button
              component={Link}
              to="/mis-correcciones"
              variant={pathname.startsWith("/mis-correcciones") ? "contained" : "text"}
              color="primary"
            >
              Mis Correcciones
            </Button>
            {/* --- FIN Botones comunes --- */}

            {/* --- Botones para ADMINS DE SEDE y SUPERADMINS --- */}
            {(isAdmin || isSuperAdmin) && (
              <>
                <Button
                  component={Link}
                  to="/usuarios"
                  variant={pathname.startsWith("/usuarios") ? "contained" : "text"}
                  color="primary"
                >
                  Usuarios
                </Button>
                
                <Button
                  component={Link}
                  to="/asignaciones"
                  variant={pathname.startsWith("/asignaciones") ? "contained" : "text"}
                  color="primary"
                >
                  Asignaciones
                </Button>

                <Button
                  component={Link}
                  to="/reportes/horas"
                  variant={pathname.startsWith("/reportes/horas") ? "contained" : "text"}
                  color="primary"
                >
                  Reporte Horas
                </Button>

                <Button
                  component={Link}
                  to="/ausenciasadmin"
                  variant={pathname.startsWith("/ausenciasadmin") ? "contained" : "text"}
                  color="primary"
                >
                  Gestionar Ausencias
                </Button>

                <Button
                  component={Link}
                  to="/correcciones-admin"
                  variant={pathname.startsWith("/correcciones-admin") ? "contained" : "text"}
                  color="primary"
                >
                  Gestionar Correcciones
                </Button>

                {/* Botón de Horarios - Aparece para ADMIN y SUPERADMIN */}
                <Button
                  component={Link}
                  to="/horarios"
                  variant={pathname.startsWith("/horarios") ? "contained" : "text"}
                  color="primary"
                >
                  {isAdmin ? "Horarios (Sede)" : "Horarios (Global)"}
                </Button>
              </>
            )}
            {/* --- FIN Botones Admin / SuperAdmin --- */}

            {/* --- Botones SÓLO PARA SUPERADMIN --- */}
            {isSuperAdmin && (
              <>
                <Button
                  component={Link}
                  to="/sedes"
                  variant={pathname.startsWith("/sedes") ? "contained" : "text"}
                  color="primary"
                >
                  Sedes
                </Button>

                <Button
                  component={Link}
                  to="/feriados"
                  variant={pathname.startsWith("/feriados") ? "contained" : "text"}
                  color="primary"
                >
                  Feriados
                </Button>

                <Button
                  component={Link}
                  to="/auditoria"
                  variant={pathname.startsWith("/auditoria") ? "contained" : "text"}
                  color="primary"
                >
                  Auditoría
                </Button>
              </>
            )}
            {/* --- FIN Botones SuperAdmin --- */}
          </Stack>

          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
            {user && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
                  {user.nombreCompleto || user.email} · {user.rol}
                </Typography>

                <Tooltip title="Cuenta">
                  <IconButton onClick={handleOpen} size="small" sx={{ ml: 1 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
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
                >
                  <MenuItem disabled>
                    <Typography variant="body2">{user.email}</Typography>
                  </MenuItem>
                  <MenuItem disabled>
                    <Typography variant="body2">Rol: {user.rol}</Typography>
                  </MenuItem>
                  {isAdmin && user.sedeNombre && (
                    <MenuItem disabled>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        Sede: {user.sedeNombre}
                      </Typography>
                    </MenuItem>
                  )}
                  <Divider />
                  <MenuItem onClick={handleOpenPassDialog}>
                    Cambiar contraseña
                  </MenuItem>
                  <MenuItem onClick={goLogout}>Cerrar sesión</MenuItem>
                </Menu>
              </>
            )}

            {!user && (
              <Button variant="outlined" onClick={() => nav("/login")}>
                Iniciar sesión
              </Button>
            )}
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