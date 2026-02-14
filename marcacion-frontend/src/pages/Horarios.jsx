import { useEffect, useState, useMemo } from "react";
import {
  Paper, Stack, Typography, Button, IconButton, Chip, Box, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Switch,
  FormControl, InputLabel, Select, MenuItem, Tooltip // <--- ASEGÚRATE DE AGREGAR ESTO
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ReplayIcon from "@mui/icons-material/Replay";
import EditCalendarIcon from '@mui/icons-material/EditCalendar';

// 1. Importar Hooks de React Query
import { useHorarios, useCrearHorario, useActualizarHorario, useEliminarHorario } from "../hooks/useHorarios";
import { useSedesAll } from "../hooks/useSedes";
import { useAuth } from "../auth/AuthContext";
import HorarioDetailsDialog from "../components/HorarioDetailsDialog";

const ROLES = { SUPERADMIN: "superadmin", ADMIN: "admin" };

// --- DIÁLOGO INTEGRADO CORREGIDO ---
function HorarioDialog({ open, onClose, onSave, initial, user, sedesList }) {
  const [nombre, setNombre] = useState("");
  const [activo, setActivo] = useState(true);
  const [idSede, setIdSede] = useState(""); 
  
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  // Sincronizar estado cuando se abre para editar
  useEffect(() => {
    if (open) {
      setNombre(initial?.nombre ?? "");
      setActivo(initial?.activo ?? true);
      setIdSede(initial?.idSede ? String(initial.idSede) : "");
    }
  }, [initial, open]);

  const handleSaveLocal = () => {
    if (!nombre.trim()) return;
    const dto = {
      nombre: nombre.trim(),
      activo,
    };
    if (isSuperAdmin) {
      // Si el valor es vacío, enviamos null para que sea un horario "Global"
      dto.idSede = idSede === "" ? null : Number(idSede);
    }
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
            size="small"
          />
          <FormControlLabel
            control={<Switch checked={activo} onChange={(e) => setActivo(e.target.checked)} />}
            label={activo ? "Activo" : "Inactivo"}
          />
          {isSuperAdmin && (
            <FormControl fullWidth size="small">
              <InputLabel id="sede-select-label">Asignar Sede (Opcional)</InputLabel>
              <Select
                labelId="sede-select-label"
                value={idSede}
                label="Asignar Sede (Opcional)"
                onChange={(e) => setIdSede(e.target.value)}
              >
                <MenuItem value="">Global (todas las sedes)</MenuItem>
                {/* Mapeo con validación de arreglo y keys únicas */}
                {Array.isArray(sedesList) && sedesList.map((s) => (
                  <MenuItem key={`sede-opt-${s.id}`} value={String(s.id)}>
                    {s.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSaveLocal} disabled={!nombre.trim()}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function Horarios() {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  // Carga de Horarios
  const { data: horarios = [], isLoading, isError, error, refetch } = useHorarios();
  
  // Carga de Sedes con Normalización de Datos
  const { data: sedesData } = useSedesAll();
  
  const sedesList = useMemo(() => {
    if (!sedesData) return [];
    // Verifica si la API devolvió el array directo o dentro de .items
    return Array.isArray(sedesData) ? sedesData : (sedesData.items || []);
  }, [sedesData]);

  const crearMutation = useCrearHorario();
  const editarMutation = useActualizarHorario();
  const eliminarMutation = useEliminarHorario();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editingDetailsId, setEditingDetailsId] = useState(null);

  const handleSave = async (dto) => {
    if (editing) {
      await editarMutation.mutateAsync({ id: editing.id, dto });
    } else {
      await crearMutation.mutateAsync(dto);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const handleDelete = (h) => {
    if (window.confirm(`¿Eliminar el horario "${h.nombre}"?`)) {
        eliminarMutation.mutate(h.id);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" fontWeight={800}>Horarios</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ReplayIcon />} onClick={() => refetch()} disabled={isLoading}>
            Refrescar
          </Button>
          {(isSuperAdmin || user?.rol === ROLES.ADMIN) && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>
              Nuevo Horario
            </Button>
          )}
        </Stack>
      </Stack>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>{error?.message || "Error al cargar"}</Alert>}

      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell><strong>ID</strong></TableCell>
                <TableCell><strong>Nombre</strong></TableCell>
                <TableCell><strong>Sede Asignada</strong></TableCell>
                <TableCell><strong>Estado</strong></TableCell>
                {(isSuperAdmin || user?.rol === ROLES.ADMIN) && <TableCell align="right"><strong>Acciones</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={30} /></TableCell></TableRow>
              ) : horarios.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No hay horarios configurados</TableCell></TableRow>
              ) : horarios.map(h => (
                <TableRow key={h.id} hover>
                  <TableCell>{h.id}</TableCell>
                  <TableCell>{h.nombre}</TableCell>
                  <TableCell>
                    <Chip 
                        label={h.sedeNombre || "Global"} 
                        size="small" 
                        variant="outlined" 
                        color={h.sedeNombre ? "primary" : "default"} 
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                        label={h.activo ? "Activo" : "Inactivo"} 
                        color={h.activo ? "success" : "default"} 
                        size="small" 
                    />
                  </TableCell>
                  {(isSuperAdmin || user?.rol === ROLES.ADMIN) && (
                    <TableCell align="right">
                      <Tooltip title="Editar Detalles Diarios">
                        <IconButton color="primary" onClick={() => { setEditingDetailsId(h.id); setDetailsDialogOpen(true); }}>
                            <EditCalendarIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar Nombre/Sede">
                        <IconButton onClick={() => { setEditing(h); setDialogOpen(true); }}>
                            <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton color="error" onClick={() => handleDelete(h)} disabled={eliminarMutation.isLoading}>
                            <DeleteForeverIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <HorarioDialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        onSave={handleSave} 
        initial={editing} 
        user={user} 
        sedesList={sedesList} 
      />
      
      {editingDetailsId && (
        <HorarioDetailsDialog 
          open={detailsDialogOpen} 
          onClose={() => { setDetailsDialogOpen(false); setEditingDetailsId(null); }} 
          horarioId={editingDetailsId} 
        />
      )}
    </Stack>
  );
}