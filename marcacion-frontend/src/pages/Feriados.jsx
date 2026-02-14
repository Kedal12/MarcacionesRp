import { useState, useMemo } from "react";
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

// 1. Importar Hooks y Auth
import { useFeriados, useCrearOActualizarFeriado, useEliminarFeriado } from "../hooks/useFeriados";
import { useAuth } from "../auth/AuthContext";

dayjs.extend(utc);

const ROLES = { SUPERADMIN: "superadmin", ADMIN: "admin" };

const formatDate = (dateString) => {
  if (!dateString) return "-";
  return dayjs.utc(dateString).format("DD/MM/YYYY");
};

export default function FeriadosPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => user?.rol === ROLES.SUPERADMIN, [user]);

  // Estados locales para el formulario
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [formFecha, setFormFecha] = useState(dayjs());
  const [formNombre, setFormNombre] = useState("");
  const [formLaborable, setFormLaborable] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 2. Hooks de React Query
  const { data: feriados = [], isLoading, isError, refetch } = useFeriados(selectedYear);
  const { mutate: guardarFeriado, isLoading: isSaving } = useCrearOActualizarFeriado();
  const { mutate: eliminarFeriado } = useEliminarFeriado();

  const handleSave = () => {
    if (!formNombre.trim()) {
      enqueueSnackbar("El nombre es obligatorio", { variant: "warning" });
      return;
    }

    const fechaStr = formFecha.format("YYYY-MM-DD");
    const dto = { nombre: formNombre, laborable: formLaborable };

    guardarFeriado({ fecha: fechaStr, dto }, {
      onSuccess: () => {
        resetForm();
      }
    });
  };

  const handleEdit = (f) => {
    setFormFecha(dayjs.utc(f.fecha));
    setFormNombre(f.nombre);
    setFormLaborable(f.laborable);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (f) => {
    if (window.confirm(`¿Eliminar feriado ${formatDate(f.fecha)}?`)) {
      eliminarFeriado(f.fecha);
    }
  };

  const resetForm = () => {
    setFormNombre("");
    setFormLaborable(false);
    setFormFecha(dayjs());
    setIsEditing(false);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={800}>Gestión de Feriados</Typography>
          <IconButton onClick={() => refetch()} color="primary"><ReplayIcon /></IconButton>
        </Stack>

        {/* Formulario de Creación/Edición (Solo SuperAdmin) */}
        {isSuperAdmin && (
          <Paper sx={{ p: 2, borderLeft: '5px solid', borderColor: isEditing ? 'warning.main' : 'primary.main' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              {isEditing ? "Editar Feriado" : "Agregar Nuevo Feriado"}
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <DatePicker
                  label="Fecha"
                  value={formFecha}
                  onChange={setFormFecha}
                  disabled={isEditing || isSaving}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Nombre del Feriado"
                  fullWidth
                  size="small"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  disabled={isSaving}
                />
              </Grid>
              <Grid item xs={6} sm={2}>
                <FormControlLabel
                  control={<Checkbox checked={formLaborable} onChange={(e) => setFormLaborable(e.target.checked)} />}
                  label="Es Laborable"
                  disabled={isSaving}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSave}
                    disabled={isSaving}
                    startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                  >
                    {isEditing ? "Actualizar" : "Guardar"}
                  </Button>
                  {isEditing && (
                    <Button variant="outlined" color="inherit" onClick={resetForm}>Cancelar</Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Listado de Feriados */}
        <Paper elevation={3}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">Año:</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {[2024, 2025, 2026, 2027].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          {isError && <Alert severity="error" sx={{ m: 2 }}>Error al cargar feriados</Alert>}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>¿Laborable?</TableCell>
                  {isSuperAdmin && <TableCell align="right">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                ) : feriados.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>No hay feriados registrados para este año</TableCell></TableRow>
                ) : feriados.map((f) => (
                  <TableRow key={f.fecha} hover>
                    <TableCell>
                      {formatDate(f.fecha)} <Typography variant="caption" color="text.secondary">({dayjs.utc(f.fecha).format('dddd')})</Typography>
                    </TableCell>
                    <TableCell>{f.nombre}</TableCell>
                    <TableCell>
                      <Chip
                        label={f.laborable ? "Sí" : "No"}
                        color={f.laborable ? "warning" : "default"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleEdit(f)} color="primary"><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton size="small" color="error" onClick={() => handleDelete(f)}><DeleteForeverIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
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