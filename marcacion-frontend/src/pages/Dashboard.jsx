import { useState, useMemo } from "react";
import {
  Paper, Stack, Typography, Grid, CircularProgress, Alert, Box,
  FormControl, InputLabel, Select, MenuItem, IconButton, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Avatar, Chip // <--- AÑADE ESTO AQUÍ
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { 
  TrendingUp, TrendingDown, People, 
  History, EventBusy, Replay as ReplayIcon,
  EmojiEvents, WarningAmber
} from '@mui/icons-material';

import { useAuth } from "../auth/AuthContext"; 
import { useDashboardMetrics } from "../hooks/useDashboard";
import { useSedesAll } from "../hooks/useSedes";

// Componente de Tarjeta de Métricas Mejorada
function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <Paper sx={{ p: 3, position: 'relative', overflow: 'hidden', height: '100%', borderRadius: 3, boxShadow: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>{title}</Typography>
          <Typography variant="h3" sx={{ my: 1, fontWeight: 800 }}>{value ?? 0}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        <Avatar sx={{ bgcolor: `${color}.light`, color: `${color}.main`, width: 56, height: 56 }}>
          {icon}
        </Avatar>
      </Box>
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 4, bgcolor: `${color}.main` }} />
    </Paper>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === "superadmin", [user]);

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedSede, setSelectedSede] = useState(isSuperAdmin ? "" : user?.idSede || "");

  const { data: metrics, isLoading, isError, error, refetch } = useDashboardMetrics({ 
    date: selectedDate, 
    idSede: selectedSede || undefined 
  });

  const { data: sedesData, isLoading: loadingSedes } = useSedesAll();
  const sedesList = sedesData?.items || [];

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={4} sx={{ p: 1 }}>
        {/* Cabecera de Filtros */}
        <Paper sx={{ p: 2, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main' }}>Resumen Operativo</Typography>
          <Stack direction="row" spacing={2}>
            {isSuperAdmin && (
              <FormControl sx={{ minWidth: 200 }} size="small">
                <InputLabel>Filtrar por Sede</InputLabel>
                <Select value={selectedSede} label="Filtrar por Sede" onChange={(e) => setSelectedSede(e.target.value)}>
                  <MenuItem value="">Todas las Sedes</MenuItem>
                  {sedesList.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <DatePicker label="Fecha" value={selectedDate} onChange={setSelectedDate} slotProps={{ textField: { size: 'small' } }} />
            <IconButton onClick={() => refetch()} color="primary"><ReplayIcon /></IconButton>
          </Stack>
        </Paper>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={60} /></Box>
        ) : (
          <Grid container spacing={3}>
            {/* Fila de KPIs principales */}
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Total Personal" value={metrics?.presentes + metrics?.ausentes} icon={<People />} color="primary" subtitle="Colaboradores activos" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Presentes" value={metrics?.presentes} icon={<TrendingUp />} color="success" subtitle="En sus puestos" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Ausencias" value={metrics?.ausentes} icon={<EventBusy />} color="error" subtitle="Faltas registradas" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard title="Retrasos" value={metrics?.tarde} icon={<WarningAmber />} color="warning" subtitle="Ingresos tarde" />
            </Grid>

            {/* Fila de Alertas y Detalles */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ borderRadius: 4, height: '100%' }}>
                <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight="bold">Top Tardanzas del Día</Typography>
                  <EmojiEvents color="warning" />
                </Box>
                <Divider />
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Empleado</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Entrada Real</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Retraso</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics?.topTardanzas?.map((t) => (
                        <TableRow key={t.idUsuario} hover>
                          <TableCell>{t.nombreUsuario}</TableCell>
                          <TableCell>{dayjs(t.primeraEntradaReal).format("HH:mm:ss")}</TableCell>
                          <TableCell align="right">
                            <Chip label={`${t.minutosTarde?.toFixed(0)} min`} color="error" size="small" variant="outlined" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 4, height: '100%', bgcolor: 'info.main', color: 'white' }}>
                <Typography variant="h6" gutterBottom fontWeight="bold">Alertas Críticas</Typography>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Sin Salida Registrada:</Typography>
                    <Typography variant="h6" fontWeight="bold">{metrics?.sinSalida}</Typography>
                  </Box>
                  <Divider sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Total Marcaciones:</Typography>
                    <Typography variant="h6" fontWeight="bold">{metrics?.marcacionesHoy}</Typography>
                  </Box>
                  <Box sx={{ mt: 4, p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                    <Typography variant="caption">
                      * Las métricas se actualizan automáticamente cada 5 minutos según la configuración del servidor.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Stack>
    </LocalizationProvider>
  );
}