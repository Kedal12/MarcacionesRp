import api from "./axios";

export async function getUsuarios(params = {}) {
  const { data } = await api.get("/api/usuarios", { params });
  return data;
}
export async function crearUsuario(payload) {
  // { nombreCompleto, email, password, rol, idSede }
  const { data } = await api.post("/api/usuarios", payload);
  return data;
}
export async function actualizarUsuario(id, payload) {
  const { data } = await api.put(`/api/usuarios/${id}`, payload);
  return data;
}
export async function cambiarEstadoUsuario(id, activo) {
  const { data } = await api.patch(`/api/usuarios/${id}/estado`, { activo });
  return data;
}
export async function eliminarUsuario(id) {
  const { data } = await api.delete(`/api/usuarios/${id}`);
  return data;
}
// --- NUEVA FUNCIÓN AÑADIDA ---
/**
 * Resetea la contraseña de un usuario (admin).
 */
export async function resetPassword(userId, newPassword) {
  await api.post(`/api/usuarios/${userId}/reset-password`, { newPassword });
}
