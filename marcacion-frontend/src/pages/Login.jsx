import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, TextField, Button, Typography, Stack, Alert
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      setError(err?.response?.data || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: (t) => t.palette.background.default,
      px: 2
    }}>
      <Paper elevation={6} sx={{ width: "100%", maxWidth: 420, p: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Iniciar sesión
        </Typography>

        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<LoginIcon />}
              disabled={loading}
              fullWidth
            >
              {loading ? "Ingresando..." : "Entrar"}
            </Button>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
