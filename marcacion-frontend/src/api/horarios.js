import api from "./axios";

export async function getHorarios() {
  const { data } = await api.get("/api/horarios");
  return data;
}
export async function getHorario(id) {
  const { data } = await api.get(`/api/horarios/${id}`);
  return data;
}
export async function crearHorario(dto) {
  const { data } = await api.post("/api/horarios", dto);
  return data;
}
export async function actualizarHorario(id, dto) {
  await api.put(`/api/horarios/${id}`, dto);
}
export async function upsertDetalles(id, detalles) {
  await api.put(`/api/horarios/${id}/detalles`, { detalles });
}
export async function eliminarHorario(id) {
  await api.delete(`/api/horarios/${id}`);
}

// Asignaciones
export async function getAsignacionesByUsuario(idUsuario) { // <-- Cambiado el nombre
  const { data } = await api.get("/api/asignaciones", { params: { idUsuario }});
  return data;
}
export async function asignarHorario(dto) {
  const { data } = await api.post("/api/asignaciones", dto, { headers: { "Content-Type": "application/json" }});
  return data;
}
export async function eliminarAsignacion(id) {
  await api.delete(`/api/asignaciones/${id}`);
}
