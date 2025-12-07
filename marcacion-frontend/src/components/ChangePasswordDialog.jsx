import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Grid, CircularProgress, Alert
} from "@mui/material";
import { useSnackbar } from "notistack";
import { changePassword } from "../api/auth"; // Importamos la función de la API

export default function ChangePasswordDialog({ open, onClose }) {
  // Usamos los 3 campos para una buena UX (current, new, confirm)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleSubmit = async () => {
    setError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Por favor, completa todos los campos.");
      return;
    }
    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las nuevas contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      // Tu API envía 'currentPassword' y 'newPassword'
      await changePassword(currentPassword, newPassword);
      enqueueSnackbar("Contraseña actualizada exitosamente", { variant: "success" });
      handleClose(); // Cierra y resetea el form
    } catch (e) {
      const msg = e?.response?.data || "Error al cambiar la contraseña";
      setError(msg); // Muestra el error dentro del dialog
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // Evita cerrar mientras carga
    // Resetear campos
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    onClose(); // Llama a la función del padre (en App.jsx)
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cambiar Contraseña</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: .5 }}>
          {error && (
            <Grid item xs={12}>
              <Alert severity="error">{String(error)}</Alert>
            </Grid>
          )}
          <Grid item xs={12}>
            <TextField
              label="Contraseña Actual"
              type="password"
              fullWidth
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Nueva Contraseña"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Confirmar Nueva Contraseña"
              type="password"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : "Actualizar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}