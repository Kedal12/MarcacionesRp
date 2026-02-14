// src/pages/MisCorrecciones.jsx
import { useState, useMemo, memo, useCallback } from "react";
import {
  Paper, Stack, Typography, Button, IconButton, Chip, Box, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Grid, Select, MenuItem, FormControl, InputLabel, Skeleton,
  Collapse, Tooltip, Fade
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ReplayIcon from "@mui/icons-material/Replay";
import SendIcon from "@mui/icons-material/Send";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { LocalizationProvider, DatePicker, TimePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useAuth } from "../auth/AuthContext";
import { useGestionCorrecciones } from "../hooks/useCorrecciones";
import { useUsuariosSimple } from "../hooks/useUsuarios";

dayjs.extend(utc);

// ════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ════════════════════════════════════════════════════════════════════════════
const formatDate = (date) => {
  if (!date) return "-";
  // Manejar tanto formato ISO como YYYY-MM-DD
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "-";
};

const formatTime = (time) => {
  if (!time) return "-";
  // Manejar formato HH:mm:ss
  return time.split(':').slice(0, 2).join(':');
};

const getStatusConfig = (status, isOptimistic) => {
  if (isOptimistic) {
    return { label: "Enviando...", color: "default", variant: "outlined" };
  }
  const configs = {
    aprobada: { label: "Aprobada", color: "success", variant: "filled" },
    rechazada: { label: "Rechazada", color: "error", variant: "filled" },
    pendiente: { label: "Pendiente", color: "warning", variant: "filled" },
  };
  return configs[status?.toLowerCase()] || { label: status, color: "default", variant: "filled" };
};

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTES MEMOIZADOS
// ════════════════════════════════════════════════════════════════════════════

// Skeleton para la tabla mientras carga
const TableSkeleton = memo(({ rows = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton animation="wave" /></TableCell>
        <TableCell><Skeleton animation="wave" width={60} /></TableCell>
        <TableCell><Skeleton animation="wave" width={50} /></TableCell>
        <TableCell><Skeleton animation="wave" width={80} /></TableCell>
        <TableCell align="right"><Skeleton animation="wave" width={40} /></TableCell>
      </TableRow>
    ))}
  </>
));

// Fila de la tabla memoizada
const CorreccionRow = memo(({ correccion, onDelete, canDelete }) => {
  const statusConfig = getStatusConfig(correccion.estado, correccion.isOptimistic);
  
  return (
    <Fade in timeout={300}>
      <TableRow
        hover
        sx={{
          opacity: correccion.isOptimistic ? 0.6 : 1,
          transition: 'all 0.3s ease',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        <TableCell>{formatDate(correccion.fecha)}</TableCell>
        <TableCell sx={{ textTransform: 'capitalize' }}>{correccion.tipo}</TableCell>
        <TableCell>{formatTime(correccion.horaSolicitada)}</TableCell>
        <TableCell>
          <Chip
            label={statusConfig.label}
            color={statusConfig.color}
            size="small"
            variant={statusConfig.variant}
            sx={{ minWidth: 85 }}
          />
        </TableCell>
        <TableCell align="right">
          {canDelete && !correccion.isOptimistic && (
            <Tooltip title="Eliminar solicitud">
              <IconButton
                color="error"
                size="small"
                onClick={() => onDelete(correccion.id)}
              >
                <DeleteForeverIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>
    </Fade>
  );
});

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function MisCorrecciones() {
const { user } = useAuth();
  const isAdmin = useMemo(() => 
    user?.rol === 'admin' || user?.rol === 'superadmin', 
    [user?.rol]
  );
// Hook de gestión
  const {
    correcciones, isLoading, isFetching, error, refetch, crearAsync, isCreating, borrarAsync,
  } = useGestionCorrecciones();

// ✅ 1. Hook de usuarios (Pasamos el idSede para que el backend filtre)
  const { data: usuariosData, isLoading: loadingUsers } = useUsuariosSimple({ 
    enabled: isAdmin,
    idSede: user?.idSede 
  });

  const listaUsuarios = useMemo(() => {
    if (!isAdmin || !usuariosData) return [];
    // Normalizamos si viene como .items o array directo
    const lista = Array.isArray(usuariosData) ? usuariosData : (usuariosData.items || []);
    return lista.filter(u => u.activo === true);
  }, [usuariosData, isAdmin]);

// Estados del formulario
  const [fecha, setFecha] = useState(null);
  const [tipo, setTipo] = useState("entrada");
  const [hora, setHora] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [formExpanded, setFormExpanded] = useState(true);

  // Validación del formulario
  const isFormValid = useMemo(() => 
    fecha && hora && motivo.trim().length > 0,
    [fecha, hora, motivo]
  );

  // Handler de creación
  const handleCreate = useCallback(async () => {
    if (!isFormValid) return;
    
    try {
      await crearAsync({
        fecha: dayjs(fecha).format("YYYY-MM-DD"),
        tipo,
        horaSolicitada: dayjs(hora).format("HH:mm"),
        motivo: motivo.trim(),
        idUsuario: selectedUser ? Number(selectedUser) : null,
      });
      // Limpiar formulario
      setFecha(null);
      setHora(null);
      setMotivo("");
      setSelectedUser("");
    } catch {
      // Error manejado por el hook
    }
  }, [isFormValid, crearAsync, fecha, tipo, hora, motivo, selectedUser]);

  // Handler de eliminación
  const handleDelete = useCallback((id) => {
    borrarAsync(id);
  }, [borrarAsync]);

  // Determinar si se puede eliminar
  const canDelete = useCallback((correccion) => {
    return correccion.estado === 'pendiente' || correccion.estado === 'rechazada';
  }, []);

return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={700}>
          {isAdmin ? "Gestión de Correcciones de Sede" : "Mis Solicitudes de Corrección"}
        </Typography>

        <Paper sx={{ overflow: 'hidden' }}>
          <Box
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: formExpanded ? 1 : 0,
              borderColor: 'divider',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => setFormExpanded(!formExpanded)}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Nueva Solicitud
            </Typography>
            <IconButton size="small">
              {formExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={formExpanded}>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                {isAdmin && (
                  <Grid item xs={12}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Solicitar Para (Empleado de mi Sede)</InputLabel>
                      <Select
                        value={selectedUser}
                        label="Solicitar Para (Empleado de mi Sede)"
                        onChange={(e) => setSelectedUser(e.target.value)}
                        disabled={loadingUsers} // ✅ Deshabilitar mientras carga
                      >
                        <MenuItem value="">
                          <em>— Para mí mismo —</em>
                        </MenuItem>
                        {/* ✅ Ahora listaUsuarios está definida */}
                        {listaUsuarios.map((u) => (
                          <MenuItem key={u.id} value={u.id}>
                            {u.nombreCompleto} ({u.numeroDocumento})
                          </MenuItem>
                        ))}
                      </Select>
                      {loadingUsers && <Typography variant="caption">Cargando empleados...</Typography>}
                    </FormControl>
                  </Grid>
                )}
                
                {/* Fecha */}
                <Grid item xs={6} sm={3} md={2}>
                  <DatePicker
                    label="Fecha *"
                    value={fecha}
                    onChange={setFecha}
                    maxDate={dayjs()}
                    slotProps={{
                      textField: { size: 'small', fullWidth: true },
                    }}
                  />
                </Grid>

                {/* Tipo */}
                <Grid item xs={6} sm={3} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tipo *</InputLabel>
                    <Select
                      value={tipo}
                      label="Tipo *"
                      onChange={(e) => setTipo(e.target.value)}
                    >
                      <MenuItem value="entrada">Entrada</MenuItem>
                      <MenuItem value="salida">Salida</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Hora */}
                <Grid item xs={6} sm={3} md={2}>
                  <TimePicker
                    label="Hora *"
                    value={hora}
                    onChange={setHora}
                    ampm={false}
                    slotProps={{
                      textField: { size: 'small', fullWidth: true },
                    }}
                  />
                </Grid>

                {/* Motivo */}
                <Grid item xs={12} sm={9} md={4}>
                  <TextField
                    label="Motivo *"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="Ej: Olvidé marcar entrada"
                  />
                </Grid>

                {/* Botón enviar */}
                <Grid item xs={12} sm={3} md={2}>
                  <Button
                    variant="contained"
                    onClick={handleCreate}
                    disabled={isCreating || !isFormValid}
                    fullWidth
                    startIcon={<SendIcon />}
                    sx={{ height: 40 }}
                  >
                    {isCreating ? "Enviando..." : "Enviar"}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Paper>

        {/* Tabla de solicitudes */}
        <Paper>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Historial de Solicitudes
              {correcciones.length > 0 && (
                <Chip
                  label={correcciones.length}
                  size="small"
                  sx={{ ml: 1, fontSize: '0.75rem' }}
                />
              )}
            </Typography>
            <Tooltip title="Actualizar">
              <IconButton
                onClick={() => refetch()}
                disabled={isFetching}
                sx={{
                  animation: isFetching ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              >
                <ReplayIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
              {error?.message || "Error al cargar solicitudes"}
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Hora</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton rows={5} />
                ) : correcciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No tienes solicitudes de corrección
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  correcciones.map((c) => (
                    <CorreccionRow
                      key={c.id}
                      correccion={c}
                      onDelete={handleDelete}
                      canDelete={canDelete(c)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </LocalizationProvider>
  );
}
