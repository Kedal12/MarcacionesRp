import { useEffect, useState, useMemo } from "react";
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, Grid, CircularProgress, Alert, Box,
  FormControl, InputLabel, Select, MenuItem, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LoginIcon from '@mui/icons-material/Login';
import SnoozeIcon from '@mui/icons-material/Snooze';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import ReplayIcon from "@mui/icons-material/Replay";
import { getDashboardMetrics } from "../api/dashboard";
import { getSedes } from "../api/sedes";
// --- AÑADIDO: Importar useAuth y definir Roles ---
import { useAuth } from "../auth/AuthContext";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---


dayjs.extend(utc);
dayjs.extend(timezone);

// (Helpe KpiCard y formatters permanecen igual)
// ... (helper formatTime)
const formatTime = (timeSpanString) => {
    if (!timeSpanString || typeof timeSpanString !== 'string') return "-";
    const parts = timeSpanString.split(':');
    if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return "-";
};
// ... (helper formatDateTime)
const formatDateTime = (dateTimeOffsetString) => {
  if (!dateTimeOffsetString) return "-";
  return dayjs(dateTimeOffsetString).tz(dayjs.tz.guess()).format("HH:mm:ss");
};
// ... (componente KpiCard)
function KpiCard({ title, value, icon, color = "primary" }) {
  return (
    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
      <Box sx={{
          bgcolor: `${color}.main`, 
          color: `${color}.contrastText`,
          borderRadius: '50%',
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
       }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" fontWeight="bold">{value ?? "-"}</Typography>
        <Typography variant="body2" color="text.secondary">{title}</Typography>
      </Box>
    </Paper>
  );
}


export default function Dashboard() {
  const { enqueueSnackbar } = useSnackbar();
  // --- AÑADIDO: Obtener usuario del contexto ---
  const { user } = useAuth(); 
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  const [metrics, setMetrics] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  // --- MODIFICADO: El estado inicial se seteará en el useEffect ---
  const [selectedSede, setSelectedSede] = useState(""); 
  // --- FIN MODIFICADO ---
  const [sedesList, setSedesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSedes, setLoadingSedes] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Carga la lista de sedes (solo si es superadmin)
  useEffect(() => {
    // --- MODIFICADO: Solo carga sedes si es superadmin ---
    if (isSuperAdmin) { 
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedesList(data.items))
        .catch(() => enqueueSnackbar("Error cargando lista de sedes", { variant: "error" }))
        .finally(() => setLoadingSedes(false));
    }
    // --- FIN MODIFICADO ---
  }, [enqueueSnackbar, isSuperAdmin]); // Depende de isSuperAdmin

  // --- AÑADIDO: Efecto para forzar la sede si el usuario es admin ---
  useEffect(() => {
    if (user && !isSuperAdmin) {
      // Si el usuario es admin (no superadmin), forzar su ID de sede
      // y deshabilitar la selección
      setSelectedSede(user.idSede || ""); 
    }
  }, [user, isSuperAdmin]);
  // --- FIN AÑADIDO ---


  const loadMetrics = () => {
    // No cargar si el usuario admin aún no tiene su sede asignada
    if (user && !isSuperAdmin && !selectedSede) {
        setLoading(false);
        // Podrías poner un error si el admin no tiene sede
        if (!user.idSede) setError("Tu usuario no tiene una sede asignada.");
        return; 
    }

    setLoading(true);
    setError(null);
    setMetrics(null);
    // getDashboardMetrics usará selectedSede (que es "" para superadmin o el idSede para admin)
    getDashboardMetrics({ date: selectedDate, idSede: selectedSede || undefined })
      .then(data => {
        setMetrics(data);
        setLastUpdateTime(dayjs().format("HH:mm:ss"));
      })
      .catch(e => {
        const errorMsg = e?.response?.data || e.message || "Error cargando métricas";
        setError(errorMsg);
        enqueueSnackbar(String(errorMsg), { variant: "error" });
        setMetrics(null);
      })
      .finally(() => setLoading(false));
  };

  // Llama a loadMetrics al inicio y cuando cambian fecha o sede
  // (selectedSede cambiará cuando 'user' cargue si es admin)
  useEffect(() => {
    // Evita la llamada inicial si eres admin pero tu sede aún no se ha seteado
    if (user?.rol === ROLES.ADMIN && !selectedSede) {
        return; 
    }
    loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedSede]); // Depende de fecha y sede


  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        {/* Título y Filtros */}
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Typography variant="h5" fontWeight={800}>Dashboard Operativo</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            
            {/* --- MODIFICADO: Mostrar filtro de Sede solo a SuperAdmin --- */}
            {isSuperAdmin && (
              <FormControl sx={{ minWidth: 150 }} size="small">
                <InputLabel id="sede-filter-label">Sede</InputLabel>
                <Select
                  labelId="sede-filter-label"
                  value={selectedSede}
                  label="Sede"
                  onChange={(e) => setSelectedSede(e.target.value)}
                  disabled={loading || loadingSedes}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {sedesList.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {/* --- FIN MODIFICADO --- */}

            <DatePicker
                label="Fecha"
                value={selectedDate}
                onChange={setSelectedDate}
                slotProps={{ textField: { size: 'small' } }}
                disabled={loading}
                maxDate={dayjs()}
              />
            <Tooltip title="Refrescar Datos">
              <span>
                <IconButton onClick={loadMetrics} disabled={loading} size="small">
                  <ReplayIcon />
                </IconButton>
              </span>
            </Tooltip>
             {lastUpdateTime && !loading && (
                 <Typography variant="caption" color="text.secondary" sx={{whiteSpace: 'nowrap'}}>
                     Últ. act: {lastUpdateTime}
                 </Typography>
             )}
          </Stack>
        </Stack>

        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>}
        {error && !loading && <Alert severity="error">{String(error)}</Alert>}

        {/* Tarjetas KPI */}
        {!loading && metrics && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <KpiCard title="Presentes Hoy" value={metrics.presentes} icon={<LoginIcon fontSize="inherit"/>} color="success" />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <KpiCard title="Ausentes Hoy (Est.)" value={metrics.ausentes} icon={<PersonOffIcon fontSize="inherit"/>} color="secondary" />
            </Grid>
             <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <KpiCard title="Llegaron Tarde" value={metrics.tarde} icon={<SnoozeIcon fontSize="inherit"/>} color="warning" />
            </Grid>
             <Grid item xs={12} sm={6} md={6} lg={2.4}>
              <KpiCard title="Sin Marcar Salida" value={metrics.sinSalida} icon={<ExitToAppIcon fontSize="inherit"/>} color="info" />
            </Grid>
            <Grid item xs={12} sm={6} md={6} lg={2.4}>
              <KpiCard title="Total Marcaciones Hoy" value={metrics.marcacionesHoy} icon={<AccessTimeIcon fontSize="inherit"/>} color="primary" />
            </Grid>
          </Grid>
        )}

        {/* Tabla Top Tardanzas */}
        {!loading && metrics && ( 
          <Paper>
            <Typography variant="h6" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              Top Tardanzas - {dayjs(selectedDate).format("DD/MM/YYYY")}
            </Typography>
            {metrics.topTardanzas?.length > 0 ? ( 
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Usuario</TableCell>
                        <TableCell>Hora Entrada Prog.</TableCell>
                        <TableCell>Primera Entrada Real</TableCell>
                        <TableCell align="right">Minutos Tarde</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics.topTardanzas.map((t) => (
                        <TableRow key={t.idUsuario} hover>
                          <TableCell>{t.nombreUsuario} (ID: {t.idUsuario})</TableCell>
                          <TableCell>{formatTime(t.horaEntradaProgramada)}</TableCell>
                          <TableCell>{formatDateTime(t.primeraEntradaReal)}</TableCell>
                          <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                            {t.minutosTarde?.toFixed(0)} min
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
            ) : ( 
                 <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 3 }}>
                     No se registraron tardanzas para esta fecha/sede.
                 </Typography>
             )}
          </Paper>
        )}

         {!loading && !metrics && !error && (
             <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                 Selecciona una fecha y sede para ver las métricas.
             </Typography>
         )}

      </Stack>
    </LocalizationProvider>
  );
}

