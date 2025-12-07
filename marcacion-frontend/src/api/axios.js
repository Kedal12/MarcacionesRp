import axios from "axios";

// En desarrollo: usa VITE_API_URL (https://localhost:7042)
// En producción (mismo dominio): baseURL vacío -> llamará a "/api/..."
const baseURL = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || "") : "";

const api = axios.create({
  baseURL,
  timeout: 15000, // opcional
});

// Adjunta el token en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Manejo centralizado de 401/403 y mensajes
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("token");
      // redirige al login
      window.location.href = "/login";
    }
    // Normaliza el mensaje de error para tus catch
    err.message =
      err?.response?.data ??
      err?.message ??
      "Ocurrió un error al comunicar con el servidor.";
    return Promise.reject(err);
  }
);

export default api;
