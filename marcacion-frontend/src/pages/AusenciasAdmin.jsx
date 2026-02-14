// src/pages/AusenciasAdmin.jsx
import { useState, useMemo, memo, useCallback } from "react";
import {
  Paper, Stack, Typography, IconButton, Chip, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Grid, Select, MenuItem, FormControl, InputLabel, Skeleton, Box, Fade,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress
} from "@mui/material";

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import ReplayIcon from "@mui/icons-material/Replay";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/es";

// Hooks de datos
import {
  useAusencias,
  useAprobarAusencia,
  useRechazarAusencia,
  useBorrarAusencia
} from "../hooks/useAusencias";
import { useSedesAll } from "../hooks/useSedes";
import { useAuth } from "../auth/AuthContext";

// ────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ────────────────────────────────────────────────────────────────────────────
dayjs.locale("es");

const formatDate = (date) => {
  if (!date) return "-";
  return dayjs(date).format("DD/MM/YYYY");
};

const calcularDias = (desde, hasta) => {
  if (!desde || !hasta) return 0;
  const diff = dayjs(hasta).diff(dayjs(desde), "day") + 1;
  return diff > 0 ? diff : 0;
};

const getStatusConfig = (status) => {
  const s = status?.toLowerCase();
  const configs = {
    aprobada: { label: "Aprobada", color: "success" },
    rechazada: { label: "Rechazada", color: "error" },
    pendiente: { label: "Pendiente", color: "warning" },
  };
  return configs[s] || { label: status || "-", color: "default" };
};

const getTipoLabel = (tipo) => {
  const t = tipo?.toLowerCase();
  const tipos = {
    vacaciones: "Vacaciones",
    enfermedad: "Enfermedad",
    "permiso personal": "Permiso Personal",
    incapacidad: "Incapacidad",
    "cita médica": "Cita Médica",
    calamidad: "Calamidad",
    otro: "Otro",
  };
  return tipos[t] || tipo || "-";
};

const getUserName = (a) =>
  a?.nombreUsuario || a?.usuarioNombre || a?.usuario?.nombre || "—";

const getSedeName = (a) =>
  a?.sedeNombre || a?.sede?.nombre || "N/A";

const normalizeSedes = (sedesData) =>
  Array.isArray(sedesData) ? sedesData : (sedesData?.items || []);

// ────────────────────────────────────────────────────────────────────────────
const TableSkeleton = memo(({ rows = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton animation="wave" /></TableCell>
        <TableCell><Skeleton animation="wave" width={120} /></TableCell>
        <TableCell><Skeleton animation="wave" width={90} /></TableCell>
        <TableCell><Skeleton animation="wave" width={90} /></TableCell>
        <TableCell><Skeleton animation="wave" width={80} /></TableCell>
        <TableCell align="right"><Skeleton animation="wave" width={120} /></TableCell>
      </TableRow>
    ))}
  </>
));

const AusenciaRow = memo(
  ({ ausencia, onAprobar, onRechazar, onBorrar, onVerDetalle, isProcessing }) => {
    const statusConfig = getStatusConfig(ausencia?.estado);
    const isPendiente = (ausencia?.estado || "").toLowerCase() === "pendiente";

    return (
      <Fade in timeout={300}>
        <TableRow hover>
          <TableCell>
            <Typography variant="body2" fontWeight={500}>
              {getUserName(ausencia)}
            </Typography>
          </TableCell>

          <TableCell>
            {getSedeName(ausencia)}
          </TableCell>

          <TableCell sx={{ textTransform: "capitalize" }}>
            {getTipoLabel(ausencia?.tipo)}
          </TableCell>

          <TableCell>{formatDate(ausencia?.desde)}</TableCell>
          <TableCell>{formatDate(ausencia?.hasta)}</TableCell>

          <TableCell>
            <Chip
              label={statusConfig.label}
              color={statusConfig.color}
              size="small"
              sx={{ minWidth: 90 }}
            />
          </TableCell>

          <TableCell align="right">
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Tooltip title="Ver detalles">
                <IconButton size="small" onClick={() => onVerDetalle(ausencia)}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {isPendiente && (
                <>
                  <Tooltip title="Aprobar">
                    <IconButton
                      color="success"
                      size="small"
                      onClick={() => onAprobar(ausencia?.id)}
                      disabled={isProcessing}
                    >
                      <CheckCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Rechazar">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => onRechazar(ausencia?.id)}
                      disabled={isProcessing}
                    >
                      <HighlightOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}

              <Tooltip title="Eliminar">
                <IconButton
                  size="small"
                  onClick={() => onBorrar(ausencia?.id)}
                  disabled={isProcessing}
                >
                  <DeleteForeverIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </TableCell>
        </TableRow>
      </Fade>
    );
  }
);

// ────────────────────────────────────────────────────────────────────────────
const DetalleModal = memo(({ ausencia, open, onClose }) => {
  if (!ausencia) return null;

  const dias = calcularDias(ausencia?.desde, ausencia?.hasta);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Detalle de Ausencia</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Usuario</Typography>
            <Typography variant="body1">{getUserName(ausencia)}</Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Estado</Typography>
            <Box>
              <Chip
                label={ausencia?.estado || "-"}
                color={getStatusConfig(ausencia?.estado).color}
                size="small"
              />
            </Box>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Sede</Typography>
            <Typography variant="body1">{getSedeName(ausencia)}</Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Tipo</Typography>
            <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
              {getTipoLabel(ausencia?.tipo)}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Duración</Typography>
            <Typography variant="body1">
              {dias} día{dias !== 1 ? "s" : ""}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Fecha de solicitud</Typography>
            <Typography variant="body1">
              {ausencia?.createdAt ? dayjs(ausencia.createdAt).format("DD/MM/YYYY HH:mm") : "-"}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Desde</Typography>
            <Typography variant="body1">{formatDate(ausencia?.desde)}</Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Hasta</Typography>
            <Typography variant="body1">{formatDate(ausencia?.hasta)}</Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">Observación</Typography>
            <Typography variant="body1">{ausencia?.observacion || "-"}</Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ────────────────────────────────────────────────────────────────────────────
export default function AusenciasAdmin() {
  // Auth y permisos
  const { user: currentUser } = useAuth();
  const isSuperAdmin = useMemo(() => currentUser?.rol === "superadmin", [currentUser]);

  // Filtros
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [detalleModal, setDetalleModal] = useState({ open: false, data: null });

  // Parametros para consulta
  const queryParams = useMemo(
    () => ({
      idSede: filtroSede || undefined,
      estado: filtroEstado || undefined,
    }),
    [filtroSede, filtroEstado]
  );

  // Data
  const { data: ausencias, isLoading, isFetching, error, refetch } = useAusencias(queryParams);
  const { data: sedesData, isLoading: loadingSedes } = useSedesAll();
  const sedesList = useMemo(() => normalizeSedes(sedesData), [sedesData]);

  // Mutaciones
  const aprobar = useAprobarAusencia();
  const rechazar = useRechazarAusencia();
  const borrar = useBorrarAusencia();

  const isProcessing = aprobar.isPending || rechazar.isPending || borrar.isPending;

  // Handlers
  const handleAprobar = useCallback((id) => {
    if (!id) return;
    aprobar.mutate(id);
  }, [aprobar]);

  const handleRechazar = useCallback((id) => {
    if (!id) return;
    rechazar.mutate(id);
  }, [rechazar]);

  const handleBorrar = useCallback((id) => {
    if (!id) return;
    borrar.mutate(id);
  }, [borrar]);

  const handleVerDetalle = useCallback((ausencia) => {
    setDetalleModal({ open: true, data: ausencia });
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={700}>
            Gestión de Ausencias (RRHH)
          </Typography>

          <Tooltip title="Actualizar">
            <IconButton
              onClick={() => refetch()}
              disabled={isFetching}
              sx={{
                animation: isFetching ? "spin 1s linear infinite" : "none",
                "@keyframes spin": {
                  "0%": { transform: "rotate(0deg)" },
                  "100%": { transform: "rotate(360deg)" },
                },
              }}
            >
              <ReplayIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Filtros */}
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" disabled={!isSuperAdmin || loadingSedes}>
                <InputLabel>Sede</InputLabel>
                <Select
                  value={filtroSede}
                  label="Sede"
                  onChange={(e) => setFiltroSede(e.target.value)}
                >
                  <MenuItem value=""><em>— Todas las sedes —</em></MenuItem>
                  {sedesList.map((s) => (
                    <MenuItem key={String(s.id)} value={String(s.id)}>
                      {s?.nombre ?? `Sede ${s?.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select
                  value={filtroEstado}
                  label="Estado"
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <MenuItem value="pendiente">Pendiente</MenuItem>
                  <MenuItem value="aprobada">Aprobada</MenuItem>
                  <MenuItem value="rechazada">Rechazada</MenuItem>
                  <MenuItem value="">Todos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabla */}
        <Paper>
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error?.message || "Ocurrió un error al cargar las ausencias."}
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#f5f5f5" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Sede</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Desde</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Hasta</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {isLoading ? (
                  <TableSkeleton rows={5} />
                ) : !Array.isArray(ausencias) || ausencias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No hay ausencias {filtroEstado ? `con estado "${filtroEstado}"` : ""}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  ausencias.map((a) => (
                    <AusenciaRow
                      key={a?.id}
                      ausencia={a}
                      onAprobar={handleAprobar}
                      onRechazar={handleRechazar}
                      onBorrar={handleBorrar}
                      onVerDetalle={handleVerDetalle}
                      isProcessing={isProcessing}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Modal de detalle */}
        <DetalleModal
          ausencia={detalleModal.data}
          open={detalleModal.open}
          onClose={() => setDetalleModal({ open: false, data: null })}
        />
      </Stack>
    </LocalizationProvider>
  );
}