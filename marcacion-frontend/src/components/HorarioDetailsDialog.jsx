import { useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Stack, Box, CircularProgress, Alert, Typography,
  TextField, Checkbox, FormControlLabel, Divider, Grid,
  InputAdornment
} from "@mui/material";
import { getHorario, upsertDetalles } from "../api/horarios"; // Asegúrate que upsertDetalles esté bien importado

// Helper para convertir TimeSpan ("HH:mm:ss" o "HH:mm") a formato "HH:mm" para input type="time"
const formatTimeSpanForInput = (timeSpanString) => {
  if (!timeSpanString || typeof timeSpanString !== 'string') return "";
  const parts = timeSpanString.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return "";
};

// Helper para convertir "HH:mm" del input a "HH:mm:ss" o null para enviar al backend
const formatInputTimeForApi = (inputTimeString) => {
  if (!inputTimeString) return null;
  // Asegurarse de que tenga segundos, aunque sean :00
  return `${inputTimeString}:00`;
};

// Nombres de los días para mostrar
const diasSemanaNombres = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// --- Componente del Diálogo ---
export default function HorarioDetailsDialog({ open, onClose, horarioId }) {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [horarioNombre, setHorarioNombre] = useState("");
  // Estado para los detalles de cada día. Usamos un objeto para fácil acceso.
  const [detalles, setDetalles] = useState({}); // { 1: {...}, 2: {...}, ... 7: {...} }

  // Carga los detalles del horario cuando cambia el ID
  useEffect(() => {
    if (open && horarioId) {
      setLoading(true);
      setError(null);
      setDetalles({}); // Limpia detalles anteriores
      getHorario(horarioId)
        .then(data => {
          setHorarioNombre(data.nombre);
          // Inicializa el estado 'detalles' con los datos recibidos o valores por defecto
          const initialDetalles = {};
          for (let i = 1; i <= 7; i++) {
            const detalleDia = data.detalles?.find(d => d.diaSemana === i);
            initialDetalles[i] = {
              diaSemana: i,
              laborable: detalleDia?.laborable ?? false, // Por defecto no laborable si no existe
              horaEntrada: formatTimeSpanForInput(detalleDia?.horaEntrada),
              horaSalida: formatTimeSpanForInput(detalleDia?.horaSalida),
              toleranciaMin: detalleDia?.toleranciaMin ?? 0,
              redondeoMin: detalleDia?.redondeoMin ?? 0,
              descansoMin: detalleDia?.descansoMin ?? 0,
            };
          }
          setDetalles(initialDetalles);
        })
        .catch(err => {
          setError(err?.response?.data || "Error cargando detalles del horario");
          enqueueSnackbar("Error al cargar detalles", { variant: "error" });
        })
        .finally(() => setLoading(false));
    } else {
      // Limpia si se cierra o no hay ID
      setHorarioNombre("");
      setDetalles({});
    }
  }, [open, horarioId, enqueueSnackbar]); // Depende de open y horarioId

  // Manejador para actualizar un campo de un día específico
  const handleDetailChange = (dia, field, value) => {
    setDetalles(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [field]: value
      }
    }));
  };

  // Manejador para guardar los cambios
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Convierte el estado 'detalles' al formato DTO para la API
    const detallesDto = Object.values(detalles).map(d => ({
        diaSemana: d.diaSemana,
        laborable: d.laborable,
        // Convierte HH:mm a HH:mm:ss o null si no aplica
        horaEntrada: d.laborable ? formatInputTimeForApi(d.horaEntrada) : null,
        horaSalida: d.laborable ? formatInputTimeForApi(d.horaSalida) : null,
        toleranciaMin: Number(d.toleranciaMin) || 0,
        redondeoMin: Number(d.redondeoMin) || 0,
        descansoMin: Number(d.descansoMin) || 0,
    }));

    // Validación simple (podría ser más robusta)
    for (const d of detallesDto) {
        if (d.laborable && (!d.horaEntrada || !d.horaSalida)) {
            enqueueSnackbar(`El ${diasSemanaNombres[d.diaSemana - 1]} está marcado como laborable pero faltan horas.`, { variant: "warning" });
            setSaving(false);
            return;
        }
        if (d.laborable && d.horaEntrada && d.horaSalida && d.horaEntrada >= d.horaSalida) {
             enqueueSnackbar(`En ${diasSemanaNombres[d.diaSemana - 1]}, la hora de entrada debe ser menor que la de salida.`, { variant: "warning" });
            setSaving(false);
            return;
        }
    }


    try {
      // Llama a la API para guardar (reemplazar) todos los detalles
      await upsertDetalles(horarioId, detallesDto);
      enqueueSnackbar("Detalles del horario guardados correctamente", { variant: "success" });
      onClose(); // Cierra el diálogo al guardar
    } catch (err) {
      setError(err?.response?.data || "Error guardando los detalles");
      enqueueSnackbar("Error al guardar los detalles", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Editar Detalles del Horario: <Typography component="span" fontWeight="bold">{horarioNombre}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
        {error && !loading && <Alert severity="error" sx={{ mb: 2 }}>{String(error)}</Alert>}

        {!loading && !error && (
          <Stack spacing={2} divider={<Divider />}>
            {/* Iteramos de 1 a 7 para cada día de la semana */}
            {Object.values(detalles).sort((a,b) => a.diaSemana - b.diaSemana).map(detalleDia => (
              <Box key={detalleDia.diaSemana}>
                <Typography variant="h6" gutterBottom>{diasSemanaNombres[detalleDia.diaSemana - 1]}</Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={2}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={detalleDia.laborable}
                          onChange={(e) => handleDetailChange(detalleDia.diaSemana, 'laborable', e.target.checked)}
                        />
                      }
                      label="Laborable"
                    />
                  </Grid>
                  {/* Campos habilitados solo si es laborable */}
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="Entrada"
                      type="time"
                      value={detalleDia.horaEntrada}
                      onChange={(e) => handleDetailChange(detalleDia.diaSemana, 'horaEntrada', e.target.value)}
                      disabled={!detalleDia.laborable}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 300 }} // incrementos de 5 min (opcional)
                      fullWidth
                      size="small"
                    />
                  </Grid>
                   <Grid item xs={6} sm={2}>
                    <TextField
                      label="Salida"
                      type="time"
                      value={detalleDia.horaSalida}
                      onChange={(e) => handleDetailChange(detalleDia.diaSemana, 'horaSalida', e.target.value)}
                      disabled={!detalleDia.laborable}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 300 }}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                     <TextField
                        label="Tolerancia"
                        type="number"
                        value={detalleDia.toleranciaMin}
                        onChange={(e) => handleDetailChange(detalleDia.diaSemana, 'toleranciaMin', e.target.value)}
                        disabled={!detalleDia.laborable}
                        InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
                        inputProps={{ min: 0 }}
                        fullWidth
                        size="small"
                     />
                  </Grid>
                   <Grid item xs={4} sm={2}>
                     <TextField
                        label="Redondeo"
                        type="number"
                        value={detalleDia.redondeoMin}
                        onChange={(e) => handleDetailChange(detalleDia.diaSemana, 'redondeoMin', e.target.value)}
                        disabled={!detalleDia.laborable}
                        InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
                        inputProps={{ min: 0 }}
                        fullWidth
                        size="small"
                     />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                     <TextField
                        label="Descanso"
                        type="number"
                        value={detalleDia.descansoMin}
                        onChange={(e) => handleDetailChange(detalleDia.diaSemana, 'descansoMin', e.target.value)}
                        disabled={!detalleDia.laborable}
                        InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
                        inputProps={{ min: 0 }}
                        fullWidth
                        size="small"
                     />
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || saving || error} // Deshabilitado si carga, guarda o hay error
        >
          {saving ? <CircularProgress size={24} color="inherit"/> : "Guardar Detalles"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}