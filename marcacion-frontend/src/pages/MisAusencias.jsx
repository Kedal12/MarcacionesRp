// src/pages/MisAusencias.jsx
import { useState, useMemo, memo, useCallback } from "react";
import {
  Paper, Stack, Typography, Button, IconButton, Chip, Box, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Grid, Select, MenuItem, FormControl, InputLabel, Skeleton,
  Collapse, Tooltip, Fade, Autocomplete
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ReplayIcon from "@mui/icons-material/Replay";
import SendIcon from "@mui/icons-material/Send";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useAuth } from "../auth/AuthContext";
import { useGestionAusencias } from "../hooks/useAusencias";
import { useUsuariosSimple } from "../hooks/useUsuarios"; // CAMBIO: Usamos el hook de usuarios general

dayjs.extend(utc);

const TIPOS_AUSENCIA = [
  { value: "vacaciones", label: "Vacaciones" },
  { value: "enfermedad", label: "Enfermedad" },
  { value: "permiso personal", label: "Permiso Personal" },
  { value: "incapacidad", label: "Incapacidad" },
  { value: "cita médica", label: "Cita Médica" },
  { value: "calamidad", label: "Calamidad Doméstica" },
  { value: "otro", label: "Otro" },
];

const formatDate = (date) => {
  if (!date) return "-";
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "-";
};

const getStatusConfig = (status, isOptimistic) => {
  if (isOptimistic) return { label: "Enviando...", color: "default", variant: "outlined" };
  const configs = {
    aprobada: { label: "Aprobada", color: "success", variant: "filled" },
    rechazada: { label: "Rechazada", color: "error", variant: "filled" },
    pendiente: { label: "Pendiente", color: "warning", variant: "filled" },
  };
  return configs[status?.toLowerCase()] || { label: status, color: "default", variant: "filled" };
};

const calcularDias = (desde, hasta) => {
  if (!desde || !hasta) return 0;
  const diff = dayjs(hasta).diff(dayjs(desde), 'day') + 1;
  return diff > 0 ? diff : 0;
};

const TableSkeleton = memo(({ rows = 5, columns = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: columns }).map((_, j) => (
          <TableCell key={j}><Skeleton animation="wave" /></TableCell>
        ))}
      </TableRow>
    ))}
  </>
));

const AusenciaRow = memo(({ ausencia, onDelete, canDelete }) => {
  const statusConfig = getStatusConfig(ausencia.estado, ausencia.isOptimistic);
  const dias = calcularDias(ausencia.desde, ausencia.hasta);
  return (
    <Fade in timeout={300}>
      <TableRow hover sx={{ opacity: ausencia.isOptimistic ? 0.6 : 1, transition: 'all 0.3s ease' }}>
        <TableCell sx={{ textTransform: 'capitalize' }}>{ausencia.tipo}</TableCell>
        <TableCell>{formatDate(ausencia.desde)}</TableCell>
        <TableCell>{formatDate(ausencia.hasta)}</TableCell>
        <TableCell align="center">
          <Chip label={`${dias} día${dias !== 1 ? 's' : ''}`} size="small" variant="outlined" sx={{ minWidth: 60 }} />
        </TableCell>
        <TableCell>
          <Chip label={statusConfig.label} color={statusConfig.color} size="small" variant={statusConfig.variant} sx={{ minWidth: 85 }} />
        </TableCell>
        <TableCell align="right">
          {canDelete && !ausencia.isOptimistic && (
            <Tooltip title="Eliminar solicitud">
              <IconButton color="error" size="small" onClick={() => onDelete(ausencia.id)}><DeleteForeverIcon fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>
    </Fade>
  );
});

export default function MisAusencias() {
  const { user } = useAuth();
  
  // 1. Definición de roles
  const isAdmin = useMemo(() => 
    user?.rol === 'admin' || user?.rol === 'superadmin', 
    [user?.rol]
  );

  // 2. Hook de gestión de ausencias
  const {
    ausencias, isLoading, isFetching, error, refetch, crearAsync, isCreating, borrarAsync,
  } = useGestionAusencias();

  // 3. Hook de usuarios - LLAMADA INCONDICIONAL
  // Usamos useUsuariosSimple que es más robusto para esta tarea
  const { data: usuariosData, isLoading: loadingUsers } = useUsuariosSimple({
    enabled: true, // Siempre habilitado para mantener la cuenta de hooks constante
    idSede: user?.idSede
  });

  // 4. Filtrado de usuarios activos (Lógica de Almacenes La Media Naranja)
  const usuariosActivos = useMemo(() => {
    if (!isAdmin || !usuariosData?.items) return [];
    return usuariosData.items.filter(u => u.activo === true); // Filtramos solo activos
  }, [usuariosData, isAdmin]);

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState(null);
  const [hasta, setHasta] = useState(null);
  const [observacion, setObservacion] = useState("");
  const [formExpanded, setFormExpanded] = useState(true);

  const isFormValid = useMemo(() => {
    if (!tipo || !desde || !hasta) return false;
    if (dayjs(hasta).isBefore(dayjs(desde))) return false;
    if (isAdmin && !usuarioSeleccionado) return false;
    return true;
  }, [tipo, desde, hasta, isAdmin, usuarioSeleccionado]);

  const diasCalculados = useMemo(() => calcularDias(desde, hasta), [desde, hasta]);

  const handleCreate = useCallback(async () => {
    if (!isFormValid) return;
    try {
      await crearAsync({
        idUsuario: isAdmin && usuarioSeleccionado ? usuarioSeleccionado.id : null,
        tipo,
        desde: dayjs(desde).format("YYYY-MM-DD"),
        hasta: dayjs(hasta).format("YYYY-MM-DD"),
        observacion: observacion.trim() || null,
      });
      setTipo(""); setDesde(null); setHasta(null); setObservacion(""); setUsuarioSeleccionado(null);
    } catch (err) { console.error("Error:", err); }
  }, [isFormValid, crearAsync, isAdmin, usuarioSeleccionado, tipo, desde, hasta, observacion]);

  const handleDelete = useCallback((id) => { borrarAsync(id); }, [borrarAsync]);
  const canDelete = useCallback((ausencia) => {
    if (isAdmin) return true;
    return ausencia.estado === 'pendiente' || ausencia.estado === 'rechazada';
  }, [isAdmin]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={700}>
          {isAdmin ? "Gestión de Ausencias" : "Mis Solicitudes de Ausencia"}
        </Typography>

        <Paper sx={{ overflow: 'hidden' }}>
          <Box
            sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: formExpanded ? 1 : 0, borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setFormExpanded(!formExpanded)}
          >
            <Typography variant="subtitle1" fontWeight={600}>Nueva Solicitud</Typography>
            <IconButton size="small">{formExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
          </Box>

          <Collapse in={formExpanded}>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                {isAdmin && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Autocomplete
                      options={usuariosActivos}
                      getOptionLabel={(opt) => `${opt.nombreCompleto} (${opt.numeroDocumento})`}
                      value={usuarioSeleccionado}
                      onChange={(_, val) => setUsuarioSeleccionado(val)}
                      loading={loadingUsers}
                      renderInput={(params) => (
                        <TextField {...params} label="Usuario *" size="small" placeholder="Buscar usuario activo..." />
                      )}
                    />
                  </Grid>
                )}

                <Grid item xs={12} sm={isAdmin ? 3 : 4} md={isAdmin ? 2 : 3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tipo *</InputLabel>
                    <Select value={tipo} label="Tipo *" onChange={(e) => setTipo(e.target.value)}>
                      {TIPOS_AUSENCIA.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6} sm={3} md={2}>
                  <DatePicker label="Desde *" value={desde} onChange={(val) => { setDesde(val); if (hasta && dayjs(val).isAfter(dayjs(hasta))) setHasta(val); }} slotProps={{ textField: { size: 'small', fullWidth: true } }} />
                </Grid>

                <Grid item xs={6} sm={3} md={2}>
                  <DatePicker label="Hasta *" value={hasta} onChange={setHasta} minDate={desde} slotProps={{ textField: { size: 'small', fullWidth: true } }} />
                </Grid>

                {diasCalculados > 0 && (
                  <Grid item xs={12} sm={2} md={1}>
                    <Chip icon={<EventBusyIcon />} label={`${diasCalculados} día${diasCalculados !== 1 ? 's' : ''}`} color="primary" variant="outlined" size="small" />
                  </Grid>
                )}

                <Grid item xs={12} sm={isAdmin ? 6 : 8} md={isAdmin ? 4 : 3}>
                  <TextField label="Observación" value={observacion} onChange={(e) => setObservacion(e.target.value)} fullWidth size="small" />
                </Grid>

                <Grid item xs={12} sm={3} md={2}>
                  <Button variant="contained" onClick={handleCreate} disabled={isCreating || !isFormValid} fullWidth startIcon={<SendIcon />} sx={{ height: 40 }}>
                    {isCreating ? "Enviando..." : "Enviar"}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Paper>

        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{isAdmin ? "Solicitudes de la Sede" : "Mis Solicitudes"}{ausencias.length > 0 && <Chip label={ausencias.length} size="small" sx={{ ml: 1 }} />}</Typography>
            <IconButton onClick={() => refetch()} disabled={isFetching}><ReplayIcon sx={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} /></IconButton>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Desde</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Hasta</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Días</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? <TableSkeleton rows={5} /> : ausencias.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No hay solicitudes registradas</Typography></TableCell></TableRow>
                ) : (
                  ausencias.map((a) => <AusenciaRow key={a.id} ausencia={a} onDelete={handleDelete} canDelete={canDelete(a)} />)
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </LocalizationProvider>
  );
}