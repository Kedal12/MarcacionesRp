import { useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, Button, IconButton, Chip, Box, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  TextField, Grid, Select, MenuItem, FormControl, InputLabel
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import ReplayIcon from "@mui/icons-material/Replay";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import { useAuth } from "../auth/AuthContext"; // Para obtener el ID del usuario
import { getMisAusencias, crearAusencia, borrarAusencia } from "../api/ausencias"; // API

dayjs.extend(utc);

// Helper para formatear DateOnly (YYYY-MM-DD) para mostrar
const formatDate = (dateOnlyString) => {
    if (!dateOnlyString) return "-";
    return dayjs.utc(dateOnlyString).format("DD/MM/YYYY");
};

// Helper para dar color a los chips de estado
const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
        case 'aprobada': return 'success';
        case 'rechazada': return 'error';
        case 'pendiente': return 'warning';
        default: return 'default';
    }
};

// Tipos de ausencia comunes (podrías obtenerlos de la API si fueran dinámicos)
const tiposAusencia = ["Vacaciones", "Enfermedad", "Permiso Personal", "Licencia Maternidad/Paternidad", "Incapacidad", "Otro"];


export default function MisAusencias() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth(); // Obtiene el usuario logueado ({ id, email, rol })

  const [ausencias, setAusencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Estados para el formulario de nueva solicitud
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState(null); // dayjs object
  const [hasta, setHasta] = useState(null); // dayjs object
  const [observacion, setObservacion] = useState("");

  // Carga las ausencias del usuario logueado
  const loadAusencias = () => {
    if (!user?.id) return; // No cargar si no hay ID de usuario

    setLoading(true);
    setError(null);
    getMisAusencias(user.id)
      .then(setAusencias)
      .catch(e => {
        setError(e?.response?.data || e.message || "Error cargando tus ausencias");
        setAusencias([]);
      })
      .finally(() => setLoading(false));
  };

  // Carga inicial y si cambia el usuario (poco probable en esta vista)
  useEffect(() => {
    loadAusencias();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Depende del ID del usuario

  // Limpia el formulario
  const clearForm = () => {
    setTipo("");
    setDesde(null);
    setHasta(null);
    setObservacion("");
  };

  // Maneja la creación de una nueva solicitud
  const handleCreate = async () => {
    if (!tipo || !desde || !hasta) {
      enqueueSnackbar("Selecciona tipo, fecha 'Desde' y fecha 'Hasta'.", { variant: "warning" });
      return;
    }
    if (dayjs(hasta).isBefore(dayjs(desde))) {
      enqueueSnackbar("La fecha 'Hasta' no puede ser anterior a la fecha 'Desde'.", { variant: "warning" });
      return;
    }

    setSaving(true);
    const dto = {
        tipo: tipo,
        desde: desde, // La API formateará a YYYY-MM-DD
        hasta: hasta,
        observacion: observacion
    };

    try {
      await crearAusencia(dto);
      enqueueSnackbar("Solicitud de ausencia enviada.", { variant: "success" });
      clearForm();
      loadAusencias(); // Recarga la lista
    } catch (e) {
         if (e?.response?.status === 409) { // Conflicto por solapamiento
           enqueueSnackbar(e?.response?.data || "Conflicto: Las fechas se solapan con otra solicitud.", { variant: "error" });
         } else {
           enqueueSnackbar(e?.response?.data || "Error al enviar la solicitud.", { variant: "error" });
         }
    } finally {
      setSaving(false);
    }
  };

  // Maneja la eliminación de una solicitud (ej. solo pendientes o rechazadas)
  const handleDelete = async (ausencia) => {
    // Regla: Solo permitir borrar si está pendiente o rechazada
    if (ausencia.estado !== 'pendiente' && ausencia.estado !== 'rechazada') {
        enqueueSnackbar("Solo puedes eliminar solicitudes pendientes o rechazadas.", { variant: "info" });
        return;
    }

    if (!confirm(`¿Eliminar la solicitud de ${ausencia.tipo} del ${formatDate(ausencia.desde)} al ${formatDate(ausencia.hasta)}?`)) return;

    setDeletingId(ausencia.id);
    try {
      await borrarAusencia(ausencia.id);
      enqueueSnackbar("Solicitud eliminada.", { variant: "success" });
      // Actualiza la lista localmente para respuesta más rápida
      setAusencias(prev => prev.filter(a => a.id !== ausencia.id));
    } catch (e) {
      enqueueSnackbar(e?.response?.data || "Error al eliminar la solicitud.", { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={800}>Mis Solicitudes de Ausencia</Typography>

        {/* Formulario para Nueva Solicitud */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Crear Nueva Solicitud</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
               <FormControl fullWidth size="small">
                 <InputLabel id="tipo-ausencia-label">Tipo *</InputLabel>
                 <Select
                   labelId="tipo-ausencia-label"
                   value={tipo}
                   label="Tipo *"
                   onChange={(e) => setTipo(e.target.value)}
                   disabled={saving}
                 >
                   {tiposAusencia.map(t => <MenuItem key={t} value={t.toLowerCase()}>{t}</MenuItem>)}
                 </Select>
               </FormControl>
            </Grid>
            <Grid item xs={6} sm={2}>
              <DatePicker
                label="Desde *"
                value={desde}
                onChange={setDesde}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                disablePast // No solicitar ausencias pasadas
                disabled={saving}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <DatePicker
                label="Hasta *"
                value={hasta}
                onChange={setHasta}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                minDate={desde || undefined} // No antes que 'Desde'
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Observación (Opcional)"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={1} // Se expandirá si es necesario con multiline
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={saving || !tipo || !desde || !hasta || loading}
                startIcon={saving ? <CircularProgress size={20} color="inherit"/> : <AddIcon />}
                fullWidth
              >
                Enviar Solicitud
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Lista de Ausencias del Usuario */}
        <Paper>
           <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
             <Typography variant="h6">Mis Solicitudes</Typography>
             <Tooltip title="Refrescar Lista">
                 <span>
                    <IconButton onClick={loadAusencias} disabled={loading}>
                        <ReplayIcon />
                    </IconButton>
                 </span>
             </Tooltip>
           </Stack>

          {error && <Alert severity="error" sx={{ m: 2 }}>{String(error)}</Alert>}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Desde</TableCell>
                  <TableCell>Hasta</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Observación</TableCell>
                  <TableCell>Solicitado El</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                )}
                {!loading && ausencias.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>No tienes solicitudes de ausencia.</TableCell></TableRow>
                )}
                {!loading && ausencias.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{a.tipo}</TableCell>
                    <TableCell>{formatDate(a.desde)}</TableCell>
                    <TableCell>{formatDate(a.hasta)}</TableCell>
                    <TableCell>
                      <Chip
                        label={a.estado}
                        color={getStatusColor(a.estado)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={a.observacion || ""}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           {a.observacion || "-"}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{dayjs(a.createdAt).format("DD/MM/YYYY HH:mm")}</TableCell>
                    <TableCell align="right">
                      {/* Mostrar botón de borrar solo si está pendiente o rechazada */}
                      {(a.estado === 'pendiente' || a.estado === 'rechazada') && (
                        <Tooltip title="Eliminar Solicitud">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(a)}
                              disabled={deletingId === a.id}
                            >
                              {deletingId === a.id ? <CircularProgress size={20} color="inherit"/> : <DeleteForeverIcon fontSize="small"/>}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
           {/* Podrías añadir paginación si el usuario puede tener muchas ausencias */}
        </Paper>

      </Stack>
    </LocalizationProvider>
  );
}