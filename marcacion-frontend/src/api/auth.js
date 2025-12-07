import api from "./axios";

const TOKEN_KEY = "token";

/** Guarda y lee el token */
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function getToken()   { return localStorage.getItem(TOKEN_KEY); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

/** Login: devuelve { token } */
export async function login(email, password) {
  const { data } = await api.post("/api/auth/login", { email, password });
  setToken(data.token);
  return data;
}

/** Cerrar sesión */
export function logout() { clearToken(); }

/** Perfil del usuario autenticado: { id, email, rol } */
export async function me() {
  const { data } = await api.get("/api/auth/me");
  return data;
}

/** (Opcional) registrar usuario desde el panel admin */
export async function register({ nombreCompleto, email, password, rol, idSede }) {
  const { data } = await api.post("/api/usuarios", {
    nombreCompleto, email, password, rol, idSede
  });
  return data;
}

/** (Opcional) cambiar contraseña del usuario logueado */
export async function changePassword(currentPassword, newPassword) {
  const { data } = await api.post("/api/auth/change-password", {
    currentPassword, newPassword
  });
  return data;
}
