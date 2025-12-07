import { useEffect, useState, useMemo } from "react";
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, Button, IconButton, Box, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Autocomplete, TextField, Grid,
  // --- AÑADIDO: Imports para el nuevo filtro de Sede ---
  FormControl, InputLabel, Select, MenuItem
  // --- FIN AÑADIDO ---
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getUsuarios } from "../api/usuarios";
import { getHorarios, getAsignacionesByUsuario, asignarHorario, eliminarAsignacion } from "../api/horarios";
// --- AÑADIDO: Importar useAuth, Roles y getSedes ---
import { useAuth } from "../auth/AuthContext";
import { getSedes } from "../api/sedes";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---


dayjs.extend(utc);
dayjs.extend(timezone);


export default function Asignaciones() {
  const { enqueueSnackbar } = useSnackbar();
  // --- AÑADIDO: Obtener usuario y rol ---
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  // Estados para listas y selecciones
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  // --- AÑADIDO: Estados para filtro de Sede ---
  const [sedesList, setSedesList] = useState([]);
  const [filtroSede, setFiltroSede] = useState(""); // Sede seleccionada para filtrar usuarios
  // --- FIN AÑADIDO ---

  // Estados para el formulario de nueva asignación
  const [newHorarioId, setNewHorarioId] = useState("");
  const [newDesde, setNewDesde] = useState(null);
  const [newHasta, setNewHasta] = useState(null);

  // Estados UI
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [loadingSedes, setLoadingSedes] = useState(false); // AÑADIDO
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  // --- AÑADIDO: Efecto para forzar la sede si el usuario es admin ---
  useEffect(() => {
    if (user && !isSuperAdmin) {
      // Si el usuario es admin (no superadmin), forzar su ID de sede
      setFiltroSede(String(user.idSede || ""));
    }
  }, [user, isSuperAdmin]);
  // --- FIN AÑADIDO ---

  // --- MODIFICADO: Cargar Sedes (solo SuperAdmin) y Horarios ---
  useEffect(() => {
    // Cargar Horarios (todos los admins lo necesitan)
    setLoadingHorarios(true);
    getHorarios() // Asume que getHorarios() lista todos
      .then(data => setHorarios(data.filter(h => h.activo)))
      .catch(() => enqueueSnackbar("Error cargando horarios", { variant: "error" }))
      .finally(() => setLoadingHorarios(false));

    // Cargar Sedes (solo SuperAdmin para el filtro)
    if (isSuperAdmin) {
      setLoadingSedes(true);
      getSedes({ page: 1, pageSize: 1000 })
        .then(data => setSedesList(data.items))
        .catch(() => enqueueSnackbar("Error cargando lista de sedes", { variant: "error" }))
        .finally(() => setLoadingSedes(false));
    }
  }, [isSuperAdmin, enqueueSnackbar]);
  // --- FIN MODIFICADO ---

  // --- MODIFICADO: Cargar Usuarios basado en filtroSede ---
  useEffect(() => {
    if (!user) return; // Espera a que el usuario (admin) cargue
    
    // Determina la sede por la cual filtrar
    // Si es SuperAdmin, usa el filtroSede (puede ser "" para todas).
    // Si es Admin, usa user.idSede (que fue forzado en el filtroSede).
    const sedeIdParaFiltrar = isSuperAdmin ? filtroSede : (user.idSede || "");

    // Si es Admin y su ID de sede aún no se ha cargado, no hacer nada
    if (!isSuperAdmin && !sedeIdParaFiltrar) {
        setUsuarios([]); // Limpia usuarios si el admin no tiene sede
        return;
    }

    setLoadingUsers(true);
    const params = {
      page: 1,
      pageSize: 1000,
      activo: true,
      idSede: sedeIdParaFiltrar ? Number(sedeIdParaFiltrar) : undefined
    };

    getUsuarios(params)
      .then(data => setUsuarios(data.items.map(u => ({ id: u.id, nombreCompleto: u.nombreCompleto }))))
      .catch(() => enqueueSnackbar("Error cargando usuarios", { variant: "error" }))
      .finally(() => setLoadingUsers(false));

  }, [user, isSuperAdmin, filtroSede, enqueueSnackbar]); // Recarga si cambia el filtro de sede
  // --- FIN MODIFICADO ---


  // Cargar asignaciones cuando se selecciona un usuario (sin cambios)
  useEffect(() => {
    if (selectedUser?.id) {
      setLoadingAsignaciones(true);
      setError(null);
      getAsignacionesByUsuario(selectedUser.id)
        .then(setAsignaciones)
        .catch(e => {
          setError(e?.response?.data || "Error cargando asignaciones");
          setAsignaciones([]);
        })
        .finally(() => setLoadingAsignaciones(false));
    } else {
      setAsignaciones([]);
    }
  }, [selectedUser]);

  // (handleAssign - sin cambios, el backend ya valida permisos)
  const handleAssign = async () => {
    if (!selectedUser?.id || !newHorarioId || !newDesde) {
      enqueueSnackbar("Selecciona usuario, horario y fecha 'Desde'.", { variant: "warning" });
      return;
    }
    const desdeFormatted = dayjs(newDesde).format("YYYY-MM-DD");
    const hastaFormatted = newHasta ? dayjs(newHasta).format("YYYY-MM-DD") : null;

    if (newHasta && dayjs(newHasta).isBefore(dayjs(newDesde))) {
         enqueueSnackbar("La fecha 'Hasta' no puede ser anterior a la fecha 'Desde'.", { variant: "warning" });
         return;
    }

    setSaving(true);
    try {
      await asignarHorario({
        idUsuario: selectedUser.id,
        idHorario: Number(newHorarioId),
        desde: desdeFormatted,
        hasta: hastaFormatted,
      });
      enqueueSnackbar("Horario asignado correctamente", { variant: "success" });
      setNewHorarioId("");
      setNewDesde(null);
      setNewHasta(null);
      setLoadingAsignaciones(true);
      getAsignacionesByUsuario(selectedUser.id)
        .then(setAsignaciones)
        .catch(e => setError(e?.response?.data || "Error recargando asignaciones"))
        .finally(() => setLoadingAsignaciones(false));
    } catch (e) {
      if (e?.response?.status === 409) {
          enqueueSnackbar(e?.response?.data || "Conflicto: El rango de fechas se solapa con otra asignación.", { variant: "error" });
      } else {
          // El backend devolverá 403 Forbidden si el admin asigna a usuario de otra sede
          enqueueSnackbar(e?.response?.data || "Error al asignar horario", { variant: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  // (handleDelete - sin cambios, el backend ya valida permisos)
  const handleDelete = async (asignacion) => {
    if (!confirm(`¿Eliminar la asignación del horario "${asignacion.horario}" para ${selectedUser.nombreCompleto}?`)) return;

    setDeletingId(asignacion.id);
    try {
      await eliminarAsignacion(asignacion.id);
      enqueueSnackbar("Asignación eliminada", { variant: "success" });
      setAsignaciones(prev => prev.filter(a => a.id !== asignacion.id));
    } catch (e) {
      // El backend devolverá 403 Forbidden si el admin borra de otra sede
      enqueueSnackbar(e?.response?.data || "Error al eliminar asignación", { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  // (formatDate - sin cambios)
  const formatDate = (dateOnlyString) => {
      if (!dateOnlyString) return "Indefinido";
      return dayjs.utc(dateOnlyString).format("DD/MM/YYYY");
  };


  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es"> {/* adapterLocale añadido */}
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={800}>Asignación de Horarios</Typography>

        {/* Selección de Sede (SuperAdmin) y Usuario */}
        <Paper sx={{ p: 2 }}>
          {/* --- MODIFICADO: Grid para filtros --- */}
          <Grid container spacing={2} alignItems="center">
            {/* --- AÑADIDO: Filtro Sede (Select) solo para SuperAdmin --- */}
            {isSuperAdmin && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="sede-filter-label">Filtrar Usuarios por Sede</InputLabel>
                  <Select
                    labelId="sede-filter-label"
                    value={filtroSede}
                    label="Filtrar Usuarios por Sede"
                    onChange={(e) => {
                        setFiltroSede(e.target.value);
                        setSelectedUser(null); // Limpia usuario al cambiar sede
                        setAsignaciones([]); // Limpia tabla
                    }}
                    disabled={loadingSedes || loadingUsers}
                  >
                    <MenuItem value="">Todas las Sedes</MenuItem>
                    {sedesList.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {/* --- FIN AÑADIDO --- */}

            {/* Ajusta el tamaño del Autocomplete si el filtro de sede está visible o no */}
            <Grid item xs={12} sm={isSuperAdmin ? 6 : 12}>
              <Autocomplete
                options={usuarios} // Esta lista ahora está filtrada por sede
                getOptionLabel={(option) => option.nombreCompleto || ""}
                value={selectedUser}
                onChange={(event, newValue) => {
                  setSelectedUser(newValue);
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Seleccionar Usuario"
                    variant="outlined"
                    size="small" // Añadido para consistencia
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                loading={loadingUsers}
                disabled={loadingUsers || (user?.rol === ROLES.ADMIN && !user.idSede)} // Deshabilitado si es admin sin sede
                fullWidth
              />
            </Grid>
          </Grid>
          {/* --- FIN MODIFICADO --- */}
        </Paper>

        {/* Tabla de Asignaciones Actuales */}
        {selectedUser && (
          <Paper>
            <Typography variant="h6" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              Horarios Asignados a: {selectedUser.nombreCompleto}
            </Typography>
            {error && <Alert severity="error" sx={{ m: 2 }}>{String(error)}</Alert>}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID Asig.</TableCell>
                    <TableCell>Horario</TableCell>
                    <TableCell>Desde</TableCell>
                    <TableCell>Hasta</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingAsignaciones && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}><CircularProgress size={30} /></TableCell></TableRow>
                  )}
                  {!loadingAsignaciones && asignaciones.length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>Este usuario no tiene horarios asignados.</TableCell></TableRow>
                  )}
                  {!loadingAsignaciones && asignaciones.map(a => (
                    <TableRow key={a.id} hover>
                      <TableCell>{a.id}</TableCell>
                      <TableCell>{a.horario} (ID: {a.idHorario})</TableCell>
                      <TableCell>{formatDate(a.desde)}</TableCell>
                      <TableCell>{formatDate(a.hasta)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Eliminar Asignación">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(a)}
                              disabled={deletingId === a.id}
                            >
                              {deletingId === a.id ? <CircularProgress size={20} color="inherit" /> : <DeleteForeverIcon />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Formulario para Nueva Asignación */}
        {selectedUser && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Nueva Asignación</Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <Autocomplete
                  options={horarios}
                  getOptionLabel={(option) => option.nombre || ""}
                  value={horarios.find(h => h.id === newHorarioId) || null}
                  onChange={(event, newValue) => {
                    setNewHorarioId(newValue ? newValue.id : "");
                  }}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Seleccionar Horario"
                      variant="outlined"
                      size="small" // Añadido
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingHorarios ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  loading={loadingHorarios}
                  disabled={loadingHorarios || saving}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <DatePicker
                  label="Desde *"
                  value={newDesde}
                  onChange={(newValue) => setNewDesde(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  disabled={saving}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <DatePicker
                  label="Hasta (Opcional)"
                  value={newHasta}
                  onChange={(newValue) => setNewHasta(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  minDate={newDesde || undefined}
                  disabled={saving}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                  onClick={handleAssign}
                  disabled={saving || !selectedUser?.id || !newHorarioId || !newDesde || loadingHorarios}
                  fullWidth
                  sx={{ height: '40px' }}
                >
                  Asignar
                </Button>
              </Grid>
            </Grid>
             <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
               Asegúrate de que los rangos de fechas no se solapen. Las fechas son inclusivas.
             </Typography>
          </Paper>
        )}

      </Stack>
    </LocalizationProvider>
  );
}

