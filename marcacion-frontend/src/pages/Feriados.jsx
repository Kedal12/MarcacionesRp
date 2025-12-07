import { useEffect, useState, useMemo } from "react"; // --- useMemo AÑADIDO ---
import { useSnackbar } from "notistack";
import {
  Paper, Stack, Typography, Button, IconButton, Chip, Box, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  TextField, FormControlLabel, Checkbox, Grid, Select, MenuItem, InputLabel, FormControl
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import ReplayIcon from "@mui/icons-material/Replay";
import EditIcon from "@mui/icons-material/Edit";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import { getFeriados, createOrUpdateFeriado, deleteFeriado } from "../api/feriados";
// --- AÑADIDO: Importar useAuth y definir Roles ---
import { useAuth } from "../auth/AuthContext";

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin"
};
// --- FIN AÑADIDO ---


dayjs.extend(utc);
// dayjs.locale('es');

// Helper para formatear DateOnly (YYYY-MM-DD) para mostrar
const formatDate = (dateOnlyString) => {
    if (!dateOnlyString) return "-";
    return dayjs(dateOnlyString).format("DD/MM/YYYY");
};


export default function Feriados() {
  const { enqueueSnackbar } = useSnackbar();
  // --- AÑADIDO: Obtener usuario y rol ---
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);
  // --- FIN AÑADIDO ---

  const currentYear = dayjs().year();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + 2 - i).sort((a, b) => b - a);

  const [feriados, setFeriados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Estados para el formulario (solo usados por superadmin)
  const [selectedDate, setSelectedDate] = useState(null);
  const [nombreFeriado, setNombreFeriado] = useState("");
  const [esLaborable, setEsLaborable] = useState(false);
  const [editingFecha, setEditingFecha] = useState(null);

  // Carga los feriados (visible para admin y superadmin)
  function loadFeriados(year) {
    setLoading(true);
    setError(null);
    getFeriados(year)
      .then(setFeriados)
      .catch(e => {
        setError(e?.response?.data || e.message || "Error cargando feriados");
        setFeriados([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadFeriados(selectedYear);
  }, [selectedYear]);

  // Las siguientes funciones solo son accesibles para SuperAdmin
  // ya que los botones/formulario están ocultos para otros roles.
  const clearForm = () => {
      setSelectedDate(null);
      setNombreFeriado("");
      setEsLaborable(false);
      setEditingFecha(null);
  };

  const handleEdit = (feriado) => {
      setSelectedDate(dayjs(feriado.fecha));
      setNombreFeriado(feriado.nombre);
      setEsLaborable(feriado.laborable);
      setEditingFecha(feriado.fecha);
  };

  const handleSave = async () => {
    if (!selectedDate || !nombreFeriado.trim()) {
      enqueueSnackbar("Selecciona una fecha e ingresa un nombre.", { variant: "warning" });
      return;
    }

    setSaving(true);
    const fechaFormateada = dayjs(selectedDate).format("YYYY-MM-DD");
    const dto = { nombre: nombreFeriado.trim(), laborable: esLaborable };

    try {
      await createOrUpdateFeriado(fechaFormateada, dto);
      enqueueSnackbar(`Feriado ${editingFecha ? 'actualizado' : 'guardado'}`, { variant: "success" });
      clearForm();
      loadFeriados(selectedYear);
    } catch (e) {
      enqueueSnackbar(e?.response?.data || "Error al guardar el feriado", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (feriado) => {
    if (!confirm(`¿Eliminar el feriado "${feriado.nombre}" del ${formatDate(feriado.fecha)}?`)) return;

    try {
      await deleteFeriado(feriado.fecha);
      enqueueSnackbar("Feriado eliminado", { variant: "success" });
      loadFeriados(selectedYear);
      if (editingFecha === feriado.fecha) {
           clearForm();
      }
    } catch (e) {
      enqueueSnackbar(e?.response?.data || "Error al eliminar el feriado", { variant: "error" });
    }
  };


  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={800}>Gestión de Feriados</Typography>

        {/* --- MODIFICADO: Formulario solo para SuperAdmin --- */}
        {isSuperAdmin && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
                {editingFecha ? `Editando Feriado: ${formatDate(editingFecha)}` : "Añadir/Editar Feriado"}
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <DatePicker
                  label="Fecha *"
                  value={selectedDate}
                  onChange={(newValue) => {
                      setSelectedDate(newValue);
                      if(editingFecha && newValue && dayjs(newValue).format("YYYY-MM-DD") !== editingFecha) {
                          setEditingFecha(null);
                          setNombreFeriado("");
                          setEsLaborable(false);
                      }
                  }}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  format="DD/MM/YYYY"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Nombre del Feriado *"
                  value={nombreFeriado}
                  onChange={(e) => setNombreFeriado(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                 <FormControlLabel
                  control={
                    <Checkbox
                      checked={esLaborable}
                      onChange={(e) => setEsLaborable(e.target.checked)}
                    />
                  }
                  label="Laborable"
                  sx={{ whiteSpace: 'nowrap'}}
                />
              </Grid>
               <Grid item xs={6} sm="auto">
                 <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || !selectedDate || !nombreFeriado.trim()}
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                    fullWidth
                 >
                    {editingFecha ? "Actualizar" : "Guardar"}
                 </Button>
              </Grid>
              <Grid item xs={6} sm="auto">
                 <Button variant="outlined" onClick={clearForm} fullWidth disabled={saving}>
                    Limpiar / Cancelar Edición
                 </Button>
              </Grid>
            </Grid>
          </Paper>
        )}
        {/* --- FIN MODIFICADO --- */}


        {/* Filtro por Año y Lista de Feriados (Visible para todos los admins) */}
        <Paper>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel id="year-select-label">Año</InputLabel>
              <Select
                labelId="year-select-label"
                value={selectedYear}
                label="Año"
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loading}
              >
                {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </Select>
            </FormControl>
             <Box sx={{ flexGrow: 1 }} />
             <Tooltip title="Refrescar Lista">
                <span>
                 <IconButton onClick={() => loadFeriados(selectedYear)} disabled={loading}>
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
                  <TableCell>Fecha</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>¿Laborable?</TableCell>
                  {/* --- MODIFICADO: Columna solo para SuperAdmin --- */}
                  {isSuperAdmin && (
                    <TableCell align="right">Acciones</TableCell>
                  )}
                  {/* --- FIN MODIFICADO --- */}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    {/* --- MODIFICADO: ColSpan dinámico --- */}
                    <TableCell colSpan={isSuperAdmin ? 4 : 3} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                    {/* --- FIN MODIFICADO --- */}
                  </TableRow>
                )}
                {!loading && feriados.length === 0 && (
                  <TableRow>
                    {/* --- MODIFICADO: ColSpan dinámico --- */}
                    <TableCell colSpan={isSuperAdmin ? 4 : 3} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No hay feriados definidos para el año {selectedYear}.
                    </TableCell>
                    {/* --- FIN MODIFICADO --- */}
                  </TableRow>
                )}
                {!loading && feriados.map((f) => (
                  <TableRow key={f.fecha} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row">
                      {formatDate(f.fecha)} ({dayjs(f.fecha).format('dddd')})
                    </TableCell>
                    <TableCell>{f.nombre}</TableCell>
                    <TableCell>
                      <Chip
                        label={f.laborable ? "Sí" : "No"}
                        color={f.laborable ? "warning" : "default"}
                        size="small"
                      />
                    </TableCell>
                    {/* --- MODIFICADO: Celda solo para SuperAdmin --- */}
                    {isSuperAdmin && (
                      <TableCell align="right">
                        <Tooltip title="Editar Feriado">
                           <IconButton size="small" onClick={() => handleEdit(f)}>
                               <EditIcon fontSize="small"/>
                           </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar Feriado">
                           <IconButton size="small" color="error" onClick={() => handleDelete(f)}>
                                <DeleteForeverIcon fontSize="small"/>
                           </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                    {/* --- FIN MODIFICADO --- */}
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

