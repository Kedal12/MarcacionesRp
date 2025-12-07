import { useEffect, useState, useMemo } from "react";
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, Button, IconButton, Chip, Box, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  TextField, Grid, Select, MenuItem, FormControl, InputLabel
} from "@mui/material";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // Icono Aprobar
import HighlightOffIcon from '@mui/icons-material/HighlightOff'; // Icono Rechazar
import ReplayIcon from "@mui/icons-material/Replay";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever"; // Opcional para borrar
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
// --- AÑADIDO: Importar useAuth y definir Roles ---
import { useAuth } from "../auth/AuthContext";
import { listarAusencias, aprobarAusencia, rechazarAusencia, borrarAusencia } from "../api/ausencias";
import { getUsuarios } from "../api/usuarios";
import { getSedes } from "../api/sedes";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---

dayjs.extend(utc);

// (Funciones helper formatDateTime y getStatusColor - sin cambios)
// ...
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
// ...

// Estados posibles para el filtro
const estadosAusencia = ["pendiente", "aprobada", "rechazada"];

export default function AusenciasAdmin() {
  const { enqueueSnackbar } = useSnackbar();
  // --- AÑADIDO: Obtener usuario y rol ---
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  // Estados de listas y filtros
  const [ausencias, setAusencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]); // Para filtro
  const [sedes, setSedesList] = useState([]); // Renombrado
  const [filtroUsuario, setFiltroUsuario] = useState("");
  // --- MODIFICADO: filtroSede se setea en useEffect ---
  const [filtroSede, setFiltroSede] = useState("");
  // --- FIN MODIFICADO ---
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [filtroDesde, setFiltroDesde] = useState(null);
  const [filtroHasta, setFiltroHasta] = useState(null);

  // Estados UI
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false); // AÑADIDO
  const [loadingSedes, setLoadingSedes] = useState(false); // AÑADIDO
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState(null);

  // --- AÑADIDO: Efecto para forzar la sede si el usuario es admin ---
  useEffect(() => {
    if (user && !isSuperAdmin) {
      // Si el usuario es admin (no superadmin), forzar su ID de sede
      setFiltroSede(String(user.idSede || ""));
    }
  }, [user, isSuperAdmin]);
  // --- FIN AÑADIDO ---

  // Construye el objeto de filtro para la API basado en los estados
  const queryFilter = useMemo(() => ({
      idUsuario: filtroUsuario || undefined,
      idSede: filtroSede || undefined, // Ya está forzado o seleccionado
      estado: filtroEstado || undefined,
      desde: filtroDesde ? dayjs(filtroDesde).startOf('day') : undefined,
      hasta: filtroHasta ? dayjs(filtroHasta).endOf('day') : undefined,
  }), [filtroUsuario, filtroSede, filtroEstado, filtroDesde, filtroHasta]);


  // Carga inicial de sedes (solo para superadmin)
  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedesList(data.items))
        .catch(() => enqueueSnackbar("Error cargando lista de sedes", { variant: "error" }))
        .finally(() => setLoadingSedes(false));
    }
  }, [isSuperAdmin, enqueueSnackbar]);

  // Carga inicial de usuarios (filtrados si es admin)
  useEffect(() => {
    if (!user) return; // Espera a que el usuario cargue
    
    // Define el filtro para getUsuarios
    // Si es SuperAdmin, usa el filtroSede (si seleccionó uno).
    // Si es Admin, usa el user.idSede (forzado).
    const sedeIdParaFiltrarUsuarios = isSuperAdmin ? filtroSede : (user.idSede || "");

    setLoadingUsers(true);
    const userFilter = { 
        page: 1, 
        pageSize: 1000, 
        idSede: sedeIdParaFiltrarUsuarios ? Number(sedeIdParaFiltrarUsuarios) : undefined
    };

    getUsuarios(userFilter)
      .then(data => setUsuarios(data.items))
      .catch(() => enqueueSnackbar("Error cargando lista de usuarios", { variant: "error" }))
      .finally(() => setLoadingUsers(false));
      
  // Recarga la lista de usuarios si cambia el rol (poco probable) o si el superadmin cambia el filtro de sede
  }, [user, isSuperAdmin, filtroSede, enqueueSnackbar]);


  // Carga las ausencias aplicando los filtros
  const loadAusencias = () => {
    // Evita carga inicial si es admin y el filtroSede (forzado) aún no se ha seteado
    if (user?.rol === ROLES.ADMIN && !filtroSede) {
        return;
    }

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

  // Carga al inicio y cuando cambian los filtros
  useEffect(() => {
    loadAusencias();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilter, user?.rol, filtroSede]); // Depende de queryFilter (que incluye filtroSede)


  // (handleAction - sin cambios, el backend ya valida los permisos de acción)
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
                  if (!confirm(`¿Eliminar la solicitud de ${ausencia.tipo} para ${ausencia.nombreUsuario}?`)) {
                      setActionLoadingId(null);
                      return;
                  }
                  await borrarAusencia(ausencia.id);
                  enqueueSnackbar("Solicitud eliminada.", { variant: "success" });
                  break;
              default:
                  throw new Error("Acción desconocida");
          }
          loadAusencias(); // Recargar
      } catch (e) {
          // El backend devuelve 403 Forbidden si el admin intenta aprobar/rechazar de otra sede
          enqueueSnackbar(e?.response?.data || `Error al ${actionType === 'approve' ? 'aprobar' : actionType === 'reject' ? 'rechazar' : 'eliminar'}`, { variant: "error" });
      } finally {
          setActionLoadingId(null);
      }
  };


  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={800}>Gestionar Solicitudes de Ausencia</Typography>

        {/* Filtros */}
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            
            {/* --- MODIFICADO: Filtro Sede (Select) solo para SuperAdmin --- */}
             {isSuperAdmin && (
                <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="sede-filter-label">Sede</InputLabel>
                        <Select
                            labelId="sede-filter-label"
                            value={filtroSede}
                            label="Sede"
                            onChange={(e) => {
                                setFiltroSede(e.target.value);
                                setFiltroUsuario(""); // Limpia el filtro de usuario al cambiar de sede
                            }}
                            disabled={loading || loadingSedes}
                        >
                            <MenuItem value="">Todas</MenuItem>
                            {sedes.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Grid>
             )}
            {/* --- FIN MODIFICADO --- */}
            
            {/* El Grid de Usuario ocupa más espacio si el de Sede está oculto */}
            <Grid item xs={12} sm={6} md={isSuperAdmin ? 3 : 5}>
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
                        {/* La lista de 'usuarios' ya está pre-filtrada por sede */}
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
            <Grid item xs={6} sm={3} md={2}>
                <DatePicker
                    label="Desde"
                    value={filtroDesde}
                    onChange={setFiltroDesde}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    disabled={loading}
                    clearable
                 />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
                 <DatePicker
                    label="Hasta"
                    value={filtroHasta}
                    onChange={setFiltroHasta}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    minDate={filtroDesde || undefined}
                    disabled={loading}
                    clearable
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

        {/* Tabla de Ausencias */}
        <Paper>
          {error && <Alert severity="error" sx={{ m: 2 }}>{String(error)}</Alert>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{width: '15%'}}>Usuario</TableCell>
                  <TableCell sx={{width: '10%'}}>Tipo</TableCell>
                  <TableCell sx={{width: '10%'}}>Desde</TableCell>
                  <TableCell sx={{width: '10%'}}>Hasta</TableCell>
                  <TableCell>Observación</TableCell>
                  <TableCell sx={{width: '10%'}}>Estado</TableCell>
                  <TableCell sx={{width: '15%'}}>Solicitado El</TableCell>
                  <TableCell align="right" sx={{width: '10%'}}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                )}
                {!loading && ausencias.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>No hay solicitudes que coincidan con los filtros.</TableCell></TableRow>
                )}
                {!loading && ausencias.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.nombreUsuario}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{a.tipo}</TableCell>
                    <TableCell>{formatDate(a.desde)}</TableCell>
                    <TableCell>{formatDate(a.hasta)}</TableCell>
                     <TableCell>
                      <Tooltip title={a.observacion || ""}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           {a.observacion || "-"}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={a.estado}
                        color={getStatusColor(a.estado)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>{dayjs(a.createdAt).format("DD/MM/YYYY HH:mm")}</TableCell>
                    <TableCell align="right">
                      {a.estado === 'pendiente' && (
                        <>
                          <Tooltip title="Aprobar Solicitud">
                            <span>
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleAction('approve', a)}
                                disabled={actionLoadingId === a.id}
                              >
                                {actionLoadingId === a.id ? <CircularProgress size={20} color="inherit" /> : <CheckCircleOutlineIcon fontSize="small"/>}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Rechazar Solicitud">
                             <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleAction('reject', a)}
                                disabled={actionLoadingId === a.id}
                              >
                                {actionLoadingId === a.id ? <CircularProgress size={20} color="inherit" /> : <HighlightOffIcon fontSize="small"/>}
                              </IconButton>
                             </span>
                          </Tooltip>
                        </>
                      )}
                       <Tooltip title="Eliminar Solicitud">
                         <span>
                           <IconButton
                             size="small"
                             color="default"
                             onClick={() => handleAction('delete', a)}
                             disabled={actionLoadingId === a.id}
                             sx={{ ml: a.estado === 'pendiente' ? 1 : 0 }}
                           >
                             {actionLoadingId === a.id ? <CircularProgress size={20} color="inherit" /> : <DeleteForeverIcon fontSize="small"/>}
                           </IconButton>
                         </span>
                       </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
           {/* Considera añadir paginación si esperas muchas ausencias */}
        </Paper>
      </Stack>
    </LocalizationProvider>
  );
}

