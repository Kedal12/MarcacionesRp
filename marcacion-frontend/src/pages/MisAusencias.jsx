import { useEffect, useState, useMemo } from "react";
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, Button, IconButton, Chip, Box, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  TextField, Grid, Select, MenuItem, FormControl, InputLabel, Autocomplete
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import ReplayIcon from "@mui/icons-material/Replay";
import PersonIcon from "@mui/icons-material/Person";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import { useAuth } from "../auth/AuthContext";
import { getMisAusencias, crearAusencia, borrarAusencia, getUsuariosSede, listarAusencias } from "../api/ausencias";

dayjs.extend(utc);

const formatDate = (dateOnlyString) => {
  if (!dateOnlyString) return "-";
  return dayjs.utc(dateOnlyString).format("DD/MM/YYYY");
};

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'aprobada': return 'success';
    case 'rechazada': return 'error';
    case 'pendiente': return 'warning';
    default: return 'default';
  }
};

const tiposAusencia = [
  "Vacaciones", 
  "Enfermedad", 
  "Permiso Personal", 
  "Licencia Maternidad/Paternidad", 
  "Incapacidad", 
  "Cita Médica",
  "Calamidad Doméstica",
  "Otro"
];

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  EMPLEADO: "empleado"
};

export default function MisAusencias() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  // ✅ Verificar si es admin o superadmin
  const isAdmin = useMemo(() => 
    user?.rol === ROLES.ADMIN || user?.rol === ROLES.SUPERADMIN, 
    [user]
  );

  const [ausencias, setAusencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // ✅ NUEVO: Lista de usuarios para el selector (solo admins)
  const [usuariosSede, setUsuariosSede] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  // Estados para el formulario
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null); // ✅ NUEVO
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState(null);
  const [hasta, setHasta] = useState(null);
  const [observacion, setObservacion] = useState("");

  // ✅ NUEVO: Cargar usuarios de la sede si es admin
  useEffect(() => {
    if (isAdmin) {
      setLoadingUsuarios(true);
      getUsuariosSede()
        .then(data => {
          setUsuariosSede(data || []);
          // Pre-seleccionar al usuario logueado
          const usuarioActual = data?.find(u => u.id === parseInt(user?.id));
          if (usuarioActual) {
            setUsuarioSeleccionado(usuarioActual);
          }
        })
        .catch(e => {
          console.error("Error cargando usuarios:", e);
          enqueueSnackbar("Error cargando lista de usuarios", { variant: "error" });
        })
        .finally(() => setLoadingUsuarios(false));
    }
  }, [isAdmin, user?.id, enqueueSnackbar]);

  // Cargar ausencias
  const loadAusencias = () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    // Si es admin, cargar todas las ausencias de la sede
    // Si es empleado, cargar solo las suyas
    const fetchAusencias = isAdmin 
      ? listarAusencias({}) // Admin ve todas de su sede
      : getMisAusencias(user.id); // Empleado ve solo las suyas

    fetchAusencias
      .then(setAusencias)
      .catch(e => {
        setError(e?.response?.data || e.message || "Error cargando ausencias");
        setAusencias([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAusencias();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  const clearForm = () => {
    setTipo("");
    setDesde(null);
    setHasta(null);
    setObservacion("");
    // No limpiar usuarioSeleccionado para facilitar múltiples creaciones
  };

  const handleCreate = async () => {
    if (!tipo || !desde || !hasta) {
      enqueueSnackbar("Selecciona tipo, fecha 'Desde' y fecha 'Hasta'.", { variant: "warning" });
      return;
    }
    if (dayjs(hasta).isBefore(dayjs(desde))) {
      enqueueSnackbar("La fecha 'Hasta' no puede ser anterior a la fecha 'Desde'.", { variant: "warning" });
      return;
    }

    // ✅ NUEVO: Si es admin y seleccionó un usuario, usar ese ID
    const idUsuarioDestino = isAdmin && usuarioSeleccionado 
      ? usuarioSeleccionado.id 
      : null;

    setSaving(true);
    const dto = {
      idUsuario: idUsuarioDestino, // ✅ NUEVO
      tipo: tipo,
      desde: desde,
      hasta: hasta,
      observacion: observacion
    };

    try {
      await crearAusencia(dto);
      
      // Mensaje de éxito
      const nombreUsuario = usuarioSeleccionado?.nombreCompleto || "";
      const esParaOtroUsuario = idUsuarioDestino && idUsuarioDestino !== parseInt(user?.id);
      
      if (esParaOtroUsuario) {
        enqueueSnackbar(`Ausencia registrada para ${nombreUsuario}. Pendiente de aprobación.`, { variant: "success" });
      } else {
        enqueueSnackbar("Solicitud de ausencia enviada. Pendiente de aprobación.", { variant: "success" });
      }
      
      clearForm();
      loadAusencias();
    } catch (e) {
      if (e?.response?.status === 409) {
        enqueueSnackbar(e?.response?.data || "Conflicto: Las fechas se solapan con otra solicitud.", { variant: "error" });
      } else {
        enqueueSnackbar(e?.response?.data || "Error al enviar la solicitud.", { variant: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ausencia) => {
    // Empleados solo pueden borrar sus propias pendientes/rechazadas
    // Admins pueden borrar cualquiera de su sede
    if (!isAdmin && ausencia.estado !== 'pendiente' && ausencia.estado !== 'rechazada') {
      enqueueSnackbar("Solo puedes eliminar solicitudes pendientes o rechazadas.", { variant: "info" });
      return;
    }

    const nombreUsuario = ausencia.nombreUsuario || "este usuario";
    if (!confirm(`¿Eliminar la ausencia de ${nombreUsuario} (${ausencia.tipo}) del ${formatDate(ausencia.desde)} al ${formatDate(ausencia.hasta)}?`)) return;

    setDeletingId(ausencia.id);
    try {
      await borrarAusencia(ausencia.id);
      enqueueSnackbar("Solicitud eliminada.", { variant: "success" });
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
        <Typography variant="h5" fontWeight={800}>
          {isAdmin ? "Gestión de Ausencias" : "Mis Solicitudes de Ausencia"}
        </Typography>

        {/* Formulario para Nueva Solicitud */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            {isAdmin ? "Registrar Nueva Ausencia" : "Crear Nueva Solicitud"}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            
            {/* ✅ NUEVO: Selector de Usuario (solo para admins) */}
            {isAdmin && (
              <Grid item xs={12} sm={4}>
                <Autocomplete
                  options={usuariosSede}
                  getOptionLabel={(option) => `${option.nombreCompleto} (${option.numeroDocumento})`}
                  value={usuarioSeleccionado}
                  onChange={(_, newValue) => setUsuarioSeleccionado(newValue)}
                  loading={loadingUsuarios}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Usuario *"
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <PersonIcon color="action" sx={{ mr: 1 }} />
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  disabled={saving || loadingUsuarios}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={isAdmin ? 2 : 3}>
              <FormControl fullWidth size="small">
                <InputLabel id="tipo-ausencia-label">Tipo *</InputLabel>
                <Select
                  labelId="tipo-ausencia-label"
                  value={tipo}
                  label="Tipo *"
                  onChange={(e) => setTipo(e.target.value)}
                  disabled={saving}
                >
                  {tiposAusencia.map(t => (
                    <MenuItem key={t} value={t.toLowerCase()}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={2}>
              <DatePicker
                label="Desde *"
                value={desde}
                onChange={setDesde}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                disabled={saving}
              />
            </Grid>

            <Grid item xs={6} sm={2}>
              <DatePicker
                label="Hasta *"
                value={hasta}
                onChange={setHasta}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                minDate={desde || undefined}
                disabled={saving}
              />
            </Grid>

            <Grid item xs={12} sm={isAdmin ? 4 : 3}>
              <TextField
                label="Observación (Opcional)"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                fullWidth
                size="small"
                disabled={saving}
              />
            </Grid>

            <Grid item xs={12} sm={2}>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={saving || !tipo || !desde || !hasta || loading || (isAdmin && !usuarioSeleccionado)}
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                fullWidth
              >
                {isAdmin ? "Registrar" : "Enviar"}
              </Button>
            </Grid>
          </Grid>

          {/* Nota informativa para admins */}
          {isAdmin && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Las ausencias quedan en estado <strong>Pendiente</strong> hasta que RRHH las apruebe.
              </Typography>
            </Alert>
          )}
        </Paper>

        {/* Lista de Ausencias */}
        <Paper>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">
              {isAdmin ? "Ausencias de la Sede" : "Mis Solicitudes"}
            </Typography>
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
                  {/* ✅ Mostrar columna Usuario solo para admins */}
                  {isAdmin && <TableCell>Usuario</TableCell>}
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
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && ausencias.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No hay solicitudes de ausencia.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && ausencias.map((a) => (
                  <TableRow key={a.id} hover>
                    {/* ✅ Mostrar nombre de usuario solo para admins */}
                    {isAdmin && <TableCell>{a.nombreUsuario || "N/A"}</TableCell>}
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
                      {/* Admins pueden borrar cualquier ausencia, empleados solo pendientes/rechazadas propias */}
                      {(isAdmin || a.estado === 'pendiente' || a.estado === 'rechazada') && (
                        <Tooltip title="Eliminar">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(a)}
                              disabled={deletingId === a.id}
                            >
                              {deletingId === a.id ? <CircularProgress size={20} color="inherit" /> : <DeleteForeverIcon fontSize="small" />}
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
        </Paper>
      </Stack>
    </LocalizationProvider>
  );
}