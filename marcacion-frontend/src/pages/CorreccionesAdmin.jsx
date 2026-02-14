// src/pages/CorreccionesAdmin.jsx
import { useState, useMemo, memo, useCallback } from "react";
import {
  Paper, Stack, Typography, IconButton, Chip, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Grid, Select, MenuItem, FormControl, InputLabel, Skeleton, Box, Fade,
  Dialog, DialogTitle, DialogContent, DialogActions, Button
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

// Hooks
import {
  useCorrecciones,
  useAprobarCorreccion,
  useRechazarCorreccion,
  useBorrarCorreccion
} from "../hooks/useCorrecciones";
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

const formatTime = (time) => {
  if (!time) return "-";
  // normaliza a HH:mm
  const parts = String(time).split(":");
  if (parts.length >= 2) return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  return time;
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

// Normalizadores para tolerar diferentes esquemas
const getUserName = (c) =>
  c?.nombreUsuario || c?.usuarioNombre || c?.usuario?.nombre || "—";

const getSedeName = (c) =>
  c?.sedeNombre || c?.sede?.nombre || "N/A";

const normalizeSedes = (sedesData) =>
  Array.isArray(sedesData) ? sedesData : (sedesData?.items || []);

// ────────────────────────────────────────────────────────────────────────────
// COMPONENTES MEMOIZADOS
// ────────────────────────────────────────────────────────────────────────────
const TableSkeleton = memo(({ rows = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton animation="wave" /></TableCell>
        <TableCell><Skeleton animation="wave" width={120} /></TableCell>
        <TableCell><Skeleton animation="wave" width={90} /></TableCell>
        <TableCell><Skeleton animation="wave" width={60} /></TableCell>
        <TableCell><Skeleton animation="wave" width={80} /></TableCell>
        <TableCell><Skeleton animation="wave" width={80} /></TableCell>
        <TableCell align="right"><Skeleton animation="wave" width={120} /></TableCell>
      </TableRow>
    ))}
  </>
));

const CorreccionRow = memo(
  ({ correccion, onAprobar, onRechazar, onBorrar, onVerDetalle, isProcessing }) => {
    const statusConfig = getStatusConfig(correccion?.estado);
    const isPendiente = (correccion?.estado || "").toLowerCase() === "pendiente";

    return (
      <Fade in timeout={300}>
        <TableRow hover>
          <TableCell>
            <Typography variant="body2" fontWeight={500}>
              {getUserName(correccion)}
            </Typography>
          </TableCell>

          <TableCell>{getSedeName(correccion)}</TableCell>

          <TableCell>{formatDate(correccion?.fecha)}</TableCell>

          <TableCell>{formatTime(correccion?.horaSolicitada)}</TableCell>

          <TableCell sx={{ textTransform: "capitalize" }}>
            {correccion?.tipo || "-"}
          </TableCell>

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
                <IconButton size="small" onClick={() => onVerDetalle(correccion)}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {isPendiente && (
                <>
                  <Tooltip title="Aprobar">
                    <IconButton
                      color="success"
                      size="small"
                      onClick={() => onAprobar(correccion?.id)}
                      disabled={isProcessing}
                    >
                      <CheckCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Rechazar">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => onRechazar(correccion?.id)}
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
                  onClick={() => onBorrar(correccion?.id)}
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

// Modal de detalle
const DetalleModal = memo(({ correccion, open, onClose }) => {
  if (!correccion) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Detalle de Corrección</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Usuario</Typography>
            <Typography variant="body1">{getUserName(correccion)}</Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Estado</Typography>
            <Box>
              <Chip
                label={correccion?.estado || "-"}
                color={getStatusConfig(correccion?.estado).color}
                size="small"
              />
            </Box>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Sede</Typography>
            <Typography variant="body1">{getSedeName(correccion)}</Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Tipo</Typography>
            <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
              {correccion?.tipo || "-"}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Fecha</Typography>
            <Typography variant="body1">{formatDate(correccion?.fecha)}</Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Hora Solicitada</Typography>
            <Typography variant="body1">{formatTime(correccion?.horaSolicitada)}</Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">Motivo</Typography>
            <Typography variant="body1">{correccion?.motivo || "-"}</Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">Creada</Typography>
            <Typography variant="body1">
              {correccion?.createdAt ? dayjs(correccion.createdAt).format("DD/MM/YYYY HH:mm") : "-"}
            </Typography>
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
export default function CorreccionesAdmin() {
  // Auth y permisos
  const { user: currentUser } = useAuth();
  const isSuperAdmin = useMemo(() => currentUser?.rol === "superadmin", [currentUser]);

  // Filtros
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [detalleModal, setDetalleModal] = useState({ open: false, data: null });

  // Query params memoizados
  const queryParams = useMemo(
    () => ({
      idSede: filtroSede || undefined,
      estado: filtroEstado || undefined,
    }),
    [filtroSede, filtroEstado]
  );

  // Data
  const { data: correcciones, isLoading, isFetching, error, refetch } = useCorrecciones(queryParams);
  const { data: sedesData, isLoading: loadingSedes } = useSedesAll();
  const sedesList = useMemo(() => normalizeSedes(sedesData), [sedesData]);

  // Mutaciones
  const aprobar = useAprobarCorreccion();
  const rechazar = useRechazarCorreccion();
  const borrar = useBorrarCorreccion();

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

  const handleVerDetalle = useCallback((correccion) => {
    setDetalleModal({ open: true, data: correccion });
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        {/* Header con refresco */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={700}>
            Panel de Correcciones (RRHH)
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
                  <MenuItem value="">
                    <em>— Ver todas las sedes —</em>
                  </MenuItem>
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
              {error?.message || "Ocurrió un error al cargar las correcciones."}
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#f5f5f5" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Sede</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Hora</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {isLoading ? (
                  <TableSkeleton rows={5} />
                ) : !Array.isArray(correcciones) || correcciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No hay correcciones {filtroEstado ? `con estado "${filtroEstado}"` : ""}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  correcciones.map((c) => (
                    <CorreccionRow
                      key={c?.id}
                      correccion={c}
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
          correccion={detalleModal.data}
          open={detalleModal.open}
          onClose={() => setDetalleModal({ open: false, data: null })}
        />
      </Stack>
    </LocalizationProvider>
  );
}
