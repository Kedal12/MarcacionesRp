import api from "./axios";

export async function getSedes(params) {
  const { data } = await api.get("/api/sedes", { params });
  return data; // { items, total, page, pageSize }
}

export async function getSedesAll() {
  const { data } = await api.get("/api/sedes/all");
  return data;
}

export async function crearSede(dto) {
  const { data } = await api.post("/api/sedes", dto);
  return data;
}

export async function actualizarSede(id, dto) {
  await api.put(`/api/sedes/${id}`, dto);
}

export async function actualizarCoordenadas(id, dto) {
  await api.patch(`/api/sedes/${id}/coordenadas`, dto);
}

export async function eliminarSede(id) {
  await api.delete(`/api/sedes/${id}`);
}
