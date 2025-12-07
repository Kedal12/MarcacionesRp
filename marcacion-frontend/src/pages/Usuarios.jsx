import { useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";
import {
  getUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario,
  resetPassword,
} from "../api/usuarios";
import { getSedes } from "../api/sedes";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ReplayIcon from "@mui/icons-material/Replay";
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Stack,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import KeyIcon from "@mui/icons-material/Key";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
// --- AÑADIDO: Importar useAuth y definir Roles ---
import { useAuth } from "../auth/AuthContext";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  EMPLEADO: "empleado"
};
// --- FIN AÑADIDO ---


export default function Usuarios() {
  // --- AÑADIDO: Obtener usuario y rol ---
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  // datos + paginación
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // filtros
  const [sedes, setSedes] = useState([]); // Lista de sedes para el dropdown
  const [idSede, setIdSede] = useState(""); // Filtro de sede
  const [search, setSearch] = useState("");

  // ui
  const [loading, setLoading] = useState(false);
  const [loadingSedes, setLoadingSedes] = useState(false); // AÑADIDO
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // dialogs
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState(null);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [resetting, setResetting] = useState(false);

  // form create
  const [fNombre, setFNombre] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fRol, setFRol] = useState("empleado"); // Default para superadmin
  const [fSede, setFSede] = useState(""); // Default para superadmin

  // form edit
  const [eNombre, setENombre] = useState("");
  const [eRol, setERol] = useState("empleado");
  const [eSede, setESede] = useState("");
  const [eActivo, setEActivo] = useState(true);

  const { enqueueSnackbar } = useSnackbar();

  // (util export - sin cambios)
  function toCsvValue(v) {
    if (v === null || v === undefined) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  }
  async function fetchAllUsuarios() {
    // query ya está filtrado por sede si es admin
    const size = 500;
    let p = 1;
    const all = [];
    while (true) {
      const res = await getUsuarios({ ...query, page: p, pageSize: size });
      all.push(...res.items);
      if (res.items.length < size) break;
      p++;
    }
    return all;
  }
  async function exportCsvUsuarios() {
    try {
      setExporting(true);
      const items = await fetchAllUsuarios(); // Usa la data ya filtrada
      const header = ["Id", "Nombre", "Email", "Rol", "Sede", "Activo"];
      const rows = items.map((u) => [
        u.id, u.nombreCompleto, u.email, u.rol, u.sedeNombre ?? u.idSede, u.activo ? "Sí" : "No",
      ]);
      const csv = [header, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");
      const csvWithBom = "\uFEFF" + csv;
      const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `usuarios_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      enqueueSnackbar("Usuarios exportados", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(e?.message || "No se pudo exportar", { variant: "error" });
    } finally {
      setExporting(false);
    }
  }

  // --- MODIFICADO: Cargar sedes solo si es SuperAdmin ---
  useEffect(() => {
    if (isSuperAdmin) { // Solo superadmin necesita la lista para el FILTRO
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then((data) => setSedes(data.items))
        .catch(() => { setSedes([]); enqueueSnackbar("Error cargando sedes", {variant: "error"}); })
        .finally(() => setLoadingSedes(false));
    }
    // Nota: El diálogo de "Crear" también usa 'sedes'.
    // Si un admin necesita crear usuarios (y el campo Sede NO está oculto),
    // deberíamos cargar 'sedes' para todos los admins.
    // Pero como ocultaremos el campo Sede para 'admin', esta lógica es correcta.
  }, [isSuperAdmin, enqueueSnackbar]);
  // --- FIN MODIFICADO ---

  // --- AÑADIDO: Efecto para forzar la sede si el usuario es admin ---
  useEffect(() => {
    if (user && !isSuperAdmin) {
      // Si el usuario es admin (no superadmin), forzar su ID de sede en el filtro
      setIdSede(String(user.idSede || ""));
    }
  }, [user, isSuperAdmin]);
  // --- FIN AÑADIDO ---


  const query = useMemo(() => {
    const p = { page: page + 1, pageSize: rowsPerPage };
    if (search.trim()) p.search = search.trim();
    // idSede es forzado por el useEffect si es admin, o seteado por el Select si es superadmin
    if (idSede) p.idSede = Number(idSede);
    return p;
  }, [page, rowsPerPage, search, idSede]);


  function load() {
    // Evita carga inicial si es admin y el idSede (forzado) aún no se ha seteado
    if (user?.rol === ROLES.ADMIN && !idSede) {
        return; 
    }
    
    setLoading(true);
    setErr(null);
    return getUsuarios(query)
      .then(setData)
      .catch((e) => setErr(e?.response?.data || e.message || "Error cargando usuarios"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user?.rol, idSede]); // Depende de query (que depende de idSede)

  // CRUD

  function openCreate() {
    setFNombre("");
    setFEmail("");
    setFPassword("");
    // Defaults:
    setFRol("empleado"); 
    // Si es SuperAdmin, fSede vacío para que elija.
    // Si es Admin, se seteará en onCreate basado en user.idSede.
    setFSede(""); 
    setOpenNew(true);
  }

  // --- MODIFICADO: onCreate usa lógica de roles ---
  async function onCreate() {
    try {
      // Define el payload basado en el rol
      const payload = {
        nombreCompleto: fNombre,
        email: fEmail,
        password: fPassword,
        rol: isSuperAdmin ? fRol : ROLES.EMPLEADO, // Admin solo puede crear empleados
        idSede: isSuperAdmin ? Number(fSede) : user.idSede, // Admin usa su propia sede
      };

      // Validación del payload
      if (!payload.nombreCompleto || !payload.email || !payload.password || !payload.idSede) {
        // SuperAdmin ve el error "Sede"
        // Admin ve error genérico (ya que su sede debería existir)
        enqueueSnackbar("Completa todos los campos obligatorios.", { variant: "warning" });
        return;
      }
      
      await crearUsuario(payload);
      setOpenNew(false);
      load();
      enqueueSnackbar("Usuario creado", { variant: "success" });
    } catch (e) {
      // El backend ya devuelve 403 Forbidden si el admin intenta crear otro rol
      const msg = e?.response?.data || e.message || "Error al crear";
      enqueueSnackbar(msg, { variant: "error" });
    }
  }
  // --- FIN MODIFICADO ---

  function openEditDialog(u) {
    setEditing(u);
    setENombre(u.nombreCompleto);
    setERol(u.rol);
    setESede(String(u.idSede));
    setEActivo(u.activo);
    setOpenEdit(true);
  }

  async function onEditSave() {
    try {
      // El backend (UsuariosController) ya valida si el admin
      // intenta editar campos/usuarios que no debe.
      await actualizarUsuario(editing.id, {
        nombreCompleto: eNombre,
        rol: eRol,
        idSede: Number(eSede),
        activo: eActivo,
      });
      setOpenEdit(false);
      load();
      enqueueSnackbar("Usuario actualizado", { variant: "success" });
    } catch (e) {
      // El backend devolverá 403 Forbidden si el admin viola las reglas
      enqueueSnackbar(e?.response?.data || "Error al actualizar", { variant: "error" });
    }
  }

  async function onToggle(u) {
    // El backend (UsuariosController) valida si el admin puede hacer esto
    try {
        await cambiarEstadoUsuario(u.id, !u.activo);
        load();
    } catch (e) {
        enqueueSnackbar(e?.response?.data || "Error al cambiar estado", { variant: "error" });
    }
  }

  function handleOpenResetDialog(u) {
    setPendingUser(u);
    setNewPass("");
    setShowPass(false);
    setResetOpen(true);
  }

  async function onDelete(u) {
    // El backend (UsuariosController) valida si el admin puede borrar
    if (!confirm(`¿Eliminar al usuario ${u.nombreCompleto}?`)) return;
    try {
      setDeletingId(u.id);
      await eliminarUsuario(u.id);
      await load();
      enqueueSnackbar("Usuario eliminado", { variant: "success" });
    } catch (e) {
      const msg = e?.response?.data || e.message || "Error al eliminar";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  }

  // Generador simple de contraseñas (sin cambios)
  function genPassword(len = 10) {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800}>
          Usuarios
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuevo usuario
        </Button>
      </Stack>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <TextField
            label="Buscar (nombre o email)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 260 }}
          />
          
          {/* --- MODIFICADO: Filtro Sede (Select) solo para SuperAdmin --- */}
          {isSuperAdmin && (
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel id="sede-label">Sede</InputLabel>
              <Select
                labelId="sede-label"
                label="Sede"
                value={idSede}
                disabled={loadingSedes || loading}
                onChange={(e) => {
                  setIdSede(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Todas</MenuItem>
                {sedes.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {s.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {/* --- FIN MODIFICADO --- */}

          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            startIcon={exporting ? <CircularProgress size={20} /> : <FileDownloadIcon />}
            onClick={exportCsvUsuarios}
            disabled={exporting || loading}
            sx={{ minWidth: 120 }}
          >
            {exporting ? "Exportando..." : "Exportar"}
          </Button>
          <IconButton onClick={load} disabled={loading}>
            <ReplayIcon />
          </IconButton>
        </Stack>
      </Paper>

      {/* Tabla (Sin cambios) */}
      <Paper elevation={3}>
        {err && <Alert severity="error">{String(err)}</Alert>}
        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Rol</TableCell>
                    <TableCell>Sede</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.id}</TableCell>
                      <TableCell>{u.nombreCompleto}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={u.rol}
                          color={(u.rol === "admin" || u.rol === "superadmin") ? "secondary" : "default"}
                        />
                      </TableCell>
                      <TableCell>{u.sedeNombre ?? u.idSede}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={u.activo ? "Activo" : "Inactivo"}
                          color={u.activo ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEditDialog(u)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => onToggle(u)}>
                          {u.activo ? <BlockIcon /> : <CheckCircleIcon />}
                        </IconButton>
                        <Tooltip title="Resetear contraseña">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleOpenResetDialog(u)}
                          >
                            <KeyIcon />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDelete(u)}
                          disabled={deletingId === u.id}
                        >
                          <DeleteForeverIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        No hay usuarios.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data.total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 20, 50]}
              labelRowsPerPage="Filas por página"
            />
          </>
        )}
      </Paper>

      {/* Dialog Crear */}
      <Dialog open={openNew} onClose={() => setOpenNew(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nuevo usuario</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Nombre completo"
                fullWidth
                value={fNombre}
                onChange={(e) => setFNombre(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Email" fullWidth value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={fPassword}
                onChange={(e) => setFPassword(e.target.value)}
              />
            </Grid>
            
            {/* --- MODIFICADO: Campos solo para SuperAdmin --- */}
            {isSuperAdmin && (
              <>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel id="rol-n">Rol</InputLabel>
                    <Select
                      labelId="rol-n"
                      label="Rol"
                      value={fRol}
                      onChange={(e) => setFRol(e.target.value)}
                    >
                      <MenuItem value="empleado">Empleado</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="superadmin">SuperAdmin</MenuItem> {/* SuperAdmin puede crear otros SuperAdmins */}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel id="sede-n">Sede</InputLabel>
                    <Select
                      labelId="sede-n"
                      label="Sede"
                      value={fSede}
                      onChange={(e) => setFSede(e.target.value)}
                    >
                      {/* SuperAdmin necesita la lista de sedes aquí */}
                      {sedes.map((s) => (
                        <MenuItem key={s.id} value={String(s.id)}>
                          {s.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
             {/* --- FIN MODIFICADO --- */}
             
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNew(false)}>Cancelar</Button>
          <Button variant="contained" onClick={onCreate}>
            Crear
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Editar */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar usuario</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Nombre completo"
                fullWidth
                value={eNombre}
                onChange={(e) => setENombre(e.target.value)}
              />
            </Grid>
            {/* --- MODIFICADO: Deshabilitar campos para Admin --- */}
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel id="rol-e">Rol</InputLabel>
                <Select
                  labelId="rol-e"
                  label="Rol"
                  value={eRol}
                  onChange={(e) => setERol(e.target.value)}
                  disabled={!isSuperAdmin} // <-- Admin no puede cambiar rol
                >
                  <MenuItem value="empleado">Empleado</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="superadmin">SuperAdmin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel id="sede-e">Sede</InputLabel>
                <Select
                  labelId="sede-e"
                  label="Sede"
                  value={eSede}
                  onChange={(e) => setESede(e.target.value)}
                  disabled={!isSuperAdmin} // <-- Admin no puede cambiar sede
                >
                  {/* SuperAdmin necesita la lista de sedes aquí */}
                  {sedes.map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {/* --- FIN MODIFICADO --- */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="estado-e">Estado</InputLabel>
                <Select
                  labelId="estado-e"
                  label="Estado"
                  value={eActivo ? "1" : "0"}
                  onChange={(e) => setEActivo(e.target.value === "1")}
                  // Un admin SÍ puede activar/desactivar usuarios de su sede (controlado en backend)
                >
                  <MenuItem value="1">Activo</MenuItem>
                  <MenuItem value="0">Inactivo</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)}>Cancelar</Button>
          <Button variant="contained" onClick={onEditSave}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Reset contraseña (Sin cambios) */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Resetear contraseña</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Usuario: <strong>{pendingUser?.nombreCompleto}</strong> ({pendingUser?.email})
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <TextField
              fullWidth
              label="Nueva contraseña"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              type={showPass ? "text" : "password"}
              inputProps={{ minLength: 6 }}
              helperText="Mínimo 6 caracteres"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass((s) => !s)} edge="end">
                      {showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="outlined"
              onClick={() => setNewPass(genPassword())}
              sx={{ whiteSpace: "nowrap" }}
            >
              Generar
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Confirma para establecer la nueva contraseña del usuario.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={resetting || newPass.length < 6}
            onClick={async () => {
              try {
                setResetting(true);
                await resetPassword(pendingUser.id, newPass); // El backend valida el permiso
                enqueueSnackbar("Contraseña reestablecida", { variant: "success" });
                setResetOpen(false);
                setPendingUser(null);
                setNewPass("");
              } catch (e) {
                enqueueSnackbar(
                  e?.response?.data || e.message || "Error al resetear",
                  { variant: "error" }
                );
              } finally {
                setResetting(false);
              }
            }}
          >
            {resetting ? "Procesando..." : "Resetear ahora"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

