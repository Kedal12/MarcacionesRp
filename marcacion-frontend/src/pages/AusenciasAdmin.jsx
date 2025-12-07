import { useEffect, useState, useMemo } from "react";
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, IconButton, Chip, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Grid, Select, MenuItem, FormControl, InputLabel
} from "@mui/material";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import ReplayIcon from "@mui/icons-material/Replay";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import { Navigate } from "react-router-dom"; // ✅ Import para redirigir intrusos

import { useAuth } from "../auth/AuthContext";
import { listarAusencias, aprobarAusencia, rechazarAusencia, borrarAusencia } from "../api/ausencias";
import { getUsuarios } from "../api/usuarios";
import { getSedes } from "../api/sedes";

const ROLES = {
  SUPERADMIN: "superadmin"
};

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

const estadosAusencia = ["pendiente", "aprobada", "rechazada"];

export default function AusenciasAdmin() {
  const { enqueueSnackbar } = useSnackbar();
  const { user, isLoading } = useAuth(); // Agregamos isLoading

  // Estados
  const [ausencias, setAusencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [sedes, setSedesList] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [filtroDesde, setFiltroDesde] = useState(null);
  const [filtroHasta, setFiltroHasta] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSedes, setLoadingSedes] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState(null);

  // 🔒 BLOQUEO DE SEGURIDAD 🔒
  if (isLoading) return <CircularProgress />; // Esperar a que cargue el usuario
  if (user?.rol !== ROLES.SUPERADMIN) {
      // Si no es superadmin, lo sacamos de aquí
      return <Navigate to="/dashboard" replace />;
  }

  // Objeto filtro
  const queryFilter = useMemo(() => ({
      idUsuario: filtroUsuario || undefined,
      idSede: filtroSede || undefined,
      estado: filtroEstado || undefined,
      desde: filtroDesde ? dayjs(filtroDesde).startOf('day') : undefined,
      hasta: filtroHasta ? dayjs(filtroHasta).endOf('day') : undefined,
  }), [filtroUsuario, filtroSede, filtroEstado, filtroDesde, filtroHasta]);

  // Carga inicial de SEDES (Siempre necesaria para SuperAdmin)
  useEffect(() => {
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedesList(data.items))
        .catch(() => enqueueSnackbar("Error cargando sedes", { variant: "error" }))
        .finally(() => setLoadingSedes(false));
  }, [enqueueSnackbar]);

  // Carga inicial de USUARIOS (Filtrados si se selecciona una sede)
  useEffect(() => {
    setLoadingUsers(true);
    // Si el SuperAdmin seleccionó una sede, filtramos usuarios. Si no, trae todos.
    const userFilter = { 
        page: 1, 
        pageSize: 1000, 
        idSede: filtroSede ? Number(filtroSede) : undefined
    };

    getUsuarios(userFilter)
      .then(data => setUsuarios(data.items))
      .catch(() => enqueueSnackbar("Error cargando usuarios", { variant: "error" }))
      .finally(() => setLoadingUsers(false));
      
  }, [filtroSede, enqueueSnackbar]); // Recarga usuarios si cambia la sede seleccionada

  // Carga AUSENCIAS
  const loadAusencias = () => {
    setLoading(true);
    setError(null);
    listarAusencias(queryFilter)
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
  }, [queryFilter]); 

  const handleAction = async (actionType, ausencia) => {
      setActionLoadingId(ausencia.id);
      try {
          switch (actionType) {
              case 'approve':
                  await aprobarAusencia(ausencia.id);
                  enqueueSnackbar("Solicitud aprobada.", { variant: "success" });
                  break;
              case 'reject':
                  await rechazarAusencia(ausencia.id);
                  enqueueSnackbar("Solicitud rechazada.", { variant: "warning" });
                  break;
              case 'delete':
                  if (!confirm(`¿Eliminar la solicitud?`)) {
                      setActionLoadingId(null);
                      return;
                  }
                  await borrarAusencia(ausencia.id);
                  enqueueSnackbar("Solicitud eliminada.", { variant: "success" });
                  break;
              default: break;
          }
          loadAusencias();
      } catch (e) {
          enqueueSnackbar(e?.response?.data || "Error en la acción", { variant: "error" });
      } finally {
          setActionLoadingId(null);
      }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={800}>Gestionar Solicitudes de Ausencia (RRHH)</Typography>

        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            
            {/* Filtro Sede SIEMPRE VISIBLE para SuperAdmin */}
            <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                    <InputLabel id="sede-filter-label">Sede</InputLabel>
                    <Select
                        labelId="sede-filter-label"
                        value={filtroSede}
                        label="Sede"
                        onChange={(e) => {
                            setFiltroSede(e.target.value);
                            setFiltroUsuario(""); // Resetear usuario al cambiar sede
                        }}
                        disabled={loading || loadingSedes}
                    >
                        <MenuItem value="">Todas</MenuItem>
                        {sedes.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                    </Select>
                </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                    <InputLabel id="usuario-filter-label">Usuario</InputLabel>
                    <Select
                        labelId="usuario-filter-label"
                        value={filtroUsuario}
                        label="Usuario"
                        onChange={(e) => setFiltroUsuario(e.target.value)}
                        disabled={loading || loadingUsers}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {usuarios.map(u => <MenuItem key={u.id} value={u.id}>{u.nombreCompleto}</MenuItem>)}
                    </Select>
                </FormControl>
            </Grid>

             <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                    <InputLabel id="estado-filter-label">Estado</InputLabel>
                    <Select
                        labelId="estado-filter-label"
                        value={filtroEstado}
                        label="Estado"
                        onChange={(e) => setFiltroEstado(e.target.value)}
                        disabled={loading}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {estadosAusencia.map(e => <MenuItem key={e} value={e} sx={{textTransform: 'capitalize'}}>{e}</MenuItem>)}
                    </Select>
                </FormControl>
            </Grid>
            
            {/* Fechas y botón refrescar... (igual que antes) */}
            <Grid item xs={6} sm={3} md={2}>
                <DatePicker
                    label="Desde"
                    value={filtroDesde}
                    onChange={setFiltroDesde}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    disabled={loading}
                 />
            </Grid>
            <Grid item xs={6} sm={3} md={1}>
                 <DatePicker
                    label="Hasta"
                    value={filtroHasta}
                    onChange={setFiltroHasta}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    minDate={filtroDesde || undefined}
                    disabled={loading}
                 />
            </Grid>
             <Grid item xs={12} sm={12} md={1} sx={{ textAlign: 'right' }}>
                 <Tooltip title="Refrescar Lista">
                     <span>
                         <IconButton onClick={loadAusencias} disabled={loading}>
                             <ReplayIcon />
                         </IconButton>
                     </span>
                 </Tooltip>
             </Grid>
          </Grid>
        </Paper>

        {/* Tabla... (sin cambios estructurales, solo renderiza) */}
        <Paper>
          {error && <Alert severity="error" sx={{ m: 2 }}>{String(error)}</Alert>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Desde</TableCell>
                  <TableCell>Hasta</TableCell>
                  <TableCell>Observación</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Solicitado El</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>}
                {!loading && ausencias.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No hay datos.</TableCell></TableRow>}
                {!loading && ausencias.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.nombreUsuario}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{a.tipo}</TableCell>
                    <TableCell>{formatDate(a.desde)}</TableCell>
                    <TableCell>{formatDate(a.hasta)}</TableCell>
                     <TableCell>
                      <Tooltip title={a.observacion || ""}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                           {a.observacion || "-"}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip label={a.estado} color={getStatusColor(a.estado)} size="small" sx={{ textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell>{dayjs(a.createdAt).format("DD/MM/YYYY HH:mm")}</TableCell>
                    <TableCell align="right">
                      {a.estado === 'pendiente' && (
                        <>
                            <IconButton size="small" color="success" onClick={() => handleAction('approve', a)} disabled={actionLoadingId === a.id}>
                                <CheckCircleOutlineIcon fontSize="small"/>
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleAction('reject', a)} disabled={actionLoadingId === a.id}>
                                <HighlightOffIcon fontSize="small"/>
                            </IconButton>
                        </>
                      )}
                       <IconButton size="small" onClick={() => handleAction('delete', a)} disabled={actionLoadingId === a.id}>
                           <DeleteForeverIcon fontSize="small"/>
                       </IconButton>
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