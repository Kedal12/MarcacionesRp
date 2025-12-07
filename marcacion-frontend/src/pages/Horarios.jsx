import { useEffect, useState, useMemo } from "react";
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, Button, IconButton, Chip, Box, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Switch,
  // --- AÑADIDOS ---
  Grid, FormControl, InputLabel, Select, MenuItem
  // --- FIN AÑADIDOS ---
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ReplayIcon from "@mui/icons-material/Replay";
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
// --- MODIFICADO: Añadido getSedes ---
import { getHorarios, crearHorario, actualizarHorario, eliminarHorario, getHorario } from "../api/horarios";
import { getSedes } from "../api/sedes"; // Para el filtro de sedes
// --- FIN MODIFICADO ---
import HorarioDetailsDialog from "../components/HorarioDetailsDialog";
// --- AÑADIDO: Importar useAuth y definir Roles ---
import { useAuth } from "../auth/AuthContext";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---


// --- MODIFICADO: Diálogo ahora maneja IdSede y roles ---
function HorarioDialog({ open, onClose, onSave, initial, user, sedesList }) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [activo, setActivo] = useState(initial?.activo ?? true);
  // --- AÑADIDO: Estado para la Sede ---
  const [idSede, setIdSede] = useState(initial?.idSede ? String(initial.idSede) : ""); // "" es 'Global'
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  useEffect(() => {
    setNombre(initial?.nombre ?? "");
    setActivo(initial?.activo ?? true);
    // --- AÑADIDO: Actualizar Sede en edición ---
    setIdSede(initial?.idSede ? String(initial.idSede) : "");
    // --- FIN AÑADIDO ---
  }, [initial]);

  const handleSave = () => {
    if (!nombre.trim()) return;

    // Construye el DTO basado en los campos
    const dto = {
      nombre: nombre.trim(),
      activo,
    };

    // Solo el SuperAdmin puede enviar el IdSede (null para Global)
    if (isSuperAdmin) {
      dto.idSede = idSede ? Number(idSede) : null;
    }
    // Si es un Admin de Sede, el backend forzará su IdSede

    onSave(dto);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? "Editar Horario" : "Nuevo Horario"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre del Horario"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={activo} onChange={(e) => setActivo(e.target.checked)} />}
            label={activo ? "Activo" : "Inactivo"}
          />

          {/* --- AÑADIDO: Selector de Sede (solo SuperAdmin) --- */}
          {isSuperAdmin && (
            <FormControl fullWidth size="small">
              <InputLabel id="sede-select-label">Asignar Sede (Opcional)</InputLabel>
              <Select
                labelId="sede-select-label"
                value={idSede}
                label="Asignar Sede (Opcional)"
                onChange={(e) => setIdSede(e.target.value)}
              >
                <MenuItem value="">Global (para todas las sedes)</MenuItem>
                {sedesList.map(s => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {/* --- FIN AÑADIDO --- */}

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={!nombre.trim()}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
// --- FIN MODIFICADO ---


// --- Componente Principal ---
export default function Horarios() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editingDetailsId, setEditingDetailsId] = useState(null);
  
  // --- AÑADIDO: Cargar Sedes para el diálogo ---
  const [sedesList, setSedesList] = useState([]);
  const [loadingSedes, setLoadingSedes] = useState(false);

  useEffect(() => {
    // Solo SuperAdmin necesita cargar la lista de sedes para el diálogo
    if (isSuperAdmin) {
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedesList(data.items))
        .catch(console.error)
        .finally(() => setLoadingSedes(false));
    }
  }, [isSuperAdmin]);
  // --- FIN AÑADIDO ---

  function load() {
    setLoading(true); setErr(null);
    // getHorarios() ya está filtrado por el backend (Admin solo ve Globales y los de su Sede)
    return getHorarios()
      .then(setHorarios)
      .catch(e => {
        setErr(e?.response?.data || e.message || "Error cargando horarios");
        setHorarios([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const handleOpenDialog = (horario = null) => {
    // 'horario' ya contiene idSede y sedeNombre desde la API
    setEditing(horario);
    setDialogOpen(true);
  };

  // handleSave no cambia: el backend maneja la lógica de forzar IdSede para admins
  const handleSave = async (dto) => {
    try {
      if (editing) {
        await actualizarHorario(editing.id, dto);
        enqueueSnackbar("Horario actualizado", { variant: "success" });
      } else {
        await crearHorario(dto);
        enqueueSnackbar("Horario creado", { variant: "success" });
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      // Backend devolverá 403 si el admin intenta editar un horario global/de otra sede
      enqueueSnackbar(e?.response?.data || "Error al guardar el horario", { variant: "error" });
    }
  };

  // handleDelete no cambia: el backend maneja la lógica de permisos
  const handleDelete = async (horario) => {
    if (!confirm(`¿Eliminar el horario "${horario.nombre}"?`)) return;
    try {
      setDeletingId(horario.id);
      await eliminarHorario(horario.id);
      enqueueSnackbar("Horario eliminado", { variant: "success" });
      await load();
    } catch (e) {
      if (e?.response?.status === 409) {
         enqueueSnackbar(e?.response?.data || "Conflicto: El horario está asignado a usuarios.", { variant: "error" });
      } else {
         // Backend devolverá 403 si el admin intenta borrar un horario global/de otra sede
         enqueueSnackbar(e?.response?.data || "No se pudo eliminar el horario", { variant: "error" });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenDetailsDialog = (idHorario) => {
      setEditingDetailsId(idHorario);
      setDetailsDialogOpen(true);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" fontWeight={800}>Horarios</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={load}
            disabled={loading}
          >
            Refrescar
          </Button>
          {/* --- MODIFICADO: Botón visible para Admin y SuperAdmin --- */}
          {(isSuperAdmin || user?.rol === ROLES.ADMIN) && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Nuevo Horario
            </Button>
          )}
          {/* --- FIN MODIFICADO --- */}
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{String(err)}</Alert>}

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                {/* --- AÑADIDO: Columna Sede --- */}
                <TableCell>Sede Asignada</TableCell>
                {/* --- FIN AÑADIDO --- */}
                <TableCell>Estado</TableCell>
                {/* --- MODIFICADO: Columna visible para Admin y SuperAdmin --- */}
                {(isSuperAdmin || user?.rol === ROLES.ADMIN) && (
                  <TableCell align="right">Acciones</TableCell>
                )}
                {/* --- FIN MODIFICADO --- */}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin || user?.rol === ROLES.ADMIN ? 5 : 4} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              )}
              {!loading && horarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin || user?.rol === ROLES.ADMIN ? 5 : 4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No hay horarios definidos.
                  </TableCell>
                </TableRow>
              )}
              {!loading && horarios.map(h => (
                <TableRow key={h.id} hover>
                  <TableCell>{h.id}</TableCell>
                  <TableCell>{h.nombre}</TableCell>
                  {/* --- AÑADIDO: Celda Sede --- */}
                  <TableCell>
                    <Chip
                      label={h.sedeNombre || "Global"}
                      size="small"
                      variant="outlined"
                      color={h.sedeNombre ? "primary" : "default"}
                    />
                  </TableCell>
                  {/* --- FIN AÑADIDO --- */}
                  <TableCell>
                    <Chip
                      label={h.activo ? "Activo" : "Inactivo"}
                      color={h.activo ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  {/* --- MODIFICADO: Celda visible para Admin y SuperAdmin --- */}
                  {(isSuperAdmin || user?.rol === ROLES.ADMIN) && (
                    <TableCell align="right">
                      <Tooltip title="Editar Detalles del Horario">
                         <IconButton size="small" color="primary" onClick={() => handleOpenDetailsDialog(h.id)}>
                             <EditCalendarIcon />
                         </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar Nombre/Estado/Sede">
                         <IconButton size="small" onClick={() => handleOpenDialog(h)}>
                             <EditIcon />
                         </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar Horario">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(h)}
                            disabled={deletingId === h.id}
                          >
                            {deletingId === h.id ? <CircularProgress size={20} color="inherit"/> : <DeleteForeverIcon />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  )}
                  {/* --- FIN MODIFICADO --- */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* --- MODIFICADO: Diálogos visibles para Admin y SuperAdmin --- */}
      {(isSuperAdmin || user?.rol === ROLES.ADMIN) && (
        <>
          <HorarioDialog
            open={dialogOpen}
            onClose={() => { setDialogOpen(false); setEditing(null); }}
            onSave={handleSave}
            initial={editing}
            // --- AÑADIDO: Props para el diálogo ---
            user={user}
            sedesList={sedesList}
            // --- FIN AÑADIDO ---
          />
          
          {editingDetailsId && (
            <HorarioDetailsDialog
                open={detailsDialogOpen}
                onClose={() => { setDetailsDialogOpen(false); setEditingDetailsId(null); }}
                horarioId={editingDetailsId}
                // TODO: El HorarioDetailsDialog también debería recibir el 'user'
                // para deshabilitar el guardado si un Admin de Sede
                // intenta (por error) editar un horario Global.
            />
          )}
        </>
      )}
      {/* --- FIN MODIFICADO --- */}
    </Stack>
  );
}

