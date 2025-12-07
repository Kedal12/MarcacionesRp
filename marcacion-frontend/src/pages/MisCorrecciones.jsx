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
import { LocalizationProvider, DatePicker, TimePicker } from "@mui/x-date-pickers"; // Añadido TimePicker
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import { useAuth } from "../auth/AuthContext"; // Para obtener el ID del usuario
import { getMisCorrecciones, crearCorreccion, borrarCorreccion } from "../api/correcciones"; // API

dayjs.extend(utc);

// Helper para formatear DateOnly (YYYY-MM-DD) para mostrar
const formatDate = (dateOnlyString) => {
    if (!dateOnlyString) return "-";
    return dayjs.utc(dateOnlyString).format("DD/MM/YYYY");
};

// Helper para formatear TimeSpan (HH:mm:ss) para mostrar (HH:mm)
const formatTime = (timeSpanString) => {
    if (!timeSpanString || typeof timeSpanString !== 'string') return "-";
    const parts = timeSpanString.split(':');
    if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return "-";
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

export default function MisCorrecciones() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth(); // Obtiene el usuario logueado ({ id, email, rol })

  const [correcciones, setCorrecciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Estados para el formulario de nueva solicitud
  const [fecha, setFecha] = useState(null); // dayjs object para DatePicker
  const [tipo, setTipo] = useState("entrada"); // 'entrada' o 'salida'
  const [horaSolicitada, setHoraSolicitada] = useState(null); // dayjs object para TimePicker
  const [motivo, setMotivo] = useState("");

  // Carga las correcciones del usuario logueado
  const loadCorrecciones = () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    getMisCorrecciones(user.id)
      .then(setCorrecciones)
      .catch(e => {
        setError(e?.response?.data || e.message || "Error cargando tus correcciones");
        setCorrecciones([]);
      })
      .finally(() => setLoading(false));
  };

  // Carga inicial
  useEffect(() => {
    loadCorrecciones();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Limpia el formulario
  const clearForm = () => {
    setFecha(null);
    setTipo("entrada");
    setHoraSolicitada(null);
    setMotivo("");
  };

  // Maneja la creación de una nueva solicitud
  const handleCreate = async () => {
    if (!fecha || !tipo || !horaSolicitada || !motivo.trim()) {
      enqueueSnackbar("Completa todos los campos: Fecha, Tipo, Hora y Motivo.", { variant: "warning" });
      return;
    }

    setSaving(true);
    const dto = {
        fecha: fecha, // La API formateará
        tipo: tipo,
        // La API espera "HH:mm" o "HH:mm:ss", TimePicker devuelve objeto dayjs
        horaSolicitada: dayjs(horaSolicitada).format("HH:mm"),
        motivo: motivo.trim()
    };

    try {
      await crearCorreccion(dto);
      enqueueSnackbar("Solicitud de corrección enviada.", { variant: "success" });
      clearForm();
      loadCorrecciones(); // Recarga la lista
    } catch (e) {
         if (e?.response?.status === 409) { // Conflicto por solicitud pendiente
           enqueueSnackbar(e?.response?.data || "Conflicto: Ya tienes una solicitud pendiente para esa fecha/tipo.", { variant: "error" });
         } else {
           enqueueSnackbar(e?.response?.data || "Error al enviar la solicitud.", { variant: "error" });
         }
    } finally {
      setSaving(false);
    }
  };

  // Maneja la eliminación de una solicitud (ej. solo pendientes o rechazadas)
  const handleDelete = async (correccion) => {
    // Regla: Solo permitir borrar si está pendiente o rechazada
    if (correccion.estado !== 'pendiente' && correccion.estado !== 'rechazada') {
        enqueueSnackbar("Solo puedes eliminar solicitudes pendientes o rechazadas.", { variant: "info" });
        return;
    }

    if (!confirm(`¿Eliminar la solicitud de corrección para el ${formatDate(correccion.fecha)} a las ${formatTime(correccion.horaSolicitada)}?`)) return;

    setDeletingId(correccion.id);
    try {
      await borrarCorreccion(correccion.id);
      enqueueSnackbar("Solicitud eliminada.", { variant: "success" });
      setCorrecciones(prev => prev.filter(c => c.id !== correccion.id));
    } catch (e) {
      enqueueSnackbar(e?.response?.data || "Error al eliminar la solicitud.", { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={800}>Mis Solicitudes de Corrección</Typography>

        {/* Formulario para Nueva Solicitud */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Crear Nueva Solicitud de Corrección</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6} sm={3} md={2}>
              <DatePicker
                label="Fecha *"
                value={fecha}
                onChange={setFecha}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                disableFuture // No solicitar correcciones futuras
                disabled={saving}
                maxDate={dayjs()} // Máximo hoy
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                    <InputLabel id="tipo-correccion-label">Tipo *</InputLabel>
                    <Select
                        labelId="tipo-correccion-label"
                        value={tipo}
                        label="Tipo *"
                        onChange={(e) => setTipo(e.target.value)}
                        disabled={saving}
                    >
                        <MenuItem value="entrada">Entrada</MenuItem>
                        <MenuItem value="salida">Salida</MenuItem>
                    </Select>
               </FormControl>
            </Grid>
             <Grid item xs={6} sm={3} md={2}>
                <TimePicker
                    label="Hora Solicitada *"
                    value={horaSolicitada}
                    onChange={setHoraSolicitada}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    ampm={false} // Formato 24h
                    disabled={saving}
                 />
            </Grid>
            <Grid item xs={12} sm={9} md={4}>
              <TextField
                label="Motivo / Justificación *"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={1}
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={saving || !fecha || !tipo || !horaSolicitada || !motivo.trim() || loading}
                startIcon={saving ? <CircularProgress size={20} color="inherit"/> : <AddIcon />}
                fullWidth
              >
                Enviar Solicitud
              </Button>
            </Grid>
          </Grid>
           <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
               Solicita la corrección para una marcación olvidada o incorrecta. Tu supervisor la revisará.
           </Typography>
        </Paper>

        {/* Lista de Correcciones del Usuario */}
        <Paper>
           <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
             <Typography variant="h6">Mis Solicitudes</Typography>
             <Tooltip title="Refrescar Lista">
                 <span>
                    <IconButton onClick={loadCorrecciones} disabled={loading}>
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
                  <TableCell>Fecha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Hora Solicitada</TableCell>
                  <TableCell>Motivo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Solicitado El</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                )}
                {!loading && correcciones.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>No tienes solicitudes de corrección.</TableCell></TableRow>
                )}
                {!loading && correcciones.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{formatDate(c.fecha)}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{c.tipo}</TableCell>
                    <TableCell>{formatTime(c.horaSolicitada)}</TableCell>
                     <TableCell>
                      <Tooltip title={c.motivo || ""}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           {c.motivo || "-"}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.estado}
                        color={getStatusColor(c.estado)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>{dayjs(c.createdAt).format("DD/MM/YYYY HH:mm")}</TableCell>
                    <TableCell align="right">
                      {/* Mostrar botón de borrar solo si está pendiente o rechazada */}
                      {(c.estado === 'pendiente' || c.estado === 'rechazada') && (
                        <Tooltip title="Eliminar Solicitud">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(c)}
                              disabled={deletingId === c.id}
                            >
                              {deletingId === c.id ? <CircularProgress size={20} color="inherit"/> : <DeleteForeverIcon fontSize="small"/>}
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
           {/* Podrías añadir paginación si el usuario puede tener muchas correcciones */}
        </Paper>

      </Stack>
    </LocalizationProvider>
  );
}