import React, { useMemo, useState } from "react";
import {
  Paper, Stack, Typography, Button, IconButton, Box, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Autocomplete, TextField, Grid, FormControl, InputLabel, Select, MenuItem, Avatar, Chip
} from "@mui/material";
import {
  DeleteForever as DeleteIcon,
  CalendarMonth as CalendarIcon,
  PersonSearch as PersonIcon,
  LocationOn as LocationIcon,
  AutoMode as AutoIcon,
  AddCircleOutline as SimpleIcon
} from "@mui/icons-material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/es";

// Hooks
import { useUsuarios } from "../hooks/useUsuarios";
import { useHorarios } from "../hooks/useHorarios";
import { useSedesAll } from "../hooks/useSedes";
import { useAsignaciones, useAsignacionMutation, useEliminarAsignacionMutation } from "../hooks/useAsignaciones";
import { useAuth } from "../auth/AuthContext";

export default function Asignaciones() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = useMemo(() => currentUser?.rol === "superadmin", [currentUser]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [filtroSede, setFiltroSede] = useState(() => {
  return currentUser?.rol === "superadmin" ? "" : String(currentUser?.idSede || "");
  });
  const [form, setForm] = useState({ 
    horarioId: "", 
    horarioIdB: "", 
    desde: null, 
    hasta: null 
  });
  
  const [modoRotacion, setModoRotacion] = useState(false);

  // Carga de datos
  const { data: sedesData = [] } = useSedesAll();
  const { data: horarios = [] } = useHorarios();
  
  const sedesList = useMemo(() => {
    if (Array.isArray(sedesData)) return sedesData;
    return sedesData?.items || [];
  }, [sedesData]);

  const { data: usuariosData, isLoading: loadingUsers } = useUsuarios({
    page: 1,
    pageSize: 1000,
    idSede: filtroSede || undefined,
    activo: true 
  });

  const { data: asignaciones = [], isLoading: loadingAsign } = useAsignaciones(selectedUser?.id);
  const { mutateAsync: asignar, isLoading: isAssigning } = useAsignacionMutation();
  const { mutate: eliminar } = useEliminarAsignacionMutation();

  const handleSave = async () => {
    await asignar({
      idUsuario: selectedUser.id,
      idHorario: Number(form.horarioId),
      desde: dayjs(form.desde).format("YYYY-MM-DD"),
      hasta: form.hasta ? dayjs(form.hasta).format("YYYY-MM-DD") : null,
    });
    resetForm();
  };

  // LÓGICA CORREGIDA: Proyección Lunes a Domingo sin desfase
  const handleSaveRotacion = async () => {
    if (!form.desde || !form.hasta || !form.horarioId || !form.horarioIdB) return;
    
    // Calculamos el lunes de la semana seleccionada de forma manual
    // dayjs().day(1) devuelve el lunes de esa semana
    let fechaActual = dayjs(form.desde).day(1); 
    
    // Si por error el cálculo nos manda al lunes anterior (ej: seleccionaste domingo), sumamos una semana
    if (fechaActual.isBefore(dayjs(form.desde), 'day')) {
        fechaActual = fechaActual.add(1, 'week');
    }

    const fechaLimite = dayjs(form.hasta);
    
    let i = 0;
    try {
      while (fechaActual.isBefore(fechaLimite) || fechaActual.isSame(fechaLimite, 'day')) {
        const hIdActual = i % 2 === 0 ? form.horarioId : form.horarioIdB;
        
        // Bloque estricto: Lunes (fechaActual) a Domingo (fechaActual + 6 días)
        await asignar({
          idUsuario: selectedUser.id,
          idHorario: Number(hIdActual),
          desde: fechaActual.format("YYYY-MM-DD"),
          hasta: fechaActual.add(6, 'day').format("YYYY-MM-DD"), 
        });
        
        fechaActual = fechaActual.add(1, 'week');
        i++;
      }
      
      resetForm();
      setModoRotacion(false);
    } catch (error) {
      console.error("Error en proyección de rotación:", error);
    }
  };

  const resetForm = () => {
    setForm({ horarioId: "", horarioIdB: "", desde: null, hasta: null });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3} sx={{ p: { xs: 1, md: 3 } }}>
        <Typography variant="h4" fontWeight="bold">Asignación de Horarios</Typography>

        <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
          <Grid container spacing={3} alignItems="center">
            {isSuperAdmin && (
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Sede</InputLabel>
                  <Select 
                    value={filtroSede} 
                    label="Sede" 
                    onChange={(e) => { setFiltroSede(e.target.value); setSelectedUser(null); }}
                    startAdornment={<LocationIcon sx={{ mr: 1, color: 'action.active' }} />}
                  >
                    <MenuItem value="">Todas las Sedes</MenuItem>
                    {sedesList.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.nombre}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12} md={isSuperAdmin ? 8 : 12}>
              <Autocomplete
                options={usuariosData?.items || []}
                getOptionLabel={(u) => `${u.nombreCompleto} (${u.email})`}
                value={selectedUser}
                onChange={(_, val) => { setSelectedUser(val); resetForm(); }}
                loading={loadingUsers}
                renderOption={(props, u) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>{u.nombreCompleto[0]}</Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight="bold" noWrap>{u.nombreCompleto}</Typography>
                      <Typography variant="caption" color="textSecondary" noWrap>{u.email}</Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Buscar Empleado" 
                    InputProps={{ 
                      ...params.InputProps, 
                      startAdornment: (
                        <>
                          <PersonIcon sx={{ ml: 1, color: 'action.active' }} />
                          {params.InputProps.startAdornment}
                        </>
                      ) 
                    }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Paper>

        {selectedUser && (
          <>
            <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 2 }}>
              <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Horarios de {selectedUser.nombreCompleto}</Typography>
                <Chip label={`${asignaciones.length} Registros`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell><strong>Horario</strong></TableCell>
                      <TableCell><strong>Desde</strong></TableCell>
                      <TableCell><strong>Hasta</strong></TableCell>
                      <TableCell align="right"><strong>Acciones</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingAsign ? (
                      <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} sx={{ my: 2 }} /></TableCell></TableRow>
                    ) : asignaciones.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>No hay horarios registrados</TableCell></TableRow>
                    ) : asignaciones.map(a => (
                      <TableRow key={a.id} hover>
                        <TableCell><Chip label={a.horario} size="small" variant="outlined" color="primary" /></TableCell>
                        <TableCell>{dayjs(a.desde).format("DD/MM/YYYY")}</TableCell>
                        <TableCell>{a.hasta ? dayjs(a.hasta).format("DD/MM/YYYY") : "Indefinido"}</TableCell>
                        <TableCell align="right">
                          <IconButton color="error" onClick={() => eliminar(a.id)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarIcon color="primary" /> 
                  {modoRotacion ? "Proyectar Rotación por Rango" : "Nueva Asignación Simple"}
                </Typography>
                <Button 
                  size="small"
                  variant={modoRotacion ? "contained" : "outlined"} 
                  color="secondary" 
                  startIcon={modoRotacion ? <SimpleIcon /> : <AutoIcon />}
                  onClick={() => { setModoRotacion(!modoRotacion); resetForm(); }}
                >
                  {modoRotacion ? "Cambiar a Simple" : "Modo Rotativo"}
                </Button>
              </Stack>

              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} sm={modoRotacion ? 3 : 4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{modoRotacion ? "Horario Semana A" : "Horario"}</InputLabel>
                    <Select value={form.horarioId} label={modoRotacion ? "Horario Semana A" : "Horario"} onChange={(e) => setForm({...form, horarioId: e.target.value})}>
                      {horarios.filter(h => h.activo).map(h => <MenuItem key={h.id} value={h.id}>{h.nombre}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>

                {modoRotacion && (
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Horario Semana B</InputLabel>
                      <Select value={form.horarioIdB} label="Horario Semana B" onChange={(e) => setForm({...form, horarioIdB: e.target.value})}>
                        {horarios.filter(h => h.activo).map(h => <MenuItem key={h.id} value={h.id}>{h.nombre}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                <Grid item xs={12} sm={3}>
                  <DatePicker 
                    label={modoRotacion ? "Lunes de inicio" : "Fecha Inicio"} 
                    value={form.desde} 
                    onChange={(v) => setForm({...form, desde: v})} 
                    slotProps={{ textField: { size: 'small', fullWidth: true } }} 
                  />
                </Grid>

                <Grid item xs={12} sm={3}>
                  <DatePicker 
                    label={modoRotacion ? "Proyectar hasta" : "Fecha Fin (Opcional)"} 
                    value={form.hasta} 
                    onChange={(v) => setForm({...form, hasta: v})} 
                    minDate={form.desde} 
                    slotProps={{ textField: { size: 'small', fullWidth: true } }} 
                  />
                </Grid>

                <Grid item xs={12} sm={modoRotacion ? 12 : 2}>
                  <Button 
                    variant="contained" 
                    fullWidth 
                    color={modoRotacion ? "secondary" : "primary"}
                    onClick={modoRotacion ? handleSaveRotacion : handleSave} 
                    disabled={isAssigning || !form.horarioId || !form.desde || (modoRotacion && (!form.horarioIdB || !form.hasta))}
                  >
                    {isAssigning ? <CircularProgress size={20} /> : (modoRotacion ? "Generar Rotación por Rango" : "Asignar")}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </>
        )}
      </Stack>
    </LocalizationProvider>
  );
}